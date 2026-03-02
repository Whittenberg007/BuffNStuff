import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { TOOL_DEFINITIONS, findTool } from "@/lib/ai/tools";
import { format, subDays } from "date-fns";

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_MINUTE) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return new Response("Rate limit exceeded. Try again in a minute.", {
      status: 429,
    });
  }

  const body = await request.json();
  const { messages, mode } = body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    mode?: "chat" | "food_parse";
  };

  if (!messages?.length) {
    return new Response("Messages required", { status: 400 });
  }

  const anthropic = new Anthropic();

  // Build system prompt with user context
  let systemPrompt: string;
  try {
    const [settingsResult, streakResult, weekResult, enrollmentResult] =
      await Promise.all([
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("workout_sessions")
          .select("started_at")
          .eq("user_id", user.id)
          .not("ended_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(90),
        supabase
          .from("workout_sessions")
          .select("id, started_at")
          .eq("user_id", user.id)
          .not("ended_at", "is", null)
          .gte(
            "started_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          ),
        supabase
          .from("program_enrollments")
          .select("*, program:training_programs(*)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single(),
      ]);

    // Compute streak
    const workoutDays = new Set(
      (streakResult.data || []).map((s: { started_at: string }) =>
        format(new Date(s.started_at), "yyyy-MM-dd")
      )
    );
    let streak = 0;
    let checkDate = new Date();
    if (!workoutDays.has(format(checkDate, "yyyy-MM-dd"))) {
      checkDate = subDays(checkDate, 1);
    }
    while (workoutDays.has(format(checkDate, "yyyy-MM-dd"))) {
      streak++;
      checkDate = subDays(checkDate, 1);
    }

    // Compute week volume
    const weekSessionIds = (weekResult.data || []).map(
      (s: { id: string }) => s.id
    );
    let totalVolume = 0;
    let totalSets = 0;
    if (weekSessionIds.length > 0) {
      const { data: weekSets } = await supabase
        .from("workout_sets")
        .select("weight, reps")
        .in("session_id", weekSessionIds);
      totalVolume = (weekSets || []).reduce(
        (sum: number, s: { weight: number; reps: number }) =>
          sum + s.weight * s.reps,
        0
      );
      totalSets = (weekSets || []).length;
    }

    const uniqueDays = new Set(
      (weekResult.data || []).map((s: { started_at: string }) =>
        format(new Date(s.started_at), "yyyy-MM-dd")
      )
    );

    systemPrompt = buildSystemPrompt({
      settings: settingsResult.data,
      streak,
      weekSummary: {
        daysThisWeek: uniqueDays.size,
        totalVolume,
        totalSets,
      },
      enrollment: enrollmentResult.data,
    });
  } catch {
    systemPrompt = buildSystemPrompt({
      settings: null,
      streak: 0,
      weekSummary: { daysThisWeek: 0, totalVolume: 0, totalSets: 0 },
      enrollment: null,
    });
  }

  // --- Food parse mode: non-streaming, returns JSON ---
  if (mode === "food_parse") {
    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:
          systemPrompt +
          "\n\nThe user wants to log food. Parse their description into structured nutrition items using the log_food tool. Estimate reasonable macro values based on standard serving sizes.",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        tools: TOOL_DEFINITIONS.filter((t) => t.name === "log_food"),
        tool_choice: { type: "tool", name: "log_food" },
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUse) {
        const tool = findTool(toolUse.name);
        if (tool) {
          const result = await tool.execute(
            toolUse.input as Record<string, unknown>,
            supabase,
            user.id
          );
          return Response.json(JSON.parse(result));
        }
      }

      return Response.json({
        items: [],
        error: "Could not parse food items",
      });
    } catch (err) {
      console.error("Food parse error:", err);
      return Response.json(
        { items: [], error: "AI service error" },
        { status: 500 }
      );
    }
  }

  // --- Chat mode: streaming with tool use ---
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Tool use loop (max 5 iterations)
        for (let iteration = 0; iteration < 5; iteration++) {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 2048,
            system: systemPrompt,
            messages: currentMessages,
            tools: TOOL_DEFINITIONS,
          });

          let hasToolUse = false;
          const assistantContent: Anthropic.ContentBlock[] = [];

          for (const block of response.content) {
            assistantContent.push(block);

            if (block.type === "text") {
              controller.enqueue(encoder.encode(block.text));
            } else if (block.type === "tool_use") {
              hasToolUse = true;
            }
          }

          if (!hasToolUse) break;

          // Execute tools and continue conversation
          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: assistantContent },
          ];

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of assistantContent) {
            if (block.type === "tool_use") {
              const tool = findTool(block.name);
              let result: string;
              if (tool) {
                try {
                  result = await tool.execute(
                    block.input as Record<string, unknown>,
                    supabase,
                    user.id
                  );
                } catch (err) {
                  result = JSON.stringify({
                    error: `Tool execution failed: ${err}`,
                  });
                }
              } else {
                result = JSON.stringify({
                  error: `Unknown tool: ${block.name}`,
                });
              }

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });

              // Send food parse results as a special marker
              if (block.name === "log_food") {
                controller.enqueue(
                  encoder.encode(`\n<!--FOOD_ITEMS:${result}-->`)
                );
              }
            }
          }

          currentMessages.push({ role: "user", content: toolResults });
        }
      } catch (err) {
        console.error("Chat stream error:", err);
        controller.enqueue(
          encoder.encode("Sorry, I encountered an error. Please try again.")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}

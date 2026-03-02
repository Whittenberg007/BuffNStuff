import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { format, subDays } from "date-fns";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ insights: [] }, { status: 401 });
  }

  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const weekAgo = subDays(new Date(), 7).toISOString();

    const [settingsResult, weekSessions, todayNutrition, recentPRs] =
      await Promise.all([
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("workout_sessions")
          .select("id, started_at, split_type")
          .eq("user_id", user.id)
          .gte("started_at", weekAgo)
          .not("ended_at", "is", null),
        supabase
          .from("nutrition_entries")
          .select("calories, protein_g")
          .eq("user_id", user.id)
          .eq("date", today),
        supabase
          .from("workout_sets")
          .select(
            "weight, reps, exercise:exercises(name), session:workout_sessions!inner(user_id)"
          )
          .eq("is_pr", true)
          .eq("workout_sessions.user_id", user.id)
          .gte("logged_at", weekAgo)
          .limit(5),
      ]);

    const settings = settingsResult.data;
    const sessions = weekSessions.data || [];
    const todayEntries = todayNutrition.data || [];
    const prs = recentPRs.data || [];

    const todayCals = todayEntries.reduce(
      (s: number, e: { calories: number }) => s + (e.calories || 0),
      0
    );
    const todayProtein = todayEntries.reduce(
      (s: number, e: { protein_g: number }) => s + (e.protein_g || 0),
      0
    );

    const statsText = [
      `Workouts this week: ${sessions.length}`,
      `Target: ${settings?.training_days_per_week || 5} days/week`,
      `Today's calories: ${todayCals} / ${settings?.daily_calorie_target || 2500}`,
      `Today's protein: ${todayProtein}g / ${settings?.protein_target_g || 180}g`,
      `Recent PRs: ${prs.length > 0 ? prs.map((p: { exercise: { name: string } | null }) => (p.exercise as { name: string } | null)?.name || "").join(", ") : "None this week"}`,
    ].join("\n");

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        'Generate 2-3 brief, actionable fitness insights based on the user\'s stats. Each insight should be 1 sentence. Be specific and reference their actual numbers. Return ONLY a JSON array of objects with "text", "category" (training|nutrition|recovery), and "icon" (Dumbbell|Apple|Moon) fields.',
      messages: [{ role: "user", content: statsText }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return Response.json({
      insights: insights.map(
        (i: Record<string, string>, idx: number) => ({
          id: `insight-${idx}`,
          text: i.text,
          category: i.category || "training",
          icon: i.icon || "Dumbbell",
        })
      ),
    });
  } catch (err) {
    console.error("Insights error:", err);
    return Response.json({ insights: [] });
  }
}

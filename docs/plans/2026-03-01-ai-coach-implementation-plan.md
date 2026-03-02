# AI Coach & Insights Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI-powered coaching system with streaming chat, natural language food logging, dashboard insights, and post-workout summaries using the Claude API.

**Architecture:** Server-side Next.js Route Handlers call the Claude API with tool use, streaming responses back to React clients. Tools query the authenticated user's Supabase data. AI features gracefully degrade when API routes are unavailable (Capacitor static builds).

**Tech Stack:** `@anthropic-ai/sdk`, `zod` (existing), Next.js 16 Route Handlers, Supabase SSR client, ReadableStream/TextEncoder for streaming, React state for chat history.

---

## Critical Context

### Dual-Target Build System

This project has two build targets:
- `npm run build` — SSR for Vercel deployment (API routes work)
- `npm run build:cap` — Static export for Capacitor native apps (API routes NOT included)

**API routes (`/api/ai/*`) only work on Vercel.** The Capacitor static build silently skips them. Client components must handle fetch failures gracefully — show a "feature unavailable" message or hide the component entirely. Do NOT add `export const dynamic` to these routes since they're server-only by nature.

### Authentication Pattern

Existing database modules (e.g., `src/lib/database/stats.ts`) use the **client-side** Supabase client: `createClient()` from `@/lib/supabase/client`. This works because they run in the browser.

AI API routes run **server-side**. They must use the **server-side** Supabase client: `createClient()` from `@/lib/supabase/server.ts` (which reads cookies from the request). This is an `async` function.

### Existing Data Module Signatures (for tool implementations)

These are the functions you'll call inside AI tools. They all use client-side Supabase, but in the API route context we need server-side equivalents. The tools will receive the server-side Supabase client and userId as parameters.

- `getWeeklySummary()` → `{ daysThisWeek, totalVolume, totalSets }` (src/lib/database/stats.ts)
- `getCurrentStreak()` → `number` (src/lib/database/stats.ts)
- `getRecentPRs(days)` → `Array<{ exerciseName, weight, reps, date }>` (src/lib/database/stats.ts)
- `getDailyTotals(date)` → `{ calories, protein_g, carbs_g, fats_g }` (src/lib/database/nutrition.ts)
- `getExerciseProgression(exerciseId, days)` → progression array (src/lib/database/analytics.ts)
- `detectPlateaus()` → `PlateauResult[]` (src/lib/training/plateau-detector.ts)
- `getActiveGoals()` → `Goal[]` (src/lib/database/goals.ts)
- `getActiveEnrollment()` → `ProgramEnrollment | null` (src/lib/database/programs.ts)
- `getSettings()` → `UserSettings` (src/lib/database/settings.ts)

---

## Task 1: Add AI types to database.ts

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add types at end of file (after AppNotification interface)**

Add these types after line 437 of `src/types/database.ts`:

```typescript
// --- AI Coach ---

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolResults?: ParsedFoodItem[];
}

export interface ParsedFoodItem {
  food_item: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  quantity_note: string;
}

export interface AIInsight {
  id: string;
  text: string;
  category: "training" | "nutrition" | "recovery";
  icon: string;
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors related to new types

**Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(ai): add ChatMessage, ParsedFoodItem, and AIInsight types"
```

---

## Task 2: Install Anthropic SDK

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Verify install**

Run: `node -e "require('@anthropic-ai/sdk')"`
Expected: No error

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(ai): install @anthropic-ai/sdk"
```

---

## Task 3: Create system prompt builder

**Files:**
- Create: `src/lib/ai/system-prompt.ts`

**Step 1: Create the system prompt builder**

This module builds a system prompt that gives Claude context about the user. It takes user settings, streak info, and program status, then assembles a personalized system prompt.

```typescript
import type { UserSettings, ProgramEnrollment } from "@/types";

interface UserContext {
  settings: UserSettings | null;
  streak: number;
  weekSummary: { daysThisWeek: number; totalVolume: number; totalSets: number };
  enrollment: ProgramEnrollment | null;
}

export function buildSystemPrompt(ctx: UserContext): string {
  const lines: string[] = [
    "You are BuffCoach, an expert AI fitness coach inside the BuffNStuff workout app.",
    "You have access to the user's real training data via tools. Always call tools to get current data before answering questions about their progress.",
    "Be concise, supportive, and science-based. Use the user's data to give personalized advice.",
    "When logging food, always confirm the parsed items with the user before saving.",
    "Format responses in markdown when helpful (bold for emphasis, bullet lists for multiple points).",
    "",
  ];

  if (ctx.settings) {
    lines.push("## User Profile");
    lines.push(`- Unit preference: ${ctx.settings.unit_preference}`);
    lines.push(`- Training days/week: ${ctx.settings.training_days_per_week}`);
    lines.push(`- Preferred split: ${ctx.settings.preferred_split}`);
    lines.push(`- Daily targets: ${ctx.settings.daily_calorie_target} cal, ${ctx.settings.protein_target_g}g protein, ${ctx.settings.carbs_target_g}g carbs, ${ctx.settings.fats_target_g}g fats`);
    if (ctx.settings.display_name) {
      lines.push(`- Name: ${ctx.settings.display_name}`);
    }
    lines.push("");
  }

  lines.push("## Current Status");
  lines.push(`- Workout streak: ${ctx.streak} day${ctx.streak !== 1 ? "s" : ""}`);
  lines.push(`- This week: ${ctx.weekSummary.daysThisWeek} day${ctx.weekSummary.daysThisWeek !== 1 ? "s" : ""} trained, ${ctx.weekSummary.totalSets} sets, ${ctx.weekSummary.totalVolume.toLocaleString()} ${ctx.settings?.unit_preference || "lbs"} volume`);

  if (ctx.enrollment?.program) {
    lines.push(`- Active program: ${ctx.enrollment.program.name} (Week ${ctx.enrollment.current_week}, Day ${ctx.enrollment.current_day_index + 1})`);
  }

  return lines.join("\n");
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/lib/ai/system-prompt.ts
git commit -m "feat(ai): add system prompt builder with user context"
```

---

## Task 4: Create AI tools module

**Files:**
- Create: `src/lib/ai/tools.ts`

**Step 1: Create the tools module**

This is the core module that defines Claude tools as Anthropic Tool objects. Each tool has an `execute` function that queries Supabase server-side. The tools receive a Supabase client and userId so they don't need to re-authenticate.

```typescript
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";

// Type for a tool definition with its execute function
export interface AITool {
  definition: Anthropic.Tool;
  execute: (
    input: Record<string, unknown>,
    supabase: SupabaseClient,
    userId: string
  ) => Promise<string>;
}

// --- get_recent_workouts ---
const getRecentWorkouts: AITool = {
  definition: {
    name: "get_recent_workouts",
    description:
      "Get the user's workout sessions from the last 7 days, including exercises and sets performed.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default 7)",
        },
      },
      required: [],
    },
  },
  async execute(input, supabase, userId) {
    const days = (input.days as number) || 7;
    const since = subDays(new Date(), days).toISOString();

    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("id, started_at, ended_at, split_type, notes")
      .eq("user_id", userId)
      .gte("started_at", since)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false });

    if (!sessions?.length) return JSON.stringify({ sessions: [], message: "No workouts in this period" });

    const sessionIds = sessions.map((s) => s.id);
    const { data: sets } = await supabase
      .from("workout_sets")
      .select("session_id, weight, reps, set_type, is_pr, exercise:exercises(name, primary_muscle_group)")
      .in("session_id", sessionIds)
      .order("logged_at", { ascending: true });

    const result = sessions.map((s) => ({
      date: format(new Date(s.started_at), "yyyy-MM-dd"),
      split: s.split_type,
      notes: s.notes,
      sets: (sets || [])
        .filter((set) => set.session_id === s.id)
        .map((set) => ({
          exercise: (set.exercise as { name: string } | null)?.name || "Unknown",
          muscle: (set.exercise as { primary_muscle_group: string } | null)?.primary_muscle_group,
          weight: set.weight,
          reps: set.reps,
          type: set.set_type,
          isPR: set.is_pr,
        })),
    }));

    return JSON.stringify({ sessions: result });
  },
};

// --- get_nutrition_summary ---
const getNutritionSummary: AITool = {
  definition: {
    name: "get_nutrition_summary",
    description:
      "Get the user's nutrition summary for today and optionally the past week, including calories and macros vs targets.",
    input_schema: {
      type: "object" as const,
      properties: {
        include_week: {
          type: "boolean",
          description: "Also include weekly averages (default false)",
        },
      },
      required: [],
    },
  },
  async execute(input, supabase, userId) {
    const today = format(new Date(), "yyyy-MM-dd");

    // Today's totals
    const { data: todayEntries } = await supabase
      .from("nutrition_entries")
      .select("calories, protein_g, carbs_g, fats_g")
      .eq("user_id", userId)
      .eq("date", today);

    const todayTotals = (todayEntries || []).reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calories || 0),
        protein_g: acc.protein_g + (e.protein_g || 0),
        carbs_g: acc.carbs_g + (e.carbs_g || 0),
        fats_g: acc.fats_g + (e.fats_g || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
    );

    // User targets
    const { data: settings } = await supabase
      .from("user_settings")
      .select("daily_calorie_target, protein_target_g, carbs_target_g, fats_target_g")
      .eq("user_id", userId)
      .single();

    const result: Record<string, unknown> = {
      today: todayTotals,
      targets: settings || { daily_calorie_target: 2500, protein_target_g: 180, carbs_target_g: 250, fats_target_g: 80 },
    };

    if (input.include_week) {
      const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const { data: weekEntries } = await supabase
        .from("nutrition_entries")
        .select("calories, protein_g, carbs_g, fats_g, date")
        .eq("user_id", userId)
        .gte("date", weekStart)
        .lte("date", today);

      const days = new Set((weekEntries || []).map((e) => e.date));
      const weekTotals = (weekEntries || []).reduce(
        (acc, e) => ({
          calories: acc.calories + (e.calories || 0),
          protein_g: acc.protein_g + (e.protein_g || 0),
          carbs_g: acc.carbs_g + (e.carbs_g || 0),
          fats_g: acc.fats_g + (e.fats_g || 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
      );

      const daysLogged = days.size || 1;
      result.weeklyAverage = {
        calories: Math.round(weekTotals.calories / daysLogged),
        protein_g: Math.round(weekTotals.protein_g / daysLogged),
        carbs_g: Math.round(weekTotals.carbs_g / daysLogged),
        fats_g: Math.round(weekTotals.fats_g / daysLogged),
        days_logged: daysLogged,
      };
    }

    return JSON.stringify(result);
  },
};

// --- get_exercise_history ---
const getExerciseHistory: AITool = {
  definition: {
    name: "get_exercise_history",
    description:
      "Get progression data for a specific exercise, showing weight and reps over time. First searches for the exercise by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        exercise_name: {
          type: "string",
          description: "Name of the exercise (e.g., 'Bench Press', 'Squat')",
        },
      },
      required: ["exercise_name"],
    },
  },
  async execute(input, supabase, userId) {
    const name = input.exercise_name as string;

    // Find exercise by name (case-insensitive partial match)
    const { data: exercises } = await supabase
      .from("exercises")
      .select("id, name")
      .ilike("name", `%${name}%`)
      .limit(5);

    if (!exercises?.length) return JSON.stringify({ error: `No exercise found matching "${name}"` });

    const exercise = exercises[0];
    const since = subDays(new Date(), 90).toISOString();

    const { data: sets } = await supabase
      .from("workout_sets")
      .select("weight, reps, logged_at, is_pr, session:workout_sessions!inner(user_id)")
      .eq("exercise_id", exercise.id)
      .eq("workout_sessions.user_id", userId)
      .gte("logged_at", since)
      .eq("set_type", "working")
      .order("logged_at", { ascending: true });

    // Group by date, take best set
    const byDate = new Map<string, { weight: number; reps: number; isPR: boolean }>();
    for (const set of sets || []) {
      const dateKey = format(new Date(set.logged_at), "yyyy-MM-dd");
      const existing = byDate.get(dateKey);
      if (!existing || set.weight > existing.weight) {
        byDate.set(dateKey, { weight: set.weight, reps: set.reps, isPR: set.is_pr });
      }
    }

    return JSON.stringify({
      exercise: exercise.name,
      progression: Array.from(byDate.entries()).map(([date, data]) => ({ date, ...data })),
      totalSessions: byDate.size,
    });
  },
};

// --- get_active_program ---
const getActiveProgram: AITool = {
  definition: {
    name: "get_active_program",
    description: "Get the user's currently active training program enrollment and progress.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  async execute(_input, supabase, userId) {
    const { data: enrollment } = await supabase
      .from("program_enrollments")
      .select("*, program:training_programs(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!enrollment) return JSON.stringify({ enrolled: false, message: "No active program" });

    return JSON.stringify({
      enrolled: true,
      program_name: enrollment.program?.name,
      week: enrollment.current_week,
      day: enrollment.current_day_index + 1,
      total_weeks: enrollment.program?.duration_weeks,
      goal: enrollment.program?.goal,
      difficulty: enrollment.program?.difficulty,
    });
  },
};

// --- get_plateau_status ---
const getPlateauStatus: AITool = {
  definition: {
    name: "get_plateau_status",
    description: "Check if the user has any exercise plateaus or regressions detected.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  async execute(_input, supabase, userId) {
    // Get recent sessions
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("id, started_at")
      .eq("user_id", userId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(5);

    if (!sessions?.length) return JSON.stringify({ plateaus: [], message: "Not enough data" });

    const sessionIds = sessions.map((s) => s.id);
    const { data: sets } = await supabase
      .from("workout_sets")
      .select("exercise_id, weight, reps, session_id, exercise:exercises(name, primary_muscle_group)")
      .in("session_id", sessionIds)
      .eq("set_type", "working");

    // Group by exercise, find best set per session
    const byExercise = new Map<string, Array<{ sessionId: string; weight: number; reps: number }>>();
    for (const set of sets || []) {
      const key = set.exercise_id;
      if (!byExercise.has(key)) byExercise.set(key, []);
      const arr = byExercise.get(key)!;
      const existing = arr.find((s) => s.sessionId === set.session_id);
      if (!existing) {
        arr.push({ sessionId: set.session_id, weight: set.weight, reps: set.reps });
      } else if (set.weight > existing.weight) {
        existing.weight = set.weight;
        existing.reps = set.reps;
      }
    }

    const plateaus: Array<{ exercise: string; muscle: string; type: string; sessions: number }> = [];
    for (const [, entries] of byExercise) {
      if (entries.length < 2) continue;
      const isStalled = entries.slice(0, 3).every(
        (e) => e.weight === entries[0].weight && e.reps === entries[0].reps
      );
      if (isStalled && entries.length >= 2) {
        const set = (sets || []).find((s) => s.exercise_id === entries[0].sessionId) ||
          (sets || []).find((s) => byExercise.has(s.exercise_id));
        const exerciseName = (set?.exercise as { name: string } | null)?.name || "Unknown";
        const muscle = (set?.exercise as { primary_muscle_group: string } | null)?.primary_muscle_group || "unknown";
        plateaus.push({
          exercise: exerciseName,
          muscle,
          type: "plateau",
          sessions: entries.length,
        });
      }
    }

    return JSON.stringify({ plateaus, count: plateaus.length });
  },
};

// --- get_goals ---
const getGoals: AITool = {
  definition: {
    name: "get_goals",
    description: "Get the user's active fitness goals and their current progress.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  async execute(_input, supabase, userId) {
    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    return JSON.stringify({
      goals: (goals || []).map((g) => ({
        title: g.title,
        type: g.type,
        target: g.target_value,
        current: g.current_value,
        progress: g.target_value ? Math.round((g.current_value / g.target_value) * 100) : null,
        target_date: g.target_date,
      })),
    });
  },
};

// --- log_food ---
const logFood: AITool = {
  definition: {
    name: "log_food",
    description:
      "Parse natural language food description into structured nutrition entries. Returns parsed items for user confirmation. Do NOT call this unless the user is explicitly asking to log food.",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          description: "Array of parsed food items",
          items: {
            type: "object",
            properties: {
              food_item: { type: "string", description: "Name of the food item" },
              meal_name: { type: "string", description: "Meal category: Breakfast, Lunch, Dinner, Snack, or Post-workout" },
              calories: { type: "number", description: "Estimated calories" },
              protein_g: { type: "number", description: "Estimated protein in grams" },
              carbs_g: { type: "number", description: "Estimated carbs in grams" },
              fats_g: { type: "number", description: "Estimated fats in grams" },
              quantity_note: { type: "string", description: "Portion description (e.g., '1 medium breast', '2 cups')" },
            },
            required: ["food_item", "meal_name", "calories", "protein_g", "carbs_g", "fats_g", "quantity_note"],
          },
        },
      },
      required: ["items"],
    },
  },
  async execute(input) {
    // This tool doesn't write to DB — it returns parsed items for client-side confirmation
    const items = input.items as Array<Record<string, unknown>>;
    return JSON.stringify({
      action: "confirm_food_log",
      items: items.map((item) => ({
        food_item: item.food_item,
        meal_name: item.meal_name,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fats_g: item.fats_g,
        quantity_note: item.quantity_note,
      })),
    });
  },
};

// --- create_workout_suggestion ---
const createWorkoutSuggestion: AITool = {
  definition: {
    name: "create_workout_suggestion",
    description:
      "Generate a workout suggestion for today based on the user's recent training and split preferences. Returns a text-based workout plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        focus: {
          type: "string",
          description: "Optional muscle group or split focus (e.g., 'chest', 'pull', 'legs')",
        },
      },
      required: [],
    },
  },
  async execute(input, supabase, userId) {
    // Get recent sessions to determine what was trained recently
    const since = subDays(new Date(), 7).toISOString();
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("split_type, started_at")
      .eq("user_id", userId)
      .gte("started_at", since)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false });

    const recentSplits = (sessions || []).map((s) => ({
      split: s.split_type,
      date: format(new Date(s.started_at), "yyyy-MM-dd"),
    }));

    // Get user settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("preferred_split, training_days_per_week")
      .eq("user_id", userId)
      .single();

    return JSON.stringify({
      recent_training: recentSplits,
      preferred_split: settings?.preferred_split || "ppl",
      training_days_per_week: settings?.training_days_per_week || 5,
      requested_focus: input.focus || null,
      instruction: "Based on this data, suggest what the user should train today. Include specific exercises with sets and reps.",
    });
  },
};

// Export all tools
export const AI_TOOLS: AITool[] = [
  getRecentWorkouts,
  getNutritionSummary,
  getExerciseHistory,
  getActiveProgram,
  getPlateauStatus,
  getGoals,
  logFood,
  createWorkoutSuggestion,
];

export const TOOL_DEFINITIONS: Anthropic.Tool[] = AI_TOOLS.map((t) => t.definition);

export function findTool(name: string): AITool | undefined {
  return AI_TOOLS.find((t) => t.definition.name === name);
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/lib/ai/tools.ts
git commit -m "feat(ai): add 8 AI tools for data queries and food logging"
```

---

## Task 5: Create food parser helper

**Files:**
- Create: `src/lib/ai/food-parser.ts`

**Step 1: Create the food parser module**

This is a thin wrapper that takes a natural language food description, calls the Claude API with the `log_food` tool forced, and returns structured items. Used by the QuickFoodLog component.

```typescript
import type { ParsedFoodItem } from "@/types";

export interface FoodParseResult {
  items: ParsedFoodItem[];
  error?: string;
}

// Client-side function to call the AI food parsing endpoint
export async function parseFood(description: string): Promise<FoodParseResult> {
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Log this food: ${description}`,
          },
        ],
        mode: "food_parse",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { items: [], error: text || "Failed to parse food" };
    }

    const data = await response.json();
    return { items: data.items || [], error: data.error };
  } catch {
    return { items: [], error: "AI service unavailable" };
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/lib/ai/food-parser.ts
git commit -m "feat(ai): add food parser client helper"
```

---

## Task 6: Create streaming chat API route

**Files:**
- Create: `src/app/api/ai/chat/route.ts`

**Step 1: Create the API route**

This is the main server-side endpoint. It handles two modes:
1. **chat** (default): Streams responses with tool use loop
2. **food_parse**: Non-streaming, returns structured food items

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { TOOL_DEFINITIONS, findTool } from "@/lib/ai/tools";

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
  // Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return new Response("Rate limit exceeded. Try again in a minute.", { status: 429 });
  }

  // Parse body
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
    const [settingsResult, streakResult, weekResult, enrollmentResult] = await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      // Streak: count consecutive workout days
      supabase
        .from("workout_sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(90),
      // Week summary
      supabase
        .from("workout_sessions")
        .select("id, started_at")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      // Active enrollment
      supabase
        .from("program_enrollments")
        .select("*, program:training_programs(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single(),
    ]);

    // Compute streak from sessions
    const { subDays, format } = await import("date-fns");
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
    const weekSessionIds = (weekResult.data || []).map((s: { id: string }) => s.id);
    let totalVolume = 0;
    let totalSets = 0;
    if (weekSessionIds.length > 0) {
      const { data: weekSets } = await supabase
        .from("workout_sets")
        .select("weight, reps")
        .in("session_id", weekSessionIds);
      totalVolume = (weekSets || []).reduce((sum: number, s: { weight: number; reps: number }) => sum + s.weight * s.reps, 0);
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
        system: systemPrompt + "\n\nThe user wants to log food. Parse their description into structured nutrition items using the log_food tool. Estimate reasonable macro values based on standard serving sizes.",
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
          const result = await tool.execute(toolUse.input as Record<string, unknown>, supabase, user.id);
          return Response.json(JSON.parse(result));
        }
      }

      return Response.json({ items: [], error: "Could not parse food items" });
    } catch (err) {
      console.error("Food parse error:", err);
      return Response.json({ items: [], error: "AI service error" }, { status: 500 });
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

        // Tool use loop (max 5 iterations to prevent infinite loops)
        for (let iteration = 0; iteration < 5; iteration++) {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 2048,
            system: systemPrompt,
            messages: currentMessages,
            tools: TOOL_DEFINITIONS,
          });

          // Process content blocks
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
                  result = await tool.execute(block.input as Record<string, unknown>, supabase, user.id);
                } catch (err) {
                  result = JSON.stringify({ error: `Tool execution failed: ${err}` });
                }
              } else {
                result = JSON.stringify({ error: `Unknown tool: ${block.name}` });
              }

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });

              // Send food parse results as a special marker for the client
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
        controller.enqueue(encoder.encode("Sorry, I encountered an error. Please try again."));
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
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat(ai): add streaming chat API route with tool use loop"
```

---

## Task 7: Create insights API route

**Files:**
- Create: `src/app/api/ai/insights/route.ts`

**Step 1: Create the insights endpoint**

This endpoint gathers user stats and uses Haiku to generate 2-3 short insight strings.

```typescript
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
    // Gather stats in parallel
    const today = format(new Date(), "yyyy-MM-dd");
    const weekAgo = subDays(new Date(), 7).toISOString();

    const [settingsResult, weekSessions, todayNutrition, recentPRs] = await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
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
        .select("weight, reps, exercise:exercises(name), session:workout_sessions!inner(user_id)")
        .eq("is_pr", true)
        .eq("workout_sessions.user_id", user.id)
        .gte("logged_at", weekAgo)
        .limit(5),
    ]);

    const settings = settingsResult.data;
    const sessions = weekSessions.data || [];
    const todayEntries = todayNutrition.data || [];
    const prs = recentPRs.data || [];

    const todayCals = todayEntries.reduce((s, e) => s + (e.calories || 0), 0);
    const todayProtein = todayEntries.reduce((s, e) => s + (e.protein_g || 0), 0);

    const statsText = [
      `Workouts this week: ${sessions.length}`,
      `Target: ${settings?.training_days_per_week || 5} days/week`,
      `Today's calories: ${todayCals} / ${settings?.daily_calorie_target || 2500}`,
      `Today's protein: ${todayProtein}g / ${settings?.protein_target_g || 180}g`,
      `Recent PRs: ${prs.length > 0 ? prs.map((p) => (p.exercise as { name: string } | null)?.name || "").join(", ") : "None this week"}`,
    ].join("\n");

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "Generate 2-3 brief, actionable fitness insights based on the user's stats. Each insight should be 1 sentence. Be specific and reference their actual numbers. Return ONLY a JSON array of objects with 'text', 'category' (training|nutrition|recovery), and 'icon' (Dumbbell|Apple|Moon) fields.",
      messages: [{ role: "user", content: statsText }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return Response.json({
      insights: insights.map((i: Record<string, string>, idx: number) => ({
        id: `insight-${idx}`,
        text: i.text,
        category: i.category || "training",
        icon: i.icon || "Dumbbell",
      })),
    });
  } catch (err) {
    console.error("Insights error:", err);
    return Response.json({ insights: [] });
  }
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/app/api/ai/insights/route.ts
git commit -m "feat(ai): add insights API route with Haiku model"
```

---

## Task 8: Create chat message component

**Files:**
- Create: `src/components/ai/chat-message.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : ""
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-zinc-800"
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-zinc-800 text-zinc-100 rounded-tl-sm"
        )}
      >
        <div className="prose prose-invert prose-sm max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
          {message.content.split("\n").map((line, i) => (
            <p key={i}>{line || "\u00A0"}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ai/chat-message.tsx
git commit -m "feat(ai): add chat message bubble component"
```

---

## Task 9: Create chat interface component

**Files:**
- Create: `src/components/ai/chat-interface.tsx`

**Step 1: Create the full chat interface**

This is the main chat UI with streaming support, message history, and food item parsing.

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import { Loader2, Send, Check } from "lucide-react";
import { toast } from "sonner";
import { addNutritionEntry } from "@/lib/database/nutrition";
import { format } from "date-fns";
import { v4 as uuid } from "uuid";
import type { ChatMessage as ChatMessageType, ParsedFoodItem } from "@/types";

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingFoodItems, setPendingFoodItems] = useState<ParsedFoodItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessageType = {
      id: uuid(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const allMessages = [...messages, userMessage];
    setMessages(allMessages);
    setInput("");
    setIsStreaming(true);

    // Create placeholder for assistant response
    const assistantId = uuid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          mode: "chat",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: errorText || "Something went wrong." } : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Check for food items marker
        const foodMatch = fullText.match(/<!--FOOD_ITEMS:(.*?)-->/);
        if (foodMatch) {
          try {
            const parsed = JSON.parse(foodMatch[1]);
            if (parsed.action === "confirm_food_log" && parsed.items?.length) {
              setPendingFoodItems(parsed.items);
            }
          } catch {
            // ignore parse errors
          }
          // Remove the marker from displayed text
          fullText = fullText.replace(/<!--FOOD_ITEMS:.*?-->/, "");
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: fullText.trim() } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, the AI coach is unavailable right now." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }, [input, isStreaming, messages]);

  async function handleConfirmFood() {
    if (!pendingFoodItems.length) return;

    const today = format(new Date(), "yyyy-MM-dd");
    try {
      for (const item of pendingFoodItems) {
        await addNutritionEntry({
          date: today,
          meal_name: item.meal_name,
          food_item: item.food_item,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fats_g: item.fats_g,
          quantity_note: item.quantity_note,
        });
      }
      toast.success(`Logged ${pendingFoodItems.length} food item${pendingFoodItems.length > 1 ? "s" : ""}`);
      setPendingFoodItems([]);
    } catch {
      toast.error("Failed to log food items");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="size-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <span className="text-2xl">💪</span>
            </div>
            <h2 className="text-lg font-semibold">BuffCoach</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Your AI training coach. Ask about your progress, get workout
              suggestions, or log food with natural language.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                "How's my training this week?",
                "What should I work on today?",
                "Log: chicken breast with rice",
                "Am I hitting my protein goals?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-muted-foreground hover:bg-zinc-800 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}

        {/* Streaming indicator */}
        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-3 px-4 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-2.5 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Food confirmation card */}
      {pendingFoodItems.length > 0 && (
        <Card className="mx-4 mb-2 border-primary/30">
          <CardContent className="py-3 space-y-2">
            <p className="text-sm font-medium">Confirm food log:</p>
            {pendingFoodItems.map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-muted-foreground">
                <span>{item.quantity_note} {item.food_item}</span>
                <span>{item.calories} cal | {item.protein_g}g P</span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="gap-1" onClick={handleConfirmFood}>
                <Check className="size-3" /> Log Items
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingFoodItems([])}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input area */}
      <div className="border-t border-zinc-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach anything..."
            className="flex-1"
            disabled={isStreaming}
          />
          <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/components/ai/chat-interface.tsx
git commit -m "feat(ai): add chat interface with streaming and food confirmation"
```

---

## Task 10: Create coach page

**Files:**
- Create: `src/app/(app)/coach/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { ChatInterface } from "@/components/ai/chat-interface";

export default function CoachPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <ChatInterface />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/coach/page.tsx
git commit -m "feat(ai): add coach chat page"
```

---

## Task 11: Create quick food log component

**Files:**
- Create: `src/components/ai/quick-food-log.tsx`

**Step 1: Create the component**

This is a compact input that appears on the nutrition page for natural language food logging.

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Check, Loader2, Sparkles, X } from "lucide-react";
import { parseFood } from "@/lib/ai/food-parser";
import { addNutritionEntry } from "@/lib/database/nutrition";
import { format } from "date-fns";
import { toast } from "sonner";
import type { ParsedFoodItem } from "@/types";

interface QuickFoodLogProps {
  date: string;
  onLogged: () => void;
}

export function QuickFoodLog({ date, onLogged }: QuickFoodLogProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParsedFoodItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);

    const result = await parseFood(input);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.items.length === 0) {
      setError("Could not identify any food items");
      return;
    }

    setItems(result.items);
  }

  async function handleConfirm() {
    try {
      for (const item of items) {
        await addNutritionEntry({
          date,
          meal_name: item.meal_name,
          food_item: item.food_item,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fats_g: item.fats_g,
          quantity_note: item.quantity_note,
        });
      }
      toast.success(`Logged ${items.length} item${items.length > 1 ? "s" : ""} with AI`);
      setItems([]);
      setInput("");
      onLogged();
    } catch {
      toast.error("Failed to log items");
    }
  }

  function handleCancel() {
    setItems([]);
    setError(null);
  }

  // Show confirmation card if items are parsed
  if (items.length > 0) {
    return (
      <Card className="border-primary/30">
        <CardContent className="py-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Bot className="size-4" /> AI parsed {items.length} item{items.length > 1 ? "s" : ""}:
          </p>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {item.quantity_note} {item.food_item}
              </span>
              <span className="tabular-nums">
                {item.calories} cal | {item.protein_g}P / {item.carbs_g}C / {item.fats_g}F
              </span>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="gap-1" onClick={handleConfirm}>
              <Check className="size-3" /> Log All
            </Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={handleCancel}>
              <X className="size-3" /> Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleParse();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you ate..."
            className="pl-9"
            disabled={loading}
          />
        </div>
        <Button type="submit" size="sm" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Parse"}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ai/quick-food-log.tsx
git commit -m "feat(ai): add quick food log component with natural language parsing"
```

---

## Task 12: Create insight card component

**Files:**
- Create: `src/components/ai/insight-card.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell, Apple, Moon, Sparkles } from "lucide-react";
import type { AIInsight } from "@/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Dumbbell,
  Apple,
  Moon,
};

export function InsightCards() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/ai/insights")
      .then((r) => (r.ok ? r.json() : { insights: [] }))
      .then((data) => setInsights(data.insights || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || insights.length === 0) return null;

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="size-3" /> AI Insights
        </p>
        {insights.map((insight) => {
          const Icon = ICON_MAP[insight.icon] || Dumbbell;
          return (
            <div key={insight.id} className="flex items-start gap-2 text-sm">
              <Icon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span>{insight.text}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ai/insight-card.tsx
git commit -m "feat(ai): add dashboard insight cards component"
```

---

## Task 13: Create post-workout summary component

**Files:**
- Create: `src/components/ai/post-workout-summary.tsx`

**Step 1: Create the component**

This component fetches an AI-generated summary after a workout ends. It receives the session data and sends it to the chat API for a one-shot summary.

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Loader2 } from "lucide-react";
import type { WorkoutSet } from "@/types";

interface PostWorkoutSummaryProps {
  sessionId: string;
  totalSets: number;
  totalVolume: number;
  exerciseCount: number;
  elapsedSeconds: number;
  sets: WorkoutSet[];
}

export function PostWorkoutSummary({
  totalSets,
  totalVolume,
  exerciseCount,
  elapsedSeconds,
  sets,
}: PostWorkoutSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prCount = sets.filter((s) => s.is_pr).length;
    const durationMin = Math.round(elapsedSeconds / 60);

    const prompt = `Give a brief, encouraging 2-3 sentence post-workout summary. Stats: ${totalSets} sets across ${exerciseCount} exercises, ${totalVolume.toLocaleString()} lbs total volume, ${durationMin} minutes, ${prCount} new PR${prCount !== 1 ? "s" : ""}. Keep it motivational and specific to their numbers.`;

    fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        mode: "chat",
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const reader = r.body?.getReader();
        if (!reader) throw new Error();
        const decoder = new TextDecoder();
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setSummary(text.trim());
        }
      })
      .catch(() => {
        setSummary(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loading && !summary) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="py-3">
        <div className="flex items-start gap-2">
          <Bot className="size-4 mt-0.5 shrink-0 text-primary" />
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Generating summary...
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{summary}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ai/post-workout-summary.tsx
git commit -m "feat(ai): add post-workout AI summary component"
```

---

## Task 14: Add Coach to navigation

**Files:**
- Modify: `src/components/layout/sidebar-nav.tsx` (line 6, line 16)
- Modify: `src/components/layout/bottom-nav.tsx` (line 6, line 14)

**Step 1: Update sidebar nav**

In `src/components/layout/sidebar-nav.tsx`:

On line 6, add `Bot` to the lucide-react import:
```typescript
import { Home, Dumbbell, BookOpen, Apple, BarChart3, Settings, LogOut, Bot } from "lucide-react";
```

On line 16, add the Coach nav item before Settings:
```typescript
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
```

**Step 2: Update bottom nav**

In `src/components/layout/bottom-nav.tsx`:

On line 6, add `Bot` to the lucide-react import:
```typescript
import { Home, Dumbbell, BookOpen, Apple, Users, BarChart3, Bot } from "lucide-react";
```

Replace the `Community` tab with `Coach` on line 13 (keeping 6 tabs total for layout consistency):
```typescript
  { href: "/coach", label: "Coach", icon: Bot },
```

Wait — actually, Community is an important tab. Let's keep Community and add Coach. But 7 bottom tabs would be too crowded. Instead, let's replace the Exercises tab in bottom nav (it's accessible from the sidebar on desktop, and less frequently used on mobile):

Actually, let's keep it simple. Replace line 13 (`Community`) with Coach since the community page is accessible from the sidebar. On mobile, Coach is more useful day-to-day than Community:

```typescript
  { href: "/coach", label: "Coach", icon: Bot },
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/components/layout/sidebar-nav.tsx src/components/layout/bottom-nav.tsx
git commit -m "feat(ai): add Coach to sidebar and bottom navigation"
```

---

## Task 15: Add insight cards to dashboard

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Step 1: Add the InsightCards import and component**

Add import after line 9 (BadgesDisplay import):
```typescript
import { InsightCards } from "@/components/ai/insight-card";
```

Add `<InsightCards />` right after the `<ActiveProgramCard />` component (after line 86), before `<TodayWorkout />`:
```typescript
      <InsightCards />
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/app/(app)/page.tsx
git commit -m "feat(ai): add AI insight cards to dashboard"
```

---

## Task 16: Add quick food log to nutrition page

**Files:**
- Modify: `src/app/(app)/nutrition/page.tsx`

**Step 1: Add import**

After line 38 (the `toast` import), add:
```typescript
import { QuickFoodLog } from "@/components/ai/quick-food-log";
```

**Step 2: Add the QuickFoodLog component**

After the "Add Food" dialog (after line 276, before the `{/* Fasting streak + Meal plan actions */}` comment on line 278), add:
```typescript
      {/* AI Quick Food Log */}
      <QuickFoodLog date={date} onLogged={loadData} />
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/app/(app)/nutrition/page.tsx
git commit -m "feat(ai): add AI quick food log to nutrition page"
```

---

## Task 17: Add post-workout summary to active workout

**Files:**
- Modify: `src/components/workout/active-workout.tsx`

**Step 1: Add import**

After line 36 (the types import), add:
```typescript
import { PostWorkoutSummary } from "@/components/ai/post-workout-summary";
```

**Step 2: Add state and display**

Add a `showSummary` state after line 74 (the `isFinishing` state):
```typescript
  const [showSummary, setShowSummary] = useState(false);
```

In the `handleFinishWorkout` callback (around line 196-211), modify to show the summary before navigating. Replace the existing `handleFinishWorkout`:

```typescript
  const handleFinishWorkout = useCallback(async () => {
    setIsFinishing(true);
    try {
      await endWorkoutSession(session.id);
      toast.success("Workout complete!", {
        description: `${totalSets} sets, ${totalVolume.toLocaleString()} lbs total volume`,
      });
      setShowSummary(true);
    } catch (err) {
      console.error("Failed to end session:", err);
      toast.error("Failed to end workout");
    } finally {
      setIsFinishing(false);
      setShowFinishDialog(false);
    }
  }, [session.id, totalSets, totalVolume]);
```

**Step 3: Add summary display**

After the finish confirmation dialog (before the closing `</div>` on line 365), add:
```typescript
      {/* Post-workout AI Summary */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 p-4">
          <div className="w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-center">Workout Complete!</h2>
            <div className="text-center text-sm text-muted-foreground">
              <p>{totalSets} sets | {uniqueExercises} exercises | {totalVolume.toLocaleString()} lbs</p>
              <p>{formatElapsed(elapsedSeconds)}</p>
            </div>
            <PostWorkoutSummary
              sessionId={session.id}
              totalSets={totalSets}
              totalVolume={totalVolume}
              exerciseCount={uniqueExercises}
              elapsedSeconds={elapsedSeconds}
              sets={sets}
            />
            <Button className="w-full" onClick={() => router.push("/workout")}>
              Done
            </Button>
          </div>
        </div>
      )}
```

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/components/workout/active-workout.tsx
git commit -m "feat(ai): add post-workout AI summary to active workout"
```

---

## Task 18: Lint and build verification

**Files:** None (verification only)

**Step 1: Run lint on all new/modified files**

```bash
npx eslint src/lib/ai/ src/components/ai/ src/app/api/ai/ src/app/\(app\)/coach/ src/components/layout/sidebar-nav.tsx src/components/layout/bottom-nav.tsx src/app/\(app\)/page.tsx src/app/\(app\)/nutrition/page.tsx src/components/workout/active-workout.tsx src/types/database.ts
```

Expected: Only pre-existing warnings (no new errors)

**Step 2: Fix any lint issues found**

If there are new errors, fix them. Common issues:
- Unused imports (remove them)
- Missing return types (add them)
- `any` types (use proper types)

**Step 3: Run full build (SSR)**

```bash
npm run build
```

Expected: Build succeeds with all routes

**Step 4: Run Capacitor build (static export)**

```bash
npm run build:cap
```

Expected: Build succeeds. The `/api/ai/*` routes are NOT included in static export (that's correct — they only run on Vercel).

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and build issues for Phase 16"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | AI types | — | `database.ts` |
| 2 | Install SDK | — | `package.json` |
| 3 | System prompt builder | `system-prompt.ts` | — |
| 4 | AI tools module | `tools.ts` | — |
| 5 | Food parser helper | `food-parser.ts` | — |
| 6 | Chat API route | `api/ai/chat/route.ts` | — |
| 7 | Insights API route | `api/ai/insights/route.ts` | — |
| 8 | Chat message component | `chat-message.tsx` | — |
| 9 | Chat interface | `chat-interface.tsx` | — |
| 10 | Coach page | `coach/page.tsx` | — |
| 11 | Quick food log | `quick-food-log.tsx` | — |
| 12 | Insight card | `insight-card.tsx` | — |
| 13 | Post-workout summary | `post-workout-summary.tsx` | — |
| 14 | Nav integration | — | `sidebar-nav.tsx`, `bottom-nav.tsx` |
| 15 | Dashboard integration | — | `page.tsx` (dashboard) |
| 16 | Nutrition integration | — | `nutrition/page.tsx` |
| 17 | Workout integration | — | `active-workout.tsx` |
| 18 | Lint & build | — | — |

**Total: 11 new files, 7 modified files, 18 tasks**

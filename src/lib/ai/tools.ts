import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays } from "date-fns";

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

    if (!sessions?.length)
      return JSON.stringify({
        sessions: [],
        message: "No workouts in this period",
      });

    const sessionIds = sessions.map((s) => s.id);
    const { data: sets } = await supabase
      .from("workout_sets")
      .select(
        "session_id, weight, reps, set_type, is_pr, exercise:exercises(name, primary_muscle_group)"
      )
      .in("session_id", sessionIds)
      .order("logged_at", { ascending: true });

    const result = sessions.map((s) => ({
      date: format(new Date(s.started_at), "yyyy-MM-dd"),
      split: s.split_type,
      notes: s.notes,
      sets: (sets || [])
        .filter((set) => set.session_id === s.id)
        .map((set) => ({
          exercise:
            (set.exercise as { name: string } | null)?.name || "Unknown",
          muscle: (
            set.exercise as { primary_muscle_group: string } | null
          )?.primary_muscle_group,
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

    const { data: todayEntries } = await supabase
      .from("nutrition_entries")
      .select("calories, protein_g, carbs_g, fats_g")
      .eq("user_id", userId)
      .eq("date", today);

    const todayTotals = (todayEntries || []).reduce(
      (acc: { calories: number; protein_g: number; carbs_g: number; fats_g: number }, e: { calories: number; protein_g: number; carbs_g: number; fats_g: number }) => ({
        calories: acc.calories + (e.calories || 0),
        protein_g: acc.protein_g + (e.protein_g || 0),
        carbs_g: acc.carbs_g + (e.carbs_g || 0),
        fats_g: acc.fats_g + (e.fats_g || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
    );

    const { data: settings } = await supabase
      .from("user_settings")
      .select(
        "daily_calorie_target, protein_target_g, carbs_target_g, fats_target_g"
      )
      .eq("user_id", userId)
      .single();

    const result: Record<string, unknown> = {
      today: todayTotals,
      targets: settings || {
        daily_calorie_target: 2500,
        protein_target_g: 180,
        carbs_target_g: 250,
        fats_target_g: 80,
      },
    };

    if (input.include_week) {
      const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const { data: weekEntries } = await supabase
        .from("nutrition_entries")
        .select("calories, protein_g, carbs_g, fats_g, date")
        .eq("user_id", userId)
        .gte("date", weekStart)
        .lte("date", today);

      const days = new Set(
        (weekEntries || []).map((e: { date: string }) => e.date)
      );
      const weekTotals = (weekEntries || []).reduce(
        (acc: { calories: number; protein_g: number; carbs_g: number; fats_g: number }, e: { calories: number; protein_g: number; carbs_g: number; fats_g: number }) => ({
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

    const { data: exercises } = await supabase
      .from("exercises")
      .select("id, name")
      .ilike("name", `%${name}%`)
      .limit(5);

    if (!exercises?.length)
      return JSON.stringify({
        error: `No exercise found matching "${name}"`,
      });

    const exercise = exercises[0];
    const since = subDays(new Date(), 90).toISOString();

    const { data: sets } = await supabase
      .from("workout_sets")
      .select(
        "weight, reps, logged_at, is_pr, session:workout_sessions!inner(user_id)"
      )
      .eq("exercise_id", exercise.id)
      .eq("workout_sessions.user_id", userId)
      .gte("logged_at", since)
      .eq("set_type", "working")
      .order("logged_at", { ascending: true });

    const byDate = new Map<
      string,
      { weight: number; reps: number; isPR: boolean }
    >();
    for (const set of sets || []) {
      const dateKey = format(new Date(set.logged_at), "yyyy-MM-dd");
      const existing = byDate.get(dateKey);
      if (!existing || set.weight > existing.weight) {
        byDate.set(dateKey, {
          weight: set.weight,
          reps: set.reps,
          isPR: set.is_pr,
        });
      }
    }

    return JSON.stringify({
      exercise: exercise.name,
      progression: Array.from(byDate.entries()).map(([date, data]) => ({
        date,
        ...data,
      })),
      totalSessions: byDate.size,
    });
  },
};

// --- get_active_program ---
const getActiveProgram: AITool = {
  definition: {
    name: "get_active_program",
    description:
      "Get the user's currently active training program enrollment and progress.",
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

    if (!enrollment)
      return JSON.stringify({ enrolled: false, message: "No active program" });

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
    description:
      "Check if the user has any exercise plateaus or regressions detected.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  async execute(_input, supabase, userId) {
    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("id, started_at")
      .eq("user_id", userId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(5);

    if (!sessions?.length)
      return JSON.stringify({ plateaus: [], message: "Not enough data" });

    const sessionIds = sessions.map((s) => s.id);
    const { data: sets } = await supabase
      .from("workout_sets")
      .select(
        "exercise_id, weight, reps, session_id, exercise:exercises(name, primary_muscle_group)"
      )
      .in("session_id", sessionIds)
      .eq("set_type", "working");

    // Group by exercise, find best set per session
    const byExercise = new Map<
      string,
      Array<{ sessionId: string; weight: number; reps: number; name: string; muscle: string }>
    >();
    for (const set of sets || []) {
      const key = set.exercise_id;
      if (!byExercise.has(key)) byExercise.set(key, []);
      const arr = byExercise.get(key)!;
      const existing = arr.find((s) => s.sessionId === set.session_id);
      const name =
        (set.exercise as { name: string } | null)?.name || "Unknown";
      const muscle =
        (set.exercise as { primary_muscle_group: string } | null)
          ?.primary_muscle_group || "unknown";
      if (!existing) {
        arr.push({
          sessionId: set.session_id,
          weight: set.weight,
          reps: set.reps,
          name,
          muscle,
        });
      } else if (set.weight > existing.weight) {
        existing.weight = set.weight;
        existing.reps = set.reps;
      }
    }

    const plateaus: Array<{
      exercise: string;
      muscle: string;
      type: string;
      sessions: number;
    }> = [];
    for (const [, entries] of byExercise) {
      if (entries.length < 2) continue;
      const isStalled = entries
        .slice(0, 3)
        .every(
          (e) =>
            e.weight === entries[0].weight && e.reps === entries[0].reps
        );
      if (isStalled) {
        plateaus.push({
          exercise: entries[0].name,
          muscle: entries[0].muscle,
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
    description:
      "Get the user's active fitness goals and their current progress.",
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
      goals: (goals || []).map(
        (g: {
          title: string;
          type: string;
          target_value: number | null;
          current_value: number;
          target_date: string | null;
        }) => ({
          title: g.title,
          type: g.type,
          target: g.target_value,
          current: g.current_value,
          progress: g.target_value
            ? Math.round((g.current_value / g.target_value) * 100)
            : null,
          target_date: g.target_date,
        })
      ),
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
              food_item: {
                type: "string",
                description: "Name of the food item",
              },
              meal_name: {
                type: "string",
                description:
                  "Meal category: Breakfast, Lunch, Dinner, Snack, or Post-workout",
              },
              calories: {
                type: "number",
                description: "Estimated calories",
              },
              protein_g: {
                type: "number",
                description: "Estimated protein in grams",
              },
              carbs_g: {
                type: "number",
                description: "Estimated carbs in grams",
              },
              fats_g: {
                type: "number",
                description: "Estimated fats in grams",
              },
              quantity_note: {
                type: "string",
                description:
                  "Portion description (e.g., '1 medium breast', '2 cups')",
              },
            },
            required: [
              "food_item",
              "meal_name",
              "calories",
              "protein_g",
              "carbs_g",
              "fats_g",
              "quantity_note",
            ],
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
          description:
            "Optional muscle group or split focus (e.g., 'chest', 'pull', 'legs')",
        },
      },
      required: [],
    },
  },
  async execute(input, supabase, userId) {
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
      instruction:
        "Based on this data, suggest what the user should train today. Include specific exercises with sets and reps.",
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

export const TOOL_DEFINITIONS: Anthropic.Tool[] = AI_TOOLS.map(
  (t) => t.definition
);

export function findTool(name: string): AITool | undefined {
  return AI_TOOLS.find((t) => t.definition.name === name);
}

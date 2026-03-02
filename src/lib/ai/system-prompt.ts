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

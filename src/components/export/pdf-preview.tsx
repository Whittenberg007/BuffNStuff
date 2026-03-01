"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSettings } from "@/lib/database/settings";
import { getFastingSettings, getFastingStreak } from "@/lib/database/fasting";
import type { ReportData } from "@/lib/export/pdf-report";
import { downloadOrShareBlob } from "@/lib/export/file-utils";
import { toast } from "sonner";

interface PDFPreviewProps {
  startDate: string;
  endDate: string;
}

async function gatherReportData(startDate: string, endDate: string): Promise<ReportData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const settings = await getSettings();

  // Fetch workout sessions + sets
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at, split_type")
    .eq("user_id", user.id)
    .gte("started_at", `${startDate}T00:00:00`)
    .lte("started_at", `${endDate}T23:59:59`)
    .not("ended_at", "is", null);

  const sessionIds = sessions?.map((s) => s.id) || [];
  type WorkoutSet = { session_id: string; weight: number; reps: number; is_pr: boolean; exercise: unknown };

  let allSets: WorkoutSet[] = [];
  if (sessionIds.length) {
    const { data } = await supabase
      .from("workout_sets")
      .select("session_id, weight, reps, is_pr, exercise:exercises(name)")
      .in("session_id", sessionIds);
    allSets = (data || []) as WorkoutSet[];
  }

  const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const prsHit = allSets.filter((s) => s.is_pr).length;

  // Build workout log (top set per exercise per session)
  const workoutLog: ReportData["workoutLog"] = [];
  const sessionMap = new Map((sessions || []).map((s) => [s.id, s]));
  const grouped = new Map<string, WorkoutSet[]>();
  for (const set of allSets) {
    const key = `${set.session_id}-${(set.exercise as { name: string } | null)?.name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(set);
  }
  for (const [, sets] of grouped) {
    const best = sets.reduce((a, b) => (a.weight * a.reps > b.weight * b.reps ? a : b));
    const session = sessionMap.get(best.session_id);
    workoutLog.push({
      date: session?.started_at?.split("T")[0] || "",
      split: session?.split_type || "",
      exercise: (best.exercise as { name: string } | null)?.name || "",
      topSet: `${best.weight} × ${best.reps}`,
    });
  }

  // Fetch nutrition
  const { data: nutritionEntries } = await supabase
    .from("nutrition_entries")
    .select("date, calories, protein_g, carbs_g, fats_g")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate);

  const uniqueDays = new Set((nutritionEntries || []).map((e) => e.date));
  const dayCount = uniqueDays.size || 1;
  const totalCal = (nutritionEntries || []).reduce((s, e) => s + e.calories, 0);
  const totalPro = (nutritionEntries || []).reduce((s, e) => s + e.protein_g, 0);
  const totalCarb = (nutritionEntries || []).reduce((s, e) => s + e.carbs_g, 0);
  const totalFat = (nutritionEntries || []).reduce((s, e) => s + e.fats_g, 0);

  // Fetch weight
  const { data: weightEntries } = await supabase
    .from("weight_entries")
    .select("date, weight")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  const weightData = (weightEntries || []).map((w) => ({ date: w.date, weight: w.weight }));
  const weightChange =
    weightData.length >= 2
      ? `${(weightData[weightData.length - 1].weight - weightData[0].weight).toFixed(1)} lbs`
      : "N/A";

  // Fetch fasting
  const fastingSettings = await getFastingSettings();
  const { data: fastingLogs } = await supabase
    .from("fasting_log")
    .select("hit_target")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate);

  const fastingTotal = fastingLogs?.length || 0;
  const fastingHit = fastingLogs?.filter((l) => l.hit_target).length || 0;
  const fastingStreak = await getFastingStreak();

  // Fetch goals
  const { data: goals } = await supabase
    .from("goals")
    .select("title, type, target_value, current_value, status")
    .eq("user_id", user.id);

  return {
    userName: settings?.display_name || "",
    startDate,
    endDate,
    summary: {
      workoutsCompleted: sessions?.length || 0,
      totalVolume,
      totalSets: allSets?.length || 0,
      avgDailyCalories: Math.round(totalCal / dayCount),
      weightChange,
      prsHit,
    },
    workoutLog,
    nutritionAvg: {
      calories: Math.round(totalCal / dayCount),
      protein: Math.round(totalPro / dayCount),
      carbs: Math.round(totalCarb / dayCount),
      fats: Math.round(totalFat / dayCount),
    },
    nutritionTargets: {
      calories: settings?.daily_calorie_target || 2500,
      protein: settings?.protein_target_g || 180,
      carbs: settings?.carbs_target_g || 280,
      fats: settings?.fats_target_g || 80,
    },
    weightData,
    fastingAdherence: {
      percentage: fastingTotal > 0 ? Math.round((fastingHit / fastingTotal) * 100) : 0,
      streak: fastingStreak,
      protocol: fastingSettings?.protocol || "Not configured",
    },
    goals: (goals || []).map((g) => ({
      title: g.title,
      type: g.type,
      progress: g.target_value ? Math.round((g.current_value / g.target_value) * 100) : 0,
      status: g.status,
    })),
  };
}

export function PDFDownloadButton({ startDate, endDate }: PDFPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const data = await gatherReportData(startDate, endDate);

      // Dynamic import to avoid SSR issues with @react-pdf/renderer
      const { pdf } = await import("@react-pdf/renderer");
      const { ProgressReport } = await import("@/lib/export/pdf-report");

      const blob = await pdf(<ProgressReport data={data} />).toBlob();
      const filename = `buffnstuff-report-${startDate}-to-${endDate}.pdf`;

      await downloadOrShareBlob({ filename, blob });
      toast.success("PDF report downloaded!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button onClick={handleDownload} disabled={isGenerating} className="gap-2">
      {isGenerating ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      {isGenerating ? "Generating..." : "Download PDF Report"}
    </Button>
  );
}

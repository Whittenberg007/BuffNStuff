"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getWeeklySummary } from "@/lib/database/stats";
import { getRecentCheckins } from "@/lib/database/recovery";
import { getSettings } from "@/lib/database/settings";
import { getDailyTotals } from "@/lib/database/nutrition";
import { format, subDays } from "date-fns";

interface RecoveryData {
  score: number;
  suggestion: string;
  factors: {
    label: string;
    value: string;
    status: "good" | "moderate" | "poor";
  }[];
}

function computeRecoveryScore(params: {
  daysThisWeek: number;
  targetDays: number;
  avgCalories: number;
  targetCalories: number;
  recentReadiness: number[];
}): RecoveryData {
  const factors: RecoveryData["factors"] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  // Factor 1: Training frequency (20%)
  const freqRatio = params.targetDays > 0
    ? params.daysThisWeek / params.targetDays
    : 0;
  let freqScore: number;
  if (freqRatio >= 0.8 && freqRatio <= 1.2) {
    freqScore = 100;
  } else if (freqRatio < 0.8) {
    freqScore = (freqRatio / 0.8) * 100;
  } else {
    freqScore = Math.max(0, 100 - (freqRatio - 1.2) * 200);
  }
  factors.push({
    label: "Frequency",
    value: `${params.daysThisWeek}/${params.targetDays} days`,
    status: freqScore >= 70 ? "good" : freqScore >= 40 ? "moderate" : "poor",
  });
  weightedSum += freqScore * 20;
  totalWeight += 20;

  // Factor 2: Nutrition adherence (20%)
  if (params.targetCalories > 0 && params.avgCalories > 0) {
    const nutRatio = params.avgCalories / params.targetCalories;
    let nutScore: number;
    if (nutRatio >= 0.85 && nutRatio <= 1.15) {
      nutScore = 100;
    } else if (nutRatio < 0.85) {
      nutScore = (nutRatio / 0.85) * 100;
    } else {
      nutScore = Math.max(0, 100 - (nutRatio - 1.15) * 150);
    }
    factors.push({
      label: "Nutrition",
      value: `${Math.round(params.avgCalories)}/${params.targetCalories} cal`,
      status: nutScore >= 70 ? "good" : nutScore >= 40 ? "moderate" : "poor",
    });
    weightedSum += nutScore * 20;
    totalWeight += 20;
  }

  // Factor 3: Readiness trend (30%)
  if (params.recentReadiness.length > 0) {
    const avgReadiness =
      params.recentReadiness.reduce((a, b) => a + b, 0) / params.recentReadiness.length;
    const readinessScore = ((avgReadiness - 1) / 4) * 100;
    factors.push({
      label: "Readiness",
      value: `${avgReadiness.toFixed(1)}/5`,
      status: readinessScore >= 70 ? "good" : readinessScore >= 40 ? "moderate" : "poor",
    });
    weightedSum += readinessScore * 30;
    totalWeight += 30;
  }

  // Factor 4: Rest days (30%)
  const restDays = Math.max(0, 7 - params.daysThisWeek);
  const restScore = Math.min(100, (restDays / 3) * 100);
  factors.push({
    label: "Rest",
    value: `${restDays} rest day${restDays !== 1 ? "s" : ""}`,
    status: restScore >= 70 ? "good" : restScore >= 40 ? "moderate" : "poor",
  });
  weightedSum += restScore * 30;
  totalWeight += 30;

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  let suggestion: string;
  if (score >= 70) suggestion = "Go hard — you're well recovered";
  else if (score >= 40) suggestion = "Moderate day — listen to your body";
  else suggestion = "Consider a deload or rest day";

  return { score, suggestion, factors };
}

export function RecoveryScore() {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [weekly, settings, checkins] = await Promise.all([
          getWeeklySummary(),
          getSettings(),
          getRecentCheckins(7),
        ]);

        let totalCalories = 0;
        let daysWithData = 0;
        for (let i = 0; i < 7; i++) {
          const dateStr = format(subDays(new Date(), i), "yyyy-MM-dd");
          try {
            const totals = await getDailyTotals(dateStr);
            if (totals.calories > 0) {
              totalCalories += totals.calories;
              daysWithData++;
            }
          } catch {
            // Skip days with errors
          }
        }
        const avgCalories = daysWithData > 0 ? totalCalories / daysWithData : 0;

        const recentReadiness = checkins
          .map((c) => {
            const vals = [c.sleep_quality, c.soreness, c.energy].filter(
              (v): v is number => v !== null
            );
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          })
          .filter((v): v is number => v !== null)
          .slice(0, 3);

        const result = computeRecoveryScore({
          daysThisWeek: weekly.daysThisWeek,
          targetDays: settings.training_days_per_week,
          avgCalories,
          targetCalories: settings.daily_calorie_target,
          recentReadiness,
        });

        setData(result);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <Card className="py-4">
        <CardContent className="px-4">
          <div className="h-24 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const scoreColor =
    data.score >= 70
      ? "text-emerald-400"
      : data.score >= 40
        ? "text-yellow-400"
        : "text-red-400";

  const scoreBg =
    data.score >= 70
      ? "bg-emerald-400/10"
      : data.score >= 40
        ? "bg-yellow-400/10"
        : "bg-red-400/10";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="size-4" />
          Recovery Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex size-16 items-center justify-center rounded-full",
              scoreBg
            )}
          >
            <span className={cn("text-2xl font-bold tabular-nums", scoreColor)}>
              {data.score}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{data.suggestion}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on training, nutrition &amp; readiness
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {data.factors.map((factor) => (
            <div
              key={factor.label}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  factor.status === "good"
                    ? "bg-emerald-400"
                    : factor.status === "moderate"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                )}
              />
              <span className="text-muted-foreground">{factor.label}:</span>
              <span className="font-medium">{factor.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { subDays, format } from "date-fns";
import type { MuscleGroup } from "@/types";

const ALL_MUSCLES: { key: MuscleGroup; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "glutes", label: "Glutes" },
  { key: "calves", label: "Calves" },
  { key: "core", label: "Core" },
];

type FatigueLevel = "fresh" | "moderate" | "fatigued";

interface MuscleFatigue {
  muscle: MuscleGroup;
  label: string;
  level: FatigueLevel;
  daysAgo: number | null;
}

function getFatigueLevel(daysAgo: number | null): FatigueLevel {
  if (daysAgo === null) return "fresh";
  if (daysAgo === 0) return "fatigued";
  if (daysAgo <= 2) return "moderate";
  return "fresh";
}

function getFatigueStyle(level: FatigueLevel): string {
  switch (level) {
    case "fresh":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "moderate":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "fatigued":
      return "bg-red-500/15 text-red-400 border-red-500/30";
  }
}

export function MuscleFatigueMap() {
  const [muscles, setMuscles] = useState<MuscleFatigue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const since = format(subDays(new Date(), 7), "yyyy-MM-dd");

        const { data: sets } = await supabase
          .from("workout_sets")
          .select(
            "logged_at, exercise:exercises(primary_muscle_group), session:workout_sessions!inner(user_id)"
          )
          .eq("workout_sessions.user_id", user.id)
          .gte("logged_at", `${since}T00:00:00`);

        const lastTrained = new Map<string, string>();
        for (const set of sets || []) {
          const ex = Array.isArray(set.exercise) ? set.exercise[0] : set.exercise;
          const muscle = (ex as { primary_muscle_group: string } | null)?.primary_muscle_group;
          if (!muscle) continue;

          const dateStr = format(new Date(set.logged_at), "yyyy-MM-dd");
          const existing = lastTrained.get(muscle);
          if (!existing || dateStr > existing) {
            lastTrained.set(muscle, dateStr);
          }
        }

        const today = format(new Date(), "yyyy-MM-dd");
        const todayDate = new Date(today + "T00:00:00");
        const result: MuscleFatigue[] = ALL_MUSCLES.map(({ key, label }) => {
          const lastDate = lastTrained.get(key);
          const daysAgo = lastDate
            ? Math.floor(
                (todayDate.getTime() - new Date(lastDate + "T00:00:00").getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null;

          return {
            muscle: key,
            label,
            level: getFatigueLevel(daysAgo),
            daysAgo,
          };
        });

        setMuscles(result);
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
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4" />
          Muscle Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {muscles.map((m) => (
            <span
              key={m.muscle}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                getFatigueStyle(m.level)
              )}
              title={
                m.daysAgo === null
                  ? "Not trained recently"
                  : m.daysAgo === 0
                    ? "Trained today"
                    : `${m.daysAgo} day${m.daysAgo !== 1 ? "s" : ""} ago`
              }
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-400" /> Fresh (3+ days)
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-yellow-400" /> Moderate (1-2 days)
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-400" /> Today
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

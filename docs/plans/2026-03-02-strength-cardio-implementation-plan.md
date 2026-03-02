# Phase 20: Strength Standards & 1RM + Cardio & Timer Modes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add actual-1RM-based strength tracking with strength level classifications, cardio session logging, and EMOM/AMRAP timer modes.

**Architecture:** Strength features query existing `workout_sets` for actual rep maxes (no estimated 1RM). Cardio uses a new `cardio_sessions` table. Timer modes reuse the SVG ring pattern from RestTimer. All new components integrate into existing Progress and Workout pages.

**Tech Stack:** Next.js 16, Supabase, Recharts, TypeScript, Capacitor haptics

---

## Task 1: Add Types and Schema

**Files:**
- Modify: `src/types/database.ts:515-516` (append after ReadinessCheckin)
- Modify: `supabase/schema.sql:301` (append after auto_rest_seconds ALTER)

**Step 1: Add types to `src/types/database.ts`**

Append after line 515 (the closing `}` of `ReadinessCheckin`):

```typescript
// Phase 20: Strength Standards & Cardio
export type StrengthLevel = "beginner" | "novice" | "intermediate" | "advanced" | "elite";
export type CardioActivityType = "run" | "bike" | "row" | "swim" | "walk";

export interface RepMax {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
}

export interface CardioSession {
  id: string;
  user_id: string;
  activity_type: CardioActivityType;
  duration_seconds: number;
  distance: number | null;
  avg_pace: number | null;
  notes: string | null;
  completed_at: string;
  created_at: string;
}
```

**Step 2: Add schema to `supabase/schema.sql`**

Append after line 300:

```sql
-- Phase 20: Cardio Sessions
CREATE TABLE cardio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('run', 'bike', 'row', 'swim', 'walk')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  distance DECIMAL,
  avg_pace DECIMAL,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cardio_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own cardio sessions"
  ON cardio_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_cardio_user_date ON cardio_sessions(user_id, completed_at DESC);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/database.ts supabase/schema.sql
git commit -m "feat: add strength and cardio types and schema"
```

---

## Task 2: Create Strength Utilities

**Files:**
- Create: `src/lib/utils/strength.ts`

**Context:** This file contains the static strength standards lookup table and the `getStrengthLevel` function. Standards use bodyweight multiplier thresholds based on established data. Only applies to ~8 compound lifts. No estimation formulas — only actual tested 1RM values are compared.

**Step 1: Create `src/lib/utils/strength.ts`**

```typescript
import type { StrengthLevel } from "@/types";

// Bodyweight multiplier thresholds for each strength level.
// Source: Symmetric Strength / ExRx standards (male averages).
// Each entry is [beginner, novice, intermediate, advanced, elite].
const STANDARDS: Record<string, [number, number, number, number, number]> = {
  bench:       [0.50, 0.75, 1.00, 1.50, 2.00],
  squat:       [0.75, 1.00, 1.50, 2.00, 2.50],
  deadlift:    [1.00, 1.25, 1.75, 2.50, 3.00],
  ohp:         [0.35, 0.50, 0.65, 1.00, 1.40],
  row:         [0.50, 0.65, 0.85, 1.15, 1.50],
  pullup:      [0.50, 0.75, 1.00, 1.35, 1.75],
  dip:         [0.50, 0.75, 1.00, 1.50, 2.00],
  front_squat: [0.55, 0.80, 1.15, 1.55, 2.00],
};

const LEVEL_ORDER: StrengthLevel[] = ["beginner", "novice", "intermediate", "advanced", "elite"];

/**
 * Match an exercise name to a known standard key.
 * Uses case-insensitive substring matching.
 * Returns null if no match.
 */
export function matchExerciseToStandard(exerciseName: string): string | null {
  const name = exerciseName.toLowerCase();

  if (name.includes("bench") && !name.includes("incline") && !name.includes("decline")) return "bench";
  if (name.includes("squat") && !name.includes("front") && !name.includes("split")) return "squat";
  if (name.includes("front squat")) return "front_squat";
  if (name.includes("deadlift") || name.includes("dead lift")) return "deadlift";
  if (name.includes("overhead press") || name.includes("ohp") || (name.includes("press") && name.includes("shoulder"))) return "ohp";
  if (name.includes("barbell row") || name.includes("bent over row") || name.includes("pendlay")) return "row";
  if (name.includes("pull-up") || name.includes("pullup") || name.includes("chin-up") || name.includes("chinup")) return "pullup";
  if (name.includes("dip")) return "dip";

  return null;
}

/**
 * Determine strength level from an actual 1RM and bodyweight.
 * Returns null if the exercise doesn't match a known standard.
 */
export function getStrengthLevel(
  actual1RM: number,
  bodyweight: number,
  exerciseName: string
): StrengthLevel | null {
  if (bodyweight <= 0 || actual1RM <= 0) return null;

  const key = matchExerciseToStandard(exerciseName);
  if (!key) return null;

  const thresholds = STANDARDS[key];
  const ratio = actual1RM / bodyweight;

  // Find the highest level the user meets
  let level: StrengthLevel = "beginner";
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) {
      level = LEVEL_ORDER[i];
    }
  }

  return level;
}

/**
 * Color class for each strength level badge.
 */
export function getStrengthLevelColor(level: StrengthLevel): string {
  switch (level) {
    case "beginner": return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    case "novice": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "intermediate": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "advanced": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    case "elite": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
  }
}

/** The Big 4 compound lifts for the summary section. */
export const BIG_FOUR = ["bench", "squat", "deadlift", "ohp"] as const;

/** Human-readable labels for standard keys. */
export const STANDARD_LABELS: Record<string, string> = {
  bench: "Bench Press",
  squat: "Back Squat",
  deadlift: "Deadlift",
  ohp: "Overhead Press",
  row: "Barbell Row",
  pullup: "Pull-up",
  dip: "Dip",
  front_squat: "Front Squat",
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/utils/strength.ts
git commit -m "feat: add strength standards utility with level classifications"
```

---

## Task 3: Create Strength Database Layer

**Files:**
- Create: `src/lib/database/strength.ts`

**Context:** This file provides query functions to get rep maxes from existing `workout_sets` data. It follows the same pattern as `src/lib/database/stats.ts`: `createClient()`, `supabase.auth.getUser()` guard, query, return typed data. The Supabase join quirk applies: `exercise:exercises(name, id)` may return array or object — always handle with `Array.isArray`.

**Step 1: Create `src/lib/database/strength.ts`**

```typescript
import { createClient } from "@/lib/supabase/client";
import { format, subDays } from "date-fns";
import type { RepMax } from "@/types";

/**
 * Get rep maxes for a specific exercise.
 * Returns the heaviest weight at rep counts 1, 3, 5, and the overall best set.
 */
export async function getRepMaxes(
  exerciseId: string
): Promise<{
  rm1: RepMax | null;
  rm3: RepMax | null;
  rm5: RepMax | null;
  best: RepMax | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rm1: null, rm3: null, rm5: null, best: null };

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "weight, reps, logged_at, exercise_id, exercise:exercises(id, name), session:workout_sessions!inner(user_id)"
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .eq("set_type", "working")
    .order("weight", { ascending: false });

  if (!data || data.length === 0) {
    return { rm1: null, rm3: null, rm5: null, best: null };
  }

  function toRepMax(row: Record<string, unknown>): RepMax {
    const exercise = Array.isArray(row.exercise)
      ? (row.exercise as { id: string; name: string }[])[0]
      : (row.exercise as { id: string; name: string } | null);
    return {
      exerciseId: (row.exercise_id as string) || exerciseId,
      exerciseName: exercise?.name || "Unknown",
      weight: row.weight as number,
      reps: row.reps as number,
      date: row.logged_at as string,
    };
  }

  // Find heaviest at specific rep counts
  const rm1Row = data.find((r) => (r.reps as number) === 1);
  const rm3Row = data.find((r) => (r.reps as number) === 3);
  const rm5Row = data.find((r) => (r.reps as number) === 5);
  // Best = heaviest weight regardless of reps (already sorted desc)
  const bestRow = data[0];

  return {
    rm1: rm1Row ? toRepMax(rm1Row) : null,
    rm3: rm3Row ? toRepMax(rm3Row) : null,
    rm5: rm5Row ? toRepMax(rm5Row) : null,
    best: bestRow ? toRepMax(bestRow) : null,
  };
}

/**
 * Get the heaviest set (any rep count) per exercise for all exercises the user has logged.
 * Used for the PR board / strength profile overview.
 */
export async function getAllExercisePRs(): Promise<RepMax[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "weight, reps, logged_at, exercise_id, exercise:exercises(id, name), session:workout_sessions!inner(user_id)"
    )
    .eq("workout_sessions.user_id", user.id)
    .eq("set_type", "working")
    .order("weight", { ascending: false });

  if (!data || data.length === 0) return [];

  // Group by exercise_id, keep heaviest
  const best = new Map<string, RepMax>();
  for (const row of data) {
    const exId = row.exercise_id as string;
    if (!best.has(exId)) {
      const exercise = Array.isArray(row.exercise)
        ? (row.exercise as { id: string; name: string }[])[0]
        : (row.exercise as { id: string; name: string } | null);
      best.set(exId, {
        exerciseId: exId,
        exerciseName: exercise?.name || "Unknown",
        weight: row.weight as number,
        reps: row.reps as number,
        date: row.logged_at as string,
      });
    }
  }

  return Array.from(best.values());
}

/**
 * Get actual 1RM history for a specific exercise (heaviest single per day over time).
 * Only returns days where a single (reps=1) was performed.
 */
export async function get1RMHistory(
  exerciseId: string,
  days: number = 365
): Promise<Array<{ date: string; weight: number }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data } = await supabase
    .from("workout_sets")
    .select(
      "weight, logged_at, session:workout_sessions!inner(user_id)"
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .eq("reps", 1)
    .eq("set_type", "working")
    .gte("logged_at", since)
    .order("logged_at", { ascending: true });

  if (!data || data.length === 0) return [];

  // Group by date, keep heaviest single per day
  const byDate = new Map<string, number>();
  for (const row of data) {
    const dateKey = format(new Date(row.logged_at as string), "yyyy-MM-dd");
    const existing = byDate.get(dateKey) || 0;
    if ((row.weight as number) > existing) {
      byDate.set(dateKey, row.weight as number);
    }
  }

  return Array.from(byDate.entries()).map(([date, weight]) => ({
    date,
    weight,
  }));
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/database/strength.ts
git commit -m "feat: add strength database layer for rep maxes and 1RM history"
```

---

## Task 4: Create Cardio Database Layer

**Files:**
- Create: `src/lib/database/cardio.ts`

**Context:** Follows the same pattern as other database files. The `cardio_sessions` table must be created in Supabase before this code can run. Distance and avg_pace are nullable. Pace is auto-computed from distance and duration when distance is provided.

**Step 1: Create `src/lib/database/cardio.ts`**

```typescript
import { createClient } from "@/lib/supabase/client";
import { subDays } from "date-fns";
import type { CardioSession } from "@/types";

/**
 * Log a cardio session.
 * Auto-computes avg_pace (seconds per unit) when distance is provided.
 */
export async function logCardioSession(params: {
  activity_type: string;
  duration_seconds: number;
  distance?: number;
  notes?: string;
}): Promise<CardioSession> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const avg_pace =
    params.distance && params.distance > 0
      ? Math.round(params.duration_seconds / params.distance)
      : null;

  const { data, error } = await supabase
    .from("cardio_sessions")
    .insert({
      user_id: user.id,
      activity_type: params.activity_type,
      duration_seconds: params.duration_seconds,
      distance: params.distance || null,
      avg_pace,
      notes: params.notes || null,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as CardioSession;
}

/**
 * Get recent cardio sessions.
 */
export async function getCardioHistory(
  days: number = 30
): Promise<CardioSession[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = subDays(new Date(), days).toISOString();

  const { data, error } = await supabase
    .from("cardio_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("completed_at", since)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CardioSession[];
}

/**
 * Get aggregate cardio stats for a time range.
 */
export async function getCardioStats(
  days: number = 30
): Promise<{
  totalSessions: number;
  totalDurationSeconds: number;
  totalDistance: number;
  avgPace: number | null;
}> {
  const sessions = await getCardioHistory(days);

  const totalSessions = sessions.length;
  const totalDurationSeconds = sessions.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  );
  const totalDistance = sessions.reduce(
    (sum, s) => sum + (s.distance || 0),
    0
  );
  const avgPace =
    totalDistance > 0
      ? Math.round(totalDurationSeconds / totalDistance)
      : null;

  return { totalSessions, totalDurationSeconds, totalDistance, avgPace };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/database/cardio.ts
git commit -m "feat: add cardio database layer with session logging and stats"
```

---

## Task 5: Create Strength Profile Component

**Files:**
- Create: `src/components/progress/strength-profile.tsx`

**Context:** This component renders in the "strength" tab of the Progress page. It shows the Big 4 lifts at the top with strength level badges, then a scrollable list of all exercises with their rep maxes. Uses `getAllExercisePRs()` and `getRepMaxes()` from the strength database layer, `getWeightHistory(1)` to get latest bodyweight, and `getStrengthLevel()` + `getStrengthLevelColor()` from the strength utilities. Follows the same Recharts pattern as `exercise-progression-chart.tsx`: `ResponsiveContainer` > `LineChart` with `h-64 w-full` container.

**Step 1: Create `src/components/progress/strength-profile.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAllExercisePRs, getRepMaxes, get1RMHistory } from "@/lib/database/strength";
import { getWeightHistory } from "@/lib/database/weight";
import {
  getStrengthLevel,
  getStrengthLevelColor,
  matchExerciseToStandard,
  BIG_FOUR,
  STANDARD_LABELS,
} from "@/lib/utils/strength";
import type { RepMax, StrengthLevel } from "@/types";
import { format } from "date-fns";

interface Big4Entry {
  key: string;
  label: string;
  rm1: RepMax | null;
  level: StrengthLevel | null;
}

export function StrengthProfile() {
  const [prs, setPrs] = useState<RepMax[]>([]);
  const [big4, setBig4] = useState<Big4Entry[]>([]);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [repMaxDetail, setRepMaxDetail] = useState<{
    rm1: RepMax | null;
    rm3: RepMax | null;
    rm5: RepMax | null;
    best: RepMax | null;
  } | null>(null);
  const [trendData, setTrendData] = useState<{ date: string; weight: number }[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load initial data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [allPRs, weightData] = await Promise.all([
          getAllExercisePRs(),
          getWeightHistory(1),
        ]);

        if (cancelled) return;

        const bw = weightData.length > 0 ? weightData[weightData.length - 1].weight : null;
        setBodyweight(bw);
        setPrs(allPRs);

        // Build Big 4 data
        const big4Data: Big4Entry[] = BIG_FOUR.map((key) => {
          // Find a PR that matches this standard
          const match = allPRs.find(
            (pr) => matchExerciseToStandard(pr.exerciseName) === key
          );
          let rm1: RepMax | null = null;
          let level: StrengthLevel | null = null;

          if (match) {
            // Need the actual 1RM (reps=1), not just best set
            // We'll fetch it async below, for now show best set
            rm1 = match;
          }

          return {
            key,
            label: STANDARD_LABELS[key],
            rm1,
            level,
          };
        });

        // For each Big 4 lift that has a match, fetch actual 1RM
        const enriched = await Promise.all(
          big4Data.map(async (entry) => {
            if (!entry.rm1) return entry;
            const maxes = await getRepMaxes(entry.rm1.exerciseId);
            const actual1RM = maxes.rm1;
            const level =
              actual1RM && bw
                ? getStrengthLevel(actual1RM.weight, bw, entry.rm1.exerciseName)
                : null;
            return { ...entry, rm1: actual1RM, level };
          })
        );

        if (!cancelled) setBig4(enriched);
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Load detail when exercise selected
  useEffect(() => {
    if (!selectedExercise) {
      setRepMaxDetail(null);
      setTrendData([]);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);

    Promise.all([
      getRepMaxes(selectedExercise),
      get1RMHistory(selectedExercise),
    ])
      .then(([maxes, history]) => {
        if (!cancelled) {
          setRepMaxDetail(maxes);
          setTrendData(history);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => { cancelled = true; };
  }, [selectedExercise]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Big 4 Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4" /> Big 4 Lifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!bodyweight && (
            <p className="text-xs text-muted-foreground mb-3">
              Log your bodyweight in the Overview tab to see strength levels.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {big4.map((entry) => (
              <div
                key={entry.key}
                className="rounded-lg border p-3 text-center"
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {entry.label}
                </div>
                {entry.rm1 ? (
                  <>
                    <div className="text-lg font-bold">
                      {entry.rm1.weight} lbs
                    </div>
                    {entry.level && (
                      <Badge
                        className={cn(
                          "mt-1 text-[10px] capitalize",
                          getStrengthLevelColor(entry.level)
                        )}
                      >
                        {entry.level}
                      </Badge>
                    )}
                    {!entry.level && bodyweight && (
                      <span className="text-[10px] text-muted-foreground">
                        No single tested
                      </span>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not tested
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exercise Selector + Rep Maxes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exercise Rep Maxes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedExercise || ""}
            onValueChange={(v) => setSelectedExercise(v || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an exercise" />
            </SelectTrigger>
            <SelectContent>
              {prs.map((pr) => (
                <SelectItem key={pr.exerciseId} value={pr.exerciseId}>
                  {pr.exerciseName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loadingDetail && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {repMaxDetail && !loadingDetail && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "1RM", data: repMaxDetail.rm1 },
                  { label: "3RM", data: repMaxDetail.rm3 },
                  { label: "5RM", data: repMaxDetail.rm5 },
                  { label: "Best Set", data: repMaxDetail.best },
                ].map(({ label, data }) => (
                  <div key={label} className="rounded-lg border p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{label}</div>
                    {data ? (
                      <>
                        <div className="text-lg font-bold">{data.weight} lbs</div>
                        <div className="text-xs text-muted-foreground">
                          {data.reps} rep{data.reps !== 1 ? "s" : ""}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Strength level for selected exercise */}
              {repMaxDetail.rm1 && bodyweight && (() => {
                const pr = prs.find((p) => p.exerciseId === selectedExercise);
                const level = pr
                  ? getStrengthLevel(repMaxDetail.rm1.weight, bodyweight, pr.exerciseName)
                  : null;
                return level ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Strength Level:</span>
                    <Badge className={cn("capitalize", getStrengthLevelColor(level))}>
                      {level}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({(repMaxDetail.rm1.weight / bodyweight).toFixed(2)}x BW)
                    </span>
                  </div>
                ) : null;
              })()}

              {/* 1RM Trend Chart */}
              {trendData.length > 1 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">1RM History</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(240 3.7% 25%)"
                          opacity={0.3}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                          stroke="hsl(240 5% 55%)"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          stroke="hsl(240 5% 55%)"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v: number) => `${v}`}
                        />
                        <Tooltip
                          labelFormatter={(d: string) => format(new Date(d), "MMM d, yyyy")}
                          formatter={(value: number) => [`${value} lbs`, "1RM"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="hsl(217 91% 60%)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(217 91% 60%)" }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {trendData.length === 0 && repMaxDetail.rm1 === null && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No singles (1 rep) logged for this exercise yet.
                </p>
              )}
            </>
          )}

          {!selectedExercise && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Select an exercise to see your rep maxes and 1RM history.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/progress/strength-profile.tsx
git commit -m "feat: add strength profile component with Big 4 and rep maxes"
```

---

## Task 6: Create Cardio Log Page

**Files:**
- Create: `src/app/(app)/workout/cardio/page.tsx`

**Context:** New page at `/workout/cardio`. Contains an activity type selector, duration and distance inputs, a log button, and a list of recent cardio sessions. Follows the same page layout pattern as other `(app)` pages: `<div className="p-4 md:p-8 ...">`. Uses `logCardioSession` and `getCardioHistory` from the cardio database layer.

**Step 1: Create the directory and page**

Create `src/app/(app)/workout/cardio/page.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bike, Footprints, Loader2, Waves, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logCardioSession, getCardioHistory } from "@/lib/database/cardio";
import { getSettings } from "@/lib/database/settings";
import Link from "next/link";
import { format } from "date-fns";
import type { CardioSession, CardioActivityType } from "@/types";

const ACTIVITY_OPTIONS: {
  value: CardioActivityType;
  label: string;
  icon: typeof Footprints;
}[] = [
  { value: "run", label: "Run", icon: Footprints },
  { value: "bike", label: "Bike", icon: Bike },
  { value: "row", label: "Row", icon: Waves },
  { value: "swim", label: "Swim", icon: Waves },
  { value: "walk", label: "Walk", icon: Wind },
];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
  return `${s}s`;
}

function formatPace(paceSeconds: number, unit: string): string {
  const m = Math.floor(paceSeconds / 60);
  const s = paceSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")} /${unit}`;
}

export default function CardioPage() {
  const [activityType, setActivityType] = useState<CardioActivityType>("run");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [history, setHistory] = useState<CardioSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState("mi");

  useEffect(() => {
    getSettings()
      .then((s) => setDistanceUnit(s.unit_preference === "kg" ? "km" : "mi"))
      .catch(() => {});

    getCardioHistory(30)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  const totalSeconds =
    (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
  const distanceNum = parseFloat(distance) || 0;
  const computedPace =
    distanceNum > 0 && totalSeconds > 0
      ? Math.round(totalSeconds / distanceNum)
      : null;

  const handleLog = useCallback(async () => {
    if (totalSeconds <= 0) return;
    setIsLogging(true);
    try {
      const session = await logCardioSession({
        activity_type: activityType,
        duration_seconds: totalSeconds,
        distance: distanceNum > 0 ? distanceNum : undefined,
        notes: notes.trim() || undefined,
      });
      setHistory((prev) => [session, ...prev]);
      toast.success("Cardio session logged!", {
        description: `${formatDuration(totalSeconds)}${distanceNum > 0 ? ` — ${distanceNum} ${distanceUnit}` : ""}`,
      });
      setMinutes("");
      setSeconds("");
      setDistance("");
      setNotes("");
    } catch (err) {
      console.error("Failed to log cardio:", err);
      toast.error("Failed to log cardio session");
    } finally {
      setIsLogging(false);
    }
  }, [activityType, totalSeconds, distanceNum, distanceUnit, notes]);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/workout">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Log Cardio</h1>
          <p className="text-sm text-muted-foreground">
            Track your cardio sessions
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Activity Type */}
          <div className="space-y-2">
            <Label>Activity</Label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActivityType(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      activityType === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="size-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="h-12 text-xl font-bold text-center"
                  min={0}
                />
                <span className="block text-xs text-muted-foreground text-center mt-1">
                  min
                </span>
              </div>
              <span className="text-xl font-bold text-muted-foreground">:</span>
              <div className="flex-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="00"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  className="h-12 text-xl font-bold text-center"
                  min={0}
                  max={59}
                />
                <span className="block text-xs text-muted-foreground text-center mt-1">
                  sec
                </span>
              </div>
            </div>
          </div>

          {/* Distance (optional) */}
          <div className="space-y-2">
            <Label>Distance ({distanceUnit}) — optional</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="h-12 text-xl font-bold text-center"
              min={0}
              step={0.1}
            />
          </div>

          {/* Computed pace */}
          {computedPace && (
            <div className="text-sm text-muted-foreground text-center">
              Pace: {formatPace(computedPace, distanceUnit)}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="How did it feel?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Log Button */}
          <Button
            onClick={handleLog}
            disabled={isLogging || totalSeconds <= 0}
            className="w-full h-12 text-base font-semibold"
          >
            {isLogging ? "Logging..." : "Log Cardio Session"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Recent Sessions
        </h2>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No cardio sessions yet. Log your first one above!
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {s.activity_type}
                    </Badge>
                    <div>
                      <div className="text-sm font-medium">
                        {formatDuration(s.duration_seconds)}
                        {s.distance ? ` — ${s.distance} ${distanceUnit}` : ""}
                      </div>
                      {s.avg_pace && (
                        <div className="text-xs text-muted-foreground">
                          Pace: {formatPace(s.avg_pace, distanceUnit)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(s.completed_at), "MMM d")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(app)/workout/cardio/page.tsx
git commit -m "feat: add cardio log page with activity type, duration, distance"
```

---

## Task 7: Create Workout Timer Component (EMOM/AMRAP)

**Files:**
- Create: `src/components/workout/workout-timer.tsx`

**Context:** Reuses the SVG ring pattern from `rest-timer.tsx`. EMOM counts down per interval and resets with haptic. AMRAP counts down total time with a round counter button. Positioned identically to the rest timer (`fixed bottom-20 right-4 z-50`). Same haptic calls from `src/lib/capacitor/haptics.ts`. A `mode: "emom" | "amrap"` prop controls behavior.

**Step 1: Create `src/components/workout/workout-timer.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { hapticNotification } from "@/lib/capacitor/haptics";

type TimerMode = "emom" | "amrap";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface WorkoutTimerProps {
  open: boolean;
  onClose: () => void;
}

export function WorkoutTimer({ open, onClose }: WorkoutTimerProps) {
  const [mode, setMode] = useState<TimerMode>("emom");
  const [isConfiguring, setIsConfiguring] = useState(true);

  // EMOM config
  const [emomInterval, setEmomInterval] = useState(60);
  const [emomRounds, setEmomRounds] = useState(10);

  // AMRAP config
  const [amrapDuration, setAmrapDuration] = useState(600); // 10 min default

  // Running state
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(0);
  const [roundCount, setRoundCount] = useState(0); // AMRAP round counter

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const targetEndRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    if (mode === "emom") {
      setRemaining(emomInterval);
      setCurrentRound(1);
      setTotalRounds(emomRounds);
    } else {
      setRemaining(amrapDuration);
      setRoundCount(0);
    }

    startTimeRef.current = Date.now();
    targetEndRef.current =
      Date.now() +
      (mode === "emom" ? emomInterval : amrapDuration) * 1000;

    setIsRunning(true);
    setIsConfiguring(false);
  }, [mode, emomInterval, emomRounds, amrapDuration]);

  // Countdown logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeLeft = Math.max(
        0,
        Math.ceil((targetEndRef.current - now) / 1000)
      );
      setRemaining(timeLeft);

      if (timeLeft <= 0) {
        hapticNotification("warning");

        if (mode === "emom") {
          setCurrentRound((prev) => {
            const next = prev + 1;
            if (next > totalRounds) {
              // EMOM complete
              setIsRunning(false);
              hapticNotification("success");
              return prev;
            }
            // Reset for next interval
            targetEndRef.current = Date.now() + emomInterval * 1000;
            return next;
          });
        } else {
          // AMRAP complete
          setIsRunning(false);
          hapticNotification("success");
        }
      }
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, emomInterval, totalRounds]);

  const handleToggle = useCallback(() => {
    if (isRunning) {
      // Pause: save remaining
      setIsRunning(false);
    } else {
      // Resume: recalculate end time from remaining
      targetEndRef.current = Date.now() + remaining * 1000;
      setIsRunning(true);
    }
  }, [isRunning, remaining]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsConfiguring(true);
    setRoundCount(0);
    setCurrentRound(1);
  }, []);

  const handleDismiss = useCallback(() => {
    setIsRunning(false);
    setIsConfiguring(true);
    setRoundCount(0);
    onClose();
  }, [onClose]);

  if (!open) return null;

  // SVG ring
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const totalDuration = mode === "emom" ? emomInterval : amrapDuration;
  const progress = totalDuration > 0 ? remaining / totalDuration : 0;
  const strokeDashoffset = circumference * (1 - progress);

  // Configuration screen
  if (isConfiguring) {
    return (
      <div className="fixed bottom-20 right-4 z-50 w-72 rounded-2xl bg-card border shadow-xl p-4 md:bottom-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workout Timer
          </span>
          <Button variant="ghost" size="icon-xs" onClick={handleDismiss}>
            <X className="size-3" />
          </Button>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          {(["emom", "amrap"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {mode === "emom" ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Interval (seconds)</Label>
              <Input
                type="number"
                value={emomInterval}
                onChange={(e) =>
                  setEmomInterval(Math.max(10, parseInt(e.target.value) || 60))
                }
                min={10}
                max={300}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Total Rounds</Label>
              <Input
                type="number"
                value={emomRounds}
                onChange={(e) =>
                  setEmomRounds(Math.max(1, parseInt(e.target.value) || 10))
                }
                min={1}
                max={60}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatTime(emomInterval * emomRounds)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={Math.round(amrapDuration / 60)}
                onChange={(e) =>
                  setAmrapDuration(
                    Math.max(60, (parseInt(e.target.value) || 10) * 60)
                  )
                }
                min={1}
                max={60}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <Button onClick={handleStart} className="w-full mt-4">
          <Play className="size-4" /> Start {mode.toUpperCase()}
        </Button>
      </div>
    );
  }

  // Minimized pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-card border shadow-lg px-4 py-2 md:bottom-6">
        <span className="text-[10px] font-medium uppercase text-muted-foreground">
          {mode.toUpperCase()}
        </span>
        <span
          className={cn(
            "text-sm font-mono font-bold",
            remaining <= 10 && remaining > 0 && "text-destructive animate-pulse"
          )}
        >
          {formatTime(remaining)}
        </span>
        {mode === "emom" && (
          <span className="text-xs text-muted-foreground">
            R{currentRound}/{totalRounds}
          </span>
        )}
        {mode === "amrap" && (
          <span className="text-xs text-muted-foreground">
            ×{roundCount}
          </span>
        )}
        <Button variant="ghost" size="icon-xs" onClick={handleToggle}>
          {isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setIsMinimized(false)}>
          <ChevronUp className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={handleDismiss}>
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  // Full timer
  return (
    <div className="fixed bottom-20 right-4 z-50 w-64 rounded-2xl bg-card border shadow-xl p-4 md:bottom-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {mode.toUpperCase()}
          {mode === "emom" && ` — Round ${currentRound}/${totalRounds}`}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => setIsMinimized(true)}>
            <ChevronDown className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={handleDismiss}>
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {/* SVG Ring */}
      <div className="flex justify-center mb-3">
        <div className="relative flex items-center justify-center">
          <svg width="112" height="112" className="-rotate-90">
            <circle
              cx="56" cy="56" r={radius}
              fill="none" stroke="currentColor" strokeWidth="6"
              className="text-muted/30"
            />
            <circle
              cx="56" cy="56" r={radius}
              fill="none" stroke="currentColor" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn(
                "transition-all duration-300 ease-linear",
                remaining <= 10 && remaining > 0
                  ? "text-destructive"
                  : mode === "emom"
                    ? "text-primary"
                    : "text-orange-500"
              )}
            />
          </svg>
          <span
            className={cn(
              "absolute text-2xl font-mono font-bold",
              remaining <= 10 && remaining > 0 && "text-destructive"
            )}
          >
            {formatTime(remaining)}
          </span>
        </div>
      </div>

      {/* AMRAP round counter */}
      {mode === "amrap" && (
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="text-sm text-muted-foreground">Rounds:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRoundCount((prev) => prev + 1)}
            className="gap-1"
          >
            <Plus className="size-3" /> {roundCount}
          </Button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={handleReset}>
          <RotateCcw className="size-4" />
        </Button>
        <Button
          variant={isRunning ? "secondary" : "default"}
          size="sm"
          onClick={handleToggle}
          className="min-w-[80px]"
        >
          {isRunning ? (
            <><Pause className="size-4" /> Pause</>
          ) : (
            <><Play className="size-4" /> Resume</>
          )}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/workout/workout-timer.tsx
git commit -m "feat: add EMOM/AMRAP workout timer component"
```

---

## Task 8: Create Cardio Progress Component

**Files:**
- Create: `src/components/progress/cardio-progress.tsx`

**Context:** Renders in the "cardio" tab of the Progress page. Shows summary stats at top and a Recharts line chart of distance or duration over time, filterable by activity type. Uses `getCardioHistory` and `getCardioStats` from cardio database layer. Same Recharts pattern as exercise-progression-chart.

**Step 1: Create `src/components/progress/cardio-progress.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCardioHistory, getCardioStats } from "@/lib/database/cardio";
import { getSettings } from "@/lib/database/settings";
import type { CardioSession, CardioActivityType } from "@/types";
import { format } from "date-fns";

const ACTIVITY_LABELS: Record<string, string> = {
  all: "All Activities",
  run: "Running",
  bike: "Cycling",
  row: "Rowing",
  swim: "Swimming",
  walk: "Walking",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatPace(paceSeconds: number, unit: string): string {
  const m = Math.floor(paceSeconds / 60);
  const s = paceSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")} /${unit}`;
}

export function CardioProgress() {
  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [filter, setFilter] = useState<"all" | CardioActivityType>("all");
  const [stats, setStats] = useState<{
    totalSessions: number;
    totalDurationSeconds: number;
    totalDistance: number;
    avgPace: number | null;
  } | null>(null);
  const [distanceUnit, setDistanceUnit] = useState("mi");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCardioHistory(90), getCardioStats(90), getSettings()])
      .then(([history, statsData, settings]) => {
        if (cancelled) return;
        setSessions(history);
        setStats(statsData);
        setDistanceUnit(settings.unit_preference === "kg" ? "km" : "mi");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered =
    filter === "all"
      ? sessions
      : sessions.filter((s) => s.activity_type === filter);

  // Chart data: group by date, sum duration
  const chartData = filtered.reduce<
    Array<{ date: string; duration: number; distance: number }>
  >((acc, s) => {
    const dateKey = format(new Date(s.completed_at), "yyyy-MM-dd");
    const existing = acc.find((d) => d.date === dateKey);
    if (existing) {
      existing.duration += Math.round(s.duration_seconds / 60);
      existing.distance += s.distance || 0;
    } else {
      acc.push({
        date: dateKey,
        duration: Math.round(s.duration_seconds / 60),
        distance: s.distance || 0,
      });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">{stats.totalSessions}</div>
              <div className="text-xs text-muted-foreground">Sessions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">
                {formatDuration(stats.totalDurationSeconds)}
              </div>
              <div className="text-xs text-muted-foreground">Total Time</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">
                {stats.totalDistance > 0
                  ? `${stats.totalDistance.toFixed(1)}`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Total {distanceUnit}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">
                {stats.avgPace ? formatPace(stats.avgPace, distanceUnit) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Avg Pace</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter + Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Activity Over Time</CardTitle>
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No cardio data for this period.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(240 3.7% 25%)"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                    stroke="hsl(240 5% 55%)"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="hsl(240 5% 55%)"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(d: string) =>
                      format(new Date(d), "MMM d, yyyy")
                    }
                    formatter={(value: number, name: string) => [
                      name === "duration"
                        ? `${value} min`
                        : `${value} ${distanceUnit}`,
                      name === "duration" ? "Duration" : "Distance",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="duration"
                    stroke="hsl(217 91% 60%)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(217 91% 60%)" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/progress/cardio-progress.tsx
git commit -m "feat: add cardio progress component with stats and activity chart"
```

---

## Task 9: Integrate Strength and Cardio Tabs into Progress Page

**Files:**
- Modify: `src/app/(app)/progress/page.tsx`

**Context:** Add two new tabs ("Strength" and "Cardio") to the existing 5-tab progress page. Import `StrengthProfile` from `@/components/progress/strength-profile` and `CardioProgress` from `@/components/progress/cardio-progress`. Add them as `TabsTrigger` + `TabsContent` entries.

**Step 1: Add imports**

At the top of `src/app/(app)/progress/page.tsx`, after the existing imports (line 14), add:

```typescript
import { StrengthProfile } from "@/components/progress/strength-profile";
import { CardioProgress } from "@/components/progress/cardio-progress";
```

**Step 2: Add tab triggers**

In the `<TabsList>` (between the existing `<TabsTrigger value="goals">Goals</TabsTrigger>` and the closing `</TabsList>`), add:

```typescript
          <TabsTrigger value="strength">Strength</TabsTrigger>
          <TabsTrigger value="cardio">Cardio</TabsTrigger>
```

**Step 3: Add tab content**

After the closing `</TabsContent>` for `goals` (before `</Tabs>`), add:

```typescript
        <TabsContent value="strength" className="mt-4 space-y-6">
          <StrengthProfile />
        </TabsContent>

        <TabsContent value="cardio" className="mt-4 space-y-6">
          <CardioProgress />
        </TabsContent>
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/(app)/progress/page.tsx
git commit -m "feat: add strength and cardio tabs to progress page"
```

---

## Task 10: Add Cardio Button to Workout Hub

**Files:**
- Modify: `src/app/(app)/workout/page.tsx`

**Context:** Add a third button to the Start Workout grid that links to `/workout/cardio`. Follows the same pattern as the "Empty Workout" and "From Template" buttons. Import `Footprints` from lucide-react and `Link` from `next/link`.

**Step 1: Add imports**

In the existing lucide-react import (line 6), add `Footprints` to the import list:

```typescript
import {
  Dumbbell,
  Footprints,
  LayoutTemplate,
  Loader2,
  Plus,
  Settings,
} from "lucide-react";
```

Add `Link` import if not present:

```typescript
import Link from "next/link";
```

**Step 2: Add cardio button**

After the "From Template" `</Button>` (line 135), inside the grid div, add:

```typescript
          {/* Log Cardio */}
          <Button
            variant="outline"
            className="h-20 flex-col gap-1.5 text-base"
            asChild
          >
            <Link href="/workout/cardio">
              <Footprints className="size-6" />
              <span className="font-semibold">Log Cardio</span>
              <span className="text-xs text-muted-foreground font-normal">
                Run, bike, swim & more
              </span>
            </Link>
          </Button>
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(app)/workout/page.tsx
git commit -m "feat: add Log Cardio button to workout hub page"
```

---

## Task 11: Add Workout Timer to Active Workout Header

**Files:**
- Modify: `src/components/workout/active-workout.tsx`

**Context:** Add a timer icon button to the sticky header of the active workout page. When clicked, it opens the `WorkoutTimer` component. Import `Timer` from lucide-react and `WorkoutTimer` from `./workout-timer`. Add `showWorkoutTimer` state. Place the button in the header's right side (the `flex items-center gap-3` div at line 271), and render the `WorkoutTimer` component alongside the existing `RestTimer`.

**Step 1: Add imports**

Add `Timer` to the lucide-react import (line 6):

```typescript
import {
  Clock,
  Dumbbell,
  Flame,
  Loader2,
  Plus,
  Square,
  Timer,
  TrendingUp,
} from "lucide-react";
```

Add the WorkoutTimer import after the RestTimer import (line 36):

```typescript
import { WorkoutTimer } from "./workout-timer";
```

**Step 2: Add state**

After `const [supersetPairs, setSupersetPairs] = useState<Set<string>>(new Set());` (line 81), add:

```typescript
  const [showWorkoutTimer, setShowWorkoutTimer] = useState(false);
```

**Step 3: Add timer button in header**

In the header's right-side div (the `<div className="flex items-center gap-3">` at line 271), add before the `session.split_type` Badge:

```typescript
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowWorkoutTimer(true)}
              title="Workout Timer (EMOM/AMRAP)"
            >
              <Timer className="size-4" />
            </Button>
```

**Step 4: Render WorkoutTimer**

After the `<RestTimer ... />` (line 370), add:

```typescript
      {/* Workout Timer (EMOM/AMRAP) */}
      <WorkoutTimer
        open={showWorkoutTimer}
        onClose={() => setShowWorkoutTimer(false)}
      />
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/workout/active-workout.tsx
git commit -m "feat: add EMOM/AMRAP timer button to active workout header"
```

---

## Task 12: Lint and Build Verification

**Files:** None (verification only)

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run Next.js build**

Run: `npx next build`
Expected: Build succeeds with all routes compiled, including new `/workout/cardio` route

**Step 3: Verify new route appears in build output**

Look for `○ /workout/cardio` in the build output routes list.

---

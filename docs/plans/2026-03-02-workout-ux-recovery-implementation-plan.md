# Phase 19: Workout Session UX + Recovery & Readiness Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the live workout with a plate calculator, auto-rest timer, superset mode, and previous performance overlay, plus add a recovery scoring system with readiness check-ins and dashboard widgets.

**Architecture:** No new routes. Six new components (4 workout, 2 dashboard), one new database layer (`recovery.ts`), one new DB table (`readiness_checkins`), and modifications to `active-workout.tsx`, `rest-timer.tsx`, `workout/active/page.tsx`, dashboard `page.tsx`, settings, and types. Recovery score is computed client-side from existing training/nutrition data plus new readiness check-ins.

**Tech Stack:** Next.js 16, React 19, Supabase (client SDK), TypeScript, Tailwind CSS, lucide-react icons, sonner toasts, date-fns.

---

### Task 1: Add Types & Database Schema

**Files:**
- Modify: `src/types/database.ts` (append new types at end, extend `UserSettings`)
- Modify: `supabase/schema.sql` (append new table + alter user_settings)

**Context:** Types file is ~500 lines. New types go at the very end. `UserSettings` interface is at line ~172. Schema file has all CREATE TABLE statements.

**Step 1: Add new types to `src/types/database.ts`**

At the very end of the file, add:

```typescript
// Phase 19: Recovery & Readiness
export interface ReadinessCheckin {
  id: string;
  user_id: string;
  session_id: string | null;
  date: string;
  sleep_quality: number | null;
  soreness: number | null;
  energy: number | null;
  created_at: string;
}
```

**Step 2: Extend `UserSettings` interface**

In the `UserSettings` interface (around line 172), add two new fields before the closing `}`:

```typescript
  auto_rest_timer: boolean;
  auto_rest_seconds: number;
```

**Step 3: Update schema.sql**

Append to the end of `supabase/schema.sql`:

```sql
-- Phase 19: Readiness Check-ins
CREATE TABLE readiness_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES workout_sessions(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  soreness SMALLINT CHECK (soreness BETWEEN 1 AND 5),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE readiness_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own readiness checkins"
  ON readiness_checkins FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_readiness_user_date ON readiness_checkins(user_id, date DESC);

-- Add auto-rest settings to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_rest_timer BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_rest_seconds SMALLINT DEFAULT 90;
```

**Step 4: Update settings default insert**

In `src/lib/database/settings.ts`, update the insert defaults (around line 26) to include the new fields in the insert object:

```typescript
auto_rest_timer: false,
auto_rest_seconds: 90,
```

Also update the `updateSettings` function's `Pick<>` type to include `"auto_rest_timer" | "auto_rest_seconds"`.

**Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to ReadinessCheckin or UserSettings changes.

**Step 6: Commit**

```bash
git add src/types/database.ts supabase/schema.sql src/lib/database/settings.ts
git commit -m "feat: add readiness checkin types, schema, and auto-rest settings"
```

---

### Task 2: Create Recovery Database Layer

**Files:**
- Create: `src/lib/database/recovery.ts`

**Context:** Follow the pattern in `src/lib/database/measurements.ts` and `src/lib/database/workouts.ts`. Use `createClient()` from `@/lib/supabase/client`. All functions get user via `supabase.auth.getUser()`.

**Step 1: Create `src/lib/database/recovery.ts`**

```typescript
import { createClient } from "@/lib/supabase/client";
import { subDays, format } from "date-fns";
import type { ReadinessCheckin } from "@/types";

// Save or update a readiness check-in for today
export async function saveReadinessCheckin(params: {
  sessionId?: string;
  sleepQuality: number | null;
  soreness: number | null;
  energy: number | null;
}): Promise<ReadinessCheckin> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = format(new Date(), "yyyy-MM-dd");

  // Upsert: check if one already exists for today
  const { data: existing } = await supabase
    .from("readiness_checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("readiness_checkins")
      .update({
        session_id: params.sessionId || null,
        sleep_quality: params.sleepQuality,
        soreness: params.soreness,
        energy: params.energy,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ReadinessCheckin;
  }

  const { data, error } = await supabase
    .from("readiness_checkins")
    .insert({
      user_id: user.id,
      session_id: params.sessionId || null,
      date: today,
      sleep_quality: params.sleepQuality,
      soreness: params.soreness,
      energy: params.energy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ReadinessCheckin;
}

// Get recent readiness check-ins
export async function getRecentCheckins(
  days: number = 30
): Promise<ReadinessCheckin[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const since = format(subDays(new Date(), days), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("readiness_checkins")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", since)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as ReadinessCheckin[];
}

// Get today's check-in (if any)
export async function getTodayCheckin(): Promise<ReadinessCheckin | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("readiness_checkins")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  return (data as ReadinessCheckin) || null;
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/lib/database/recovery.ts
git commit -m "feat: add recovery database layer with readiness check-in CRUD"
```

---

### Task 3: Create Plate Calculator Component

**Files:**
- Create: `src/components/workout/plate-calculator.tsx`

**Context:** This is a pure client-side component. Triggered from the set logger when user taps the weight value. Uses a popover/dialog pattern. The app supports both lbs and kg via `unit_preference` in UserSettings.

**Step 1: Create `src/components/workout/plate-calculator.tsx`**

```typescript
"use client";

import { useMemo, useState } from "react";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLATES_LBS = [45, 35, 25, 10, 5, 2.5] as const;
const PLATES_KG = [20, 15, 10, 5, 2.5, 1.25] as const;
const BAR_LBS = 45;
const BAR_KG = 20;

interface PlateCalculatorProps {
  weight: number;
  unit: "lbs" | "kg";
  onClose: () => void;
}

function calculatePlates(
  totalWeight: number,
  barWeight: number,
  availablePlates: readonly number[]
): { plates: number[]; achievable: number } {
  const perSide = (totalWeight - barWeight) / 2;
  if (perSide <= 0) return { plates: [], achievable: barWeight };

  const plates: number[] = [];
  let remaining = perSide;

  for (const plate of availablePlates) {
    while (remaining >= plate) {
      plates.push(plate);
      remaining -= plate;
    }
  }

  const actualPerSide = perSide - remaining;
  const achievable = barWeight + actualPerSide * 2;

  return { plates, achievable };
}

// Color mapping for plate sizes (gym standard colors)
function getPlateColor(plate: number, unit: "lbs" | "kg"): string {
  if (unit === "lbs") {
    if (plate === 45) return "bg-blue-600 text-white";
    if (plate === 35) return "bg-yellow-500 text-black";
    if (plate === 25) return "bg-green-600 text-white";
    if (plate === 10) return "bg-zinc-300 text-black";
    if (plate === 5) return "bg-zinc-500 text-white";
    return "bg-zinc-700 text-white";
  }
  // kg (IPF standard colors)
  if (plate === 20) return "bg-blue-600 text-white";
  if (plate === 15) return "bg-yellow-500 text-black";
  if (plate === 10) return "bg-green-600 text-white";
  if (plate === 5) return "bg-zinc-300 text-black";
  if (plate === 2.5) return "bg-zinc-500 text-white";
  return "bg-zinc-700 text-white";
}

export function PlateCalculator({ weight, unit, onClose }: PlateCalculatorProps) {
  const barWeight = unit === "lbs" ? BAR_LBS : BAR_KG;
  const plates = unit === "lbs" ? PLATES_LBS : PLATES_KG;

  const result = useMemo(
    () => calculatePlates(weight, barWeight, plates),
    [weight, barWeight, plates]
  );

  const isExact = result.achievable === weight;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-card border-t p-4 sm:rounded-2xl sm:border space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-primary" />
            <span className="font-semibold">Plate Calculator</span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Target weight */}
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums">
            {weight} <span className="text-lg text-muted-foreground">{unit}</span>
          </p>
          {!isExact && (
            <p className="text-xs text-yellow-500 mt-1">
              Nearest: {result.achievable} {unit} (closest)
            </p>
          )}
        </div>

        {/* Bar + plates visualization */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Bar: {barWeight} {unit} | Each side:
          </p>
          {weight <= barWeight ? (
            <p className="text-sm text-center text-muted-foreground py-4">
              Just the bar
            </p>
          ) : result.plates.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-4">
              Just the bar
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5 py-2">
              {result.plates.map((plate, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-bold tabular-nums min-w-[3rem]",
                    getPlateColor(plate, unit)
                  )}
                >
                  {plate}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {result.plates.length > 0 && (
          <div className="text-xs text-muted-foreground text-center space-y-0.5">
            <p>
              {result.plates.length} plate{result.plates.length !== 1 ? "s" : ""} per side
            </p>
            <p>
              Total plate weight: {(result.achievable - barWeight)} {unit}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/workout/plate-calculator.tsx
git commit -m "feat: add plate calculator component with color-coded plates"
```

---

### Task 4: Create Readiness Check-In Component

**Files:**
- Create: `src/components/workout/readiness-check.tsx`

**Context:** Full-screen overlay shown before workout starts. Three 1-5 button rows for sleep quality, soreness, energy. Has a "Skip" button. Calls `saveReadinessCheckin()` from `recovery.ts`. After submit, calls `onComplete` callback with the average score (used as mood_energy).

**Step 1: Create `src/components/workout/readiness-check.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Moon, Activity, Zap, SkipForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveReadinessCheckin } from "@/lib/database/recovery";

interface ReadinessCheckProps {
  sessionId: string;
  onComplete: (moodEnergy: number | null) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Average",
  4: "Good",
  5: "Great",
};

interface RatingRowProps {
  label: string;
  icon: React.ElementType;
  value: number | null;
  onChange: (val: number) => void;
  lowLabel: string;
  highLabel: string;
}

function RatingRow({ label, icon: Icon, value, onChange, lowLabel, highLabel }: RatingRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-medium">{label}</span>
        {value && (
          <span className="ml-auto text-xs text-muted-foreground">
            {RATING_LABELS[value]}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 rounded-lg py-3 text-lg font-bold transition-all",
              value === n
                ? "bg-primary text-primary-foreground scale-105"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function ReadinessCheck({ sessionId, onComplete }: ReadinessCheckProps) {
  const [sleep, setSleep] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    setIsSaving(true);
    try {
      await saveReadinessCheckin({
        sessionId,
        sleepQuality: sleep,
        soreness,
        energy,
      });

      // Calculate average for mood_energy (only from non-null values)
      const values = [sleep, soreness, energy].filter((v): v is number => v !== null);
      const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
      onComplete(avg);
    } catch {
      // If save fails, still proceed (don't block the workout)
      onComplete(null);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkip() {
    onComplete(null);
  }

  const hasAnyRating = sleep !== null || soreness !== null || energy !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold">How are you feeling?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quick check-in before your workout
          </p>
        </div>

        <div className="space-y-5">
          <RatingRow
            label="Sleep Quality"
            icon={Moon}
            value={sleep}
            onChange={setSleep}
            lowLabel="Terrible"
            highLabel="Amazing"
          />

          <RatingRow
            label="Soreness"
            icon={Activity}
            value={soreness}
            onChange={setSoreness}
            lowLabel="Very sore"
            highLabel="Fresh"
          />

          <RatingRow
            label="Energy Level"
            icon={Zap}
            value={energy}
            onChange={setEnergy}
            lowLabel="Exhausted"
            highLabel="Energized"
          />
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !hasAnyRating}
            className="w-full h-12 text-base font-semibold"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Start Workout"
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            className="w-full text-muted-foreground"
          >
            <SkipForward className="size-4 mr-1.5" />
            Skip Check-In
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/workout/readiness-check.tsx
git commit -m "feat: add pre-workout readiness check-in component"
```

---

### Task 5: Create Superset Indicator Component

**Files:**
- Create: `src/components/workout/superset-indicator.tsx`

**Context:** A small visual component used between paired exercise cards in active-workout.tsx to show they are linked as a superset. Also includes a "Link" button that goes on exercise cards.

**Step 1: Create `src/components/workout/superset-indicator.tsx`**

```typescript
"use client";

import { Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SupersetLinkButtonProps {
  isLinked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function SupersetLinkButton({
  isLinked,
  onToggle,
  disabled = false,
}: SupersetLinkButtonProps) {
  return (
    <Button
      variant={isLinked ? "default" : "ghost"}
      size="icon-xs"
      onClick={onToggle}
      disabled={disabled}
      title={isLinked ? "Unlink superset" : "Link as superset with next exercise"}
    >
      {isLinked ? (
        <Link2Off className="size-3.5" />
      ) : (
        <Link2 className="size-3.5" />
      )}
    </Button>
  );
}

export function SupersetConnector() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5">
        <Link2 className="size-3 text-primary" />
        <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
          Superset
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/workout/superset-indicator.tsx
git commit -m "feat: add superset indicator and link button components"
```

---

### Task 6: Create Recovery Score Dashboard Component

**Files:**
- Create: `src/components/dashboard/recovery-score.tsx`

**Context:** Dashboard card following `weekly-summary.tsx` pattern. Fetches data from multiple sources (stats, nutrition, recovery), computes a 0-100 score, shows color-coded result with workout suggestion. Uses `getWeeklySummary()`, `getDailyTotals()`, `getRecentCheckins()`, and `getSettings()`.

**Step 1: Create `src/components/dashboard/recovery-score.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Heart, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  recentReadiness: number[]; // array of average scores (1-5)
}): RecoveryData {
  const factors: RecoveryData["factors"] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  // Factor 1: Training frequency (20%)
  const freqRatio = params.targetDays > 0
    ? params.daysThisWeek / params.targetDays
    : 0;
  // Sweet spot: 80-120% of target = good
  let freqScore: number;
  if (freqRatio >= 0.8 && freqRatio <= 1.2) {
    freqScore = 100;
  } else if (freqRatio < 0.8) {
    freqScore = (freqRatio / 0.8) * 100;
  } else {
    // Over-training penalty
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
    // Scale 1-5 → 0-100
    const readinessScore = ((avgReadiness - 1) / 4) * 100;
    factors.push({
      label: "Readiness",
      value: `${avgReadiness.toFixed(1)}/5`,
      status: readinessScore >= 70 ? "good" : readinessScore >= 40 ? "moderate" : "poor",
    });
    weightedSum += readinessScore * 30;
    totalWeight += 30;
  }

  // Factor 4: Rest days (30% base — always available)
  // More rest days since last workout = higher recovery
  // This replaces "training load" with a simpler signal
  const restDays = Math.max(0, 7 - params.daysThisWeek);
  const restScore = Math.min(100, (restDays / 3) * 100); // 3+ rest days = full score
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

        // Get avg daily calories for last 7 days
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

        // Average readiness from recent check-ins
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
        {/* Score display */}
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
              Based on training, nutrition & readiness
            </p>
          </div>
        </div>

        {/* Factor breakdown */}
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
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/dashboard/recovery-score.tsx
git commit -m "feat: add recovery score dashboard widget with multi-factor scoring"
```

---

### Task 7: Create Muscle Fatigue Map Dashboard Component

**Files:**
- Create: `src/components/dashboard/muscle-fatigue-map.tsx`

**Context:** Dashboard card showing muscle group pills color-coded by how recently each was trained. Uses `getSessionsForRange()` from workouts.ts and joins exercise muscle groups. Follows the card pattern from `weekly-summary.tsx`.

**Step 1: Create `src/components/dashboard/muscle-fatigue-map.tsx`**

```typescript
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
        const today = format(new Date(), "yyyy-MM-dd");

        // Get sets from last 7 days with exercise muscle group
        const { data: sets } = await supabase
          .from("workout_sets")
          .select(
            "logged_at, exercise:exercises(primary_muscle_group), session:workout_sessions!inner(user_id)"
          )
          .eq("workout_sessions.user_id", user.id)
          .gte("logged_at", `${since}T00:00:00`);

        // Find most recent day each muscle group was trained
        const lastTrained = new Map<string, string>();
        for (const set of sets || []) {
          const ex = Array.isArray(set.exercise) ? set.exercise[0] : set.exercise;
          const muscle = ex?.primary_muscle_group;
          if (!muscle) continue;

          const dateStr = format(new Date(set.logged_at), "yyyy-MM-dd");
          const existing = lastTrained.get(muscle);
          if (!existing || dateStr > existing) {
            lastTrained.set(muscle, dateStr);
          }
        }

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
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/dashboard/muscle-fatigue-map.tsx
git commit -m "feat: add muscle fatigue map dashboard widget"
```

---

### Task 8: Integrate Readiness Check-In into Active Workout Page

**Files:**
- Modify: `src/app/(app)/workout/active/page.tsx`

**Context:** The page loads the session from a `sessionId` search param. We need to add a readiness check-in overlay that shows before `<ActiveWorkout>` renders. After check-in (or skip), pass the mood_energy value to ActiveWorkout. Also update the session's `mood_energy` field in Supabase.

**Step 1: Modify `src/app/(app)/workout/active/page.tsx`**

Add import for ReadinessCheck:
```typescript
import { ReadinessCheck } from "@/components/workout/readiness-check";
```

Add new state variable to `ActiveWorkoutPageContent`:
```typescript
const [readinessDone, setReadinessDone] = useState(false);
```

Add a handler:
```typescript
async function handleReadinessComplete(moodEnergy: number | null) {
  setReadinessDone(true);
  // Update session's mood_energy
  if (moodEnergy !== null && session) {
    try {
      const supabase = createClient();
      await supabase
        .from("workout_sessions")
        .update({ mood_energy: moodEnergy })
        .eq("id", session.id);
    } catch {
      // Non-blocking
    }
  }
}
```

In the return statement, wrap the existing `<ActiveWorkout>` render so that when `!readinessDone && session`, show the readiness check-in overlay instead:

```tsx
return (
  <div className="p-4 md:p-8">
    {!readinessDone && session ? (
      <ReadinessCheck
        sessionId={session.id}
        onComplete={handleReadinessComplete}
      />
    ) : (
      <ActiveWorkout
        session={session}
        initialExercises={exercises}
      />
    )}
  </div>
);
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/app/(app)/workout/active/page.tsx
git commit -m "feat: add readiness check-in gate before active workout"
```

---

### Task 9: Add Auto-Rest Timer and Superset Mode to Active Workout

**Files:**
- Modify: `src/components/workout/active-workout.tsx`
- Modify: `src/components/workout/exercise-set-card.tsx`

**Context:** This is the largest modification task. We need to:
1. Load user settings to check `auto_rest_timer` and `auto_rest_seconds`
2. Add superset state tracking (which exercises are linked)
3. Pass `auto_rest_seconds` as `defaultDuration` to `<RestTimer>`
4. Modify set-logged handler to auto-trigger rest (respecting superset mode)
5. Add superset link buttons and connectors between cards

**Step 1: Modify `active-workout.tsx`**

Add imports at top:
```typescript
import { getSettings } from "@/lib/database/settings";
import { SupersetLinkButton, SupersetConnector } from "./superset-indicator";
import type { UserSettings } from "@/types";
```

Add new state variables inside `ActiveWorkout`:
```typescript
const [settings, setSettings] = useState<UserSettings | null>(null);
const [supersetPairs, setSupersetPairs] = useState<Set<string>>(new Set());
// supersetPairs stores exercise IDs that are linked to the NEXT exercise
```

Add useEffect to load settings:
```typescript
useEffect(() => {
  getSettings().then(setSettings).catch(() => {});
}, []);
```

Add superset toggle handler:
```typescript
const handleSupersetToggle = useCallback(
  (exerciseId: string) => {
    setSupersetPairs((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  },
  []
);
```

Modify `handleSetLogged` to include auto-rest and superset logic:
```typescript
const handleSetLogged = useCallback(
  (newSet: WorkoutSet, exerciseId: string) => {
    setSets((prev) => [...prev, newSet]);
    toast.success("Set logged", {
      description: `${newSet.weight} lbs x ${newSet.reps} reps`,
      duration: 2000,
    });

    // Superset logic: if this exercise is linked to next, scroll to next instead of rest
    if (supersetPairs.has(exerciseId)) {
      const currentIdx = exercises.findIndex((e) => e.id === exerciseId);
      const nextExercise = exercises[currentIdx + 1];
      if (nextExercise) {
        setActiveExerciseId(nextExercise.id);
        return; // Skip rest timer
      }
    }

    // Auto-rest timer
    if (settings?.auto_rest_timer) {
      setRestTimerTrigger((prev) => prev + 1);
    }
  },
  [supersetPairs, exercises, settings]
);
```

Update `<RestTimer>` to pass `defaultDuration`:
```tsx
<RestTimer
  trigger={restTimerTrigger}
  defaultDuration={settings?.auto_rest_seconds ?? 90}
/>
```

Update the exercise cards rendering section to include superset connectors and link buttons. Between exercise cards, show `<SupersetConnector />` when the exercise above is in `supersetPairs`:

```tsx
{exercises.map((exercise, idx) => (
  <div key={exercise.id}>
    {idx > 0 && supersetPairs.has(exercises[idx - 1].id) && (
      <SupersetConnector />
    )}
    <ExerciseSetCard
      exercise={exercise}
      sets={setsByExercise[exercise.id] || []}
      lastSessionSets={lastSessionCache[exercise.id] || []}
      sessionId={session.id}
      isActive={activeExerciseId === exercise.id}
      onActivate={() => setActiveExerciseId(exercise.id)}
      onSetLogged={(set) => handleSetLogged(set, exercise.id)}
      onSetDeleted={handleSetDeleted}
      onRestTimerTrigger={handleRestTimerTrigger}
      supersetLinkButton={
        idx < exercises.length - 1 ? (
          <SupersetLinkButton
            isLinked={supersetPairs.has(exercise.id)}
            onToggle={() => handleSupersetToggle(exercise.id)}
          />
        ) : undefined
      }
    />
  </div>
))}
```

**Step 2: Modify `exercise-set-card.tsx`**

Add `supersetLinkButton` to the `ExerciseSetCardProps` interface:
```typescript
supersetLinkButton?: React.ReactNode;
```

Add `supersetLinkButton` to the destructured props.

In the CardHeader, add the link button next to the collapse button:
```tsx
<div className="flex items-center gap-1">
  {supersetLinkButton}
  <Button ...> {/* existing collapse button */}
</div>
```

**Step 3: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add src/components/workout/active-workout.tsx src/components/workout/exercise-set-card.tsx
git commit -m "feat: add auto-rest timer and superset mode to active workout"
```

---

### Task 10: Add Plate Calculator Trigger to Set Logger

**Files:**
- Modify: `src/components/workout/set-logger.tsx`

**Context:** Add a small calculator icon button next to the weight input. When tapped, opens the PlateCalculator popover. Needs to know unit_preference from settings.

**Step 1: Modify `set-logger.tsx`**

Add imports:
```typescript
import { PlateCalculator } from "./plate-calculator";
import { Calculator } from "lucide-react";
```

Add props to `SetLoggerProps`:
```typescript
unitPreference?: "lbs" | "kg";
```

Add state for plate calculator visibility:
```typescript
const [showPlateCalc, setShowPlateCalc] = useState(false);
```

Add a calculator button next to the weight label:
```tsx
<Label htmlFor={`weight-${exercise.id}`} className="text-xs mb-1 flex items-center gap-1 text-muted-foreground">
  Weight ({unitPreference || "lbs"})
  <button
    type="button"
    onClick={() => setShowPlateCalc(true)}
    className="ml-auto text-primary hover:text-primary/80"
    title="Plate calculator"
  >
    <Calculator className="size-3.5" />
  </button>
</Label>
```

Add the PlateCalculator render at the bottom of the component (before closing `</div>`):
```tsx
{showPlateCalc && (
  <PlateCalculator
    weight={parseFloat(weight) || 0}
    unit={unitPreference || "lbs"}
    onClose={() => setShowPlateCalc(false)}
  />
)}
```

**Step 2: Pass `unitPreference` from `exercise-set-card.tsx`**

In `ExerciseSetCardProps`, add:
```typescript
unitPreference?: "lbs" | "kg";
```

Pass it through to `<SetLogger unitPreference={unitPreference} />`.

In `active-workout.tsx`, pass `unitPreference={settings?.unit_preference}` to each `<ExerciseSetCard>`.

**Step 3: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add src/components/workout/set-logger.tsx src/components/workout/exercise-set-card.tsx src/components/workout/active-workout.tsx
git commit -m "feat: add plate calculator to set logger weight input"
```

---

### Task 11: Add Auto-Rest Settings to Settings Page

**Files:**
- Modify: `src/components/settings/training-settings.tsx`

**Context:** Add a toggle for `auto_rest_timer` and a number input for `auto_rest_seconds` to the existing TrainingSettings component. These are saved alongside existing training settings.

**Step 1: Modify `training-settings.tsx`**

Add new state variables:
```typescript
const [autoRestTimer, setAutoRestTimer] = useState(settings.auto_rest_timer ?? false);
const [autoRestSeconds, setAutoRestSeconds] = useState(settings.auto_rest_seconds ?? 90);
```

Update `handleSave` to include the new fields:
```typescript
const updated = await updateSettings({
  preferred_split: preferredSplit,
  training_days_per_week: trainingDays,
  rotation_mode: rotationMode,
  auto_rest_timer: autoRestTimer,
  auto_rest_seconds: autoRestSeconds,
});
```

Add UI elements after the rotation mode section and before the save button. Add a toggle-style button for auto-rest and a seconds input:

```tsx
<div className="space-y-2">
  <Label>Auto-Rest Timer</Label>
  <div className="flex items-center justify-between rounded-lg border p-3">
    <div>
      <div className="font-medium text-sm">Auto-start rest timer</div>
      <div className="text-xs text-muted-foreground">
        Automatically start rest timer after logging a set
      </div>
    </div>
    <button
      type="button"
      onClick={() => setAutoRestTimer(!autoRestTimer)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        autoRestTimer ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          autoRestTimer ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  </div>
  {autoRestTimer && (
    <div className="space-y-1">
      <Label htmlFor="auto-rest-seconds">Default Rest Duration (seconds)</Label>
      <Input
        id="auto-rest-seconds"
        type="number"
        min={15}
        max={600}
        step={15}
        value={autoRestSeconds}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val) && val >= 15 && val <= 600) {
            setAutoRestSeconds(val);
          }
        }}
      />
    </div>
  )}
</div>
```

Import `cn` from `@/lib/utils` if not already imported.

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/settings/training-settings.tsx
git commit -m "feat: add auto-rest timer toggle and duration to training settings"
```

---

### Task 12: Add Recovery Widgets to Dashboard

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Context:** The dashboard page has a vertical stack of cards. Add RecoveryScore and MuscleFatigueMap after WeeklySummary and before the StreakCounter/RecentPRs grid.

**Step 1: Modify `src/app/(app)/page.tsx`**

Add imports:
```typescript
import { RecoveryScore } from "@/components/dashboard/recovery-score";
import { MuscleFatigueMap } from "@/components/dashboard/muscle-fatigue-map";
```

After `<WeeklySummary />` (around line 93) and before the grid of StreakCounter/RecentPRs, add:

```tsx
<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  <RecoveryScore />
  <MuscleFatigueMap />
</div>
```

**Step 2: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/app/(app)/page.tsx
git commit -m "feat: add recovery score and muscle fatigue map to dashboard"
```

---

### Task 13: Lint & Build Verification

**Files:** None (verification only)

**Step 1: Run ESLint**

```bash
npx eslint src/ --ext .ts,.tsx 2>&1 | tail -30
```

Fix any errors.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | tail -30
```

Fix any errors.

**Step 3: Test SSR build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

**Step 4: Test Capacitor build**

```bash
node scripts/cap-build.mjs 2>&1 | tail -20
```

Expected: Build succeeds.

**Step 5: Commit any lint/build fixes**

```bash
git add -A
git commit -m "fix: resolve lint and build errors for phase 19"
```

(Only if there were fixes needed.)

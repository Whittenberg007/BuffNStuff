# Phase 20: Strength Standards & 1RM + Cardio & Timer Modes — Design

## Goal

Add actual-1RM-based strength tracking with standards/levels for compound lifts, plus cardio session logging and EMOM/AMRAP timer modes.

## Principles

- **No estimated 1RM** — only actual tested weights (reps=1) count as 1RM. No Epley/Brzycki formulas. No "you could probably lift X."
- **Safety first** — the app never suggests a weight to attempt. It only reports what the user has actually done.
- **Strength standards** only display when the user has both a tested 1RM and a logged bodyweight.

---

## Architecture

### Strength Standards & PR Tracking

All computed client-side from existing `workout_sets` data. No new DB tables for strength — just new query functions against existing tables.

- **Actual 1RM**: heaviest `weight` where `reps = 1` per exercise
- **Rep maxes**: heaviest weight at rep counts 1, 3, 5, and overall best set
- **Strength levels**: compare actual 1RM to bodyweight using static lookup thresholds (beginner → elite)
- **Strength profile**: new tab on `/progress` page showing Big 4 summary + per-exercise PR cards

### Cardio

New `cardio_sessions` table (separate from weight-training `workout_sessions`). Fields: `activity_type`, `duration_seconds`, `distance`, `avg_pace`, `notes`. New `/workout/cardio` page for logging. Cardio tab on progress page for history/charts.

### Timer Modes

EMOM and AMRAP timers as a `WorkoutTimer` component reusing the existing `setInterval` + SVG ring pattern from RestTimer. Accessible from active workout page via timer icon in sticky header.

---

## Components & Data Flow

### Strength Utilities (`src/lib/utils/strength.ts`)

- `getStrengthLevel(weight1RM, bodyweight, exerciseKey)` — returns `"beginner" | "novice" | "intermediate" | "advanced" | "elite"` using static multiplier thresholds
- `STRENGTH_STANDARDS` — static lookup for ~8 compound lifts (bench, squat, deadlift, OHP, barbell row, pull-up, dip, front squat) with bodyweight multiplier thresholds per level
- No estimation formulas

### Strength Database (`src/lib/database/strength.ts`)

- `getRepMaxes(exerciseId)` — queries `workout_sets` for heaviest weight at rep counts 1, 3, 5, and overall best. Pure query, no math.
- `getAllExercisePRs()` — fetches the single heaviest set (any rep count) per exercise for the PR board
- `get1RMHistory(exerciseId, days)` — tracks actual 1RM (heaviest single) over time

### Strength Profile Tab (new tab on `/progress`)

- `StrengthProfile` component
  - Big 4 summary at top: Squat / Bench / Deadlift / OHP
  - Each shows actual 1RM with strength level badge (only if tested), "Not tested" otherwise
  - Per exercise cards: 1RM / 3RM / 5RM / Best Set
  - Strength level badges: color-coded (gray=beginner, green=novice, blue=intermediate, purple=advanced, gold=elite)
  - 1RM trend chart showing actual singles over time

### Cardio Types & Database

**Types** (`src/types/database.ts`):
```typescript
export type CardioActivityType = "run" | "bike" | "row" | "swim" | "walk";

export interface CardioSession {
  id: string;
  user_id: string;
  activity_type: CardioActivityType;
  duration_seconds: number;
  distance: number | null;       // in user's unit preference (mi or km)
  avg_pace: number | null;       // seconds per mile/km
  notes: string | null;
  completed_at: string;
  created_at: string;
}
```

**Database** (`src/lib/database/cardio.ts`):
- `logCardioSession({activity_type, duration_seconds, distance?, notes?})` — auto-computes avg_pace when distance provided
- `getCardioHistory(days)` — returns recent sessions
- `getCardioStats(days)` — total distance, total duration, session count

### Cardio Log Page (`/workout/cardio`)

- Activity type selector pills (Run / Bike / Row / Swim / Walk)
- Duration input (mm:ss or numeric minutes)
- Distance input (optional, with unit display from settings)
- Auto-computes and displays pace when both distance and duration provided
- Recent cardio sessions list below the form

### Cardio Progress Tab (new tab on `/progress`)

- Distance/duration chart over time (Recharts line chart)
- Filterable by activity type
- Summary stats: total distance, total time, avg pace, session count

### Timer Modes (`src/components/workout/workout-timer.tsx`)

- Mode selector: EMOM / AMRAP
- **EMOM**: configurable interval (30s–5min) and total rounds, counts down per interval then resets with haptic
- **AMRAP**: configurable total duration (1–60 min), counts up with round counter button
- Uses same SVG ring + haptic pattern as RestTimer
- Accessible from active workout page via timer icon in sticky header

---

## Error Handling & Edge Cases

### Strength Standards
- **No bodyweight logged**: strength level badges show "Log bodyweight to see level". 1RM/3RM/5RM values display normally.
- **Exercise name matching**: strength standards only apply to ~8 compound lifts. Case-insensitive substring match (e.g., "Barbell Bench Press" matches "bench"). No match = no strength level shown, just raw PR numbers.
- **No sets logged**: exercises show "No data yet". Big 4 summary shows "Not tested" per lift with no singles.

### Cardio
- **Missing fields**: duration required, distance optional. Pace only computes when both provided.
- **Unit consistency**: distance stored in user's unit preference (mi/km from `unit_preference`). Pace displayed as min/mi or min/km.
- **Zero duration**: input validation prevents saving 0 or negative duration.

### Timer Modes
- **Background/minimize**: timer uses `setInterval` which pauses when backgrounded. Resumes by computing elapsed from timestamps rather than interval ticks.
- **Haptic fallback**: EMOM fires haptic at each interval boundary, AMRAP at time-up. Falls back gracefully on web (visual only).
- **Concurrent timers**: only one timer active at a time. Starting EMOM/AMRAP dismisses any active rest timer, and vice versa.

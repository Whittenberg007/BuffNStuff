# Phase 19: Workout Session UX + Recovery & Readiness Tracking — Design

## Goal

Enhance the live workout experience with practical missing features (plate calculator, auto-rest timer, previous performance overlay, superset mode) and add a recovery scoring system that uses existing training/nutrition data plus new readiness check-ins to recommend workout intensity.

## Architecture

**No new routes.** Recovery integrates into existing `/workout` and dashboard.

### New Components (6)

| Component | Path | Purpose |
|-----------|------|---------|
| PlateCalculator | `src/components/workout/plate-calculator.tsx` | Modal/popover showing plates per side for a given weight |
| PreviousPerformance | `src/components/workout/previous-performance.tsx` | Inline display of last session's sets for an exercise |
| SupersetIndicator | `src/components/workout/superset-indicator.tsx` | Visual linking of paired exercises |
| ReadinessCheck | `src/components/workout/readiness-check.tsx` | Pre-workout 3-question check-in (sleep, soreness, energy) |
| RecoveryScore | `src/components/dashboard/recovery-score.tsx` | Dashboard card with 0-100 score + workout suggestion |
| MuscleFatigueMap | `src/components/dashboard/muscle-fatigue-map.tsx` | Visual indicator of fresh/fatigued muscle groups |

### Modified Components

| Component | Changes |
|-----------|---------|
| `active-workout.tsx` | Auto-rest trigger after set log, superset mode, previous performance integration |
| `rest-timer.tsx` | Accept auto-start config, superset skip behavior |
| `workout/active/page.tsx` | Readiness check-in gate before session starts |
| Dashboard `page.tsx` | Add RecoveryScore and MuscleFatigueMap cards |
| Settings `page.tsx` | Auto-rest timer toggle + duration setting |

### New Database Layer

- `src/lib/database/recovery.ts` — readiness check-in CRUD, recovery score computation

### New DB Table

```sql
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
```

### Settings Extension

Add to `user_settings` table:
- `auto_rest_timer` BOOLEAN DEFAULT false
- `auto_rest_seconds` SMALLINT DEFAULT 90

---

## Component Details

### Plate Calculator

- Triggered by tapping/long-pressing a weight value in the set row
- Shows popover/bottom sheet with bar weight (45 lbs / 20 kg based on `unit_preference`) and plates per side
- Standard plate sizes: 45, 35, 25, 10, 5, 2.5 lbs (or 20, 15, 10, 5, 2.5, 1.25 kg)
- Greedy algorithm: largest plates first
- If weight isn't achievable exactly, show nearest achievable weight
- Pure client-side calculation, no DB calls

### Previous Performance

- On session load, fetch last session's sets for each exercise via existing `getExerciseHistory()`
- Display as ghost/muted text on each set row: "Last: 185 x 8"
- Loaded once at session start, cached in component state

### Auto-Rest Timer

- After `logSet()` succeeds, if `auto_rest_timer` enabled in settings, increment `restTimerTrigger`
- `auto_rest_seconds` determines duration (default 90s)
- Skipped when in superset mode (rest only after completing the paired set)

### Superset Mode

- User taps "Link" button on an exercise card to pair it with the next exercise
- Paired exercises show visual connector (chain icon + colored border)
- After logging set on exercise A → auto-scroll to exercise B (no rest)
- After logging set on exercise B → trigger rest timer
- Stored in component state only (session-level UX, not persisted)

### Readiness Check-In

- Full-screen overlay when navigating to `/workout/active` before session begins
- Three button-row inputs: Sleep Quality (1-5), Soreness (1-5), Energy (1-5)
- "Skip" option available — defaults to null values
- Saved to `readiness_checkins` table, linked to session_id
- Average of scores becomes the session's `mood_energy` value

### Recovery Score (Dashboard)

Computed client-side from last 7 days:

| Factor | Weight | Source |
|--------|--------|--------|
| Training load | 30% | Weekly volume vs typical volume (from analytics) |
| Frequency | 20% | Sessions this week vs `training_days_per_week` |
| Nutrition | 20% | Avg daily calories vs target |
| Readiness trend | 30% | Average of last 3 readiness check-in scores |

- Score 0-100, color-coded: green (70+), yellow (40-69), red (0-39)
- Suggestion text: "Go hard" / "Moderate day" / "Consider deload"
- Factors reweight proportionally when data is missing

### Muscle Fatigue Map

- Grid of muscle group pills (chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core)
- Color based on last trained: green (3+ days ago), yellow (1-2 days), red (today)
- Data from `getSessionsForRange()` + exercise muscle group mapping

---

## Error Handling & Edge Cases

- **No previous session data:** Shows "No history" — doesn't block set logging
- **Plate calculator impossible weight:** Weight < bar → "Just the bar". Remainder not divisible → show nearest achievable with "(closest)" label
- **Readiness skipped:** Recovery score excludes readiness factor, reweights remaining factors
- **No nutrition data:** Nutrition factor excluded, remaining factors reweight
- **Superset with last exercise:** "Link" button hidden on last exercise
- **Auto-rest during superset:** Suppressed between paired exercises, fires after second exercise's set
- **Settings not saved yet:** `auto_rest_timer` defaults false, `auto_rest_seconds` defaults 90 — no behavior change for existing users

## Build Compatibility

No new API routes. All queries are client-side Supabase. Works on both Vercel SSR and Capacitor static export.

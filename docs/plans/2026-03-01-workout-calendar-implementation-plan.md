# Phase 17: Workout Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visual calendar showing completed workouts and upcoming program days projected onto real dates.

**Architecture:** Two new pages (`/calendar` and `/calendar/day/[date]`), a pure-function calendar lib (`src/lib/calendar.ts`), a new data-fetch function in workouts.ts, and 5 calendar components. No new DB tables — uses existing `workout_sessions` and `ProgramEnrollment` data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, date-fns, Supabase, shadcn/ui (Card, Button, Badge, Separator), lucide-react (CalendarDays icon)

---

### Task 1: Calendar utility functions (`src/lib/calendar.ts`)

Pure functions with no DB or React dependencies. The foundation everything else builds on.

**Files:**
- Create: `src/lib/calendar.ts`

**Context:**
- `SplitType` = `"push" | "pull" | "legs" | "upper" | "lower" | "full_body" | "custom"` (defined in `src/types/database.ts:6`)
- `ProgramEnrollment` has `started_at: string`, `current_week: number`, `current_day_index: number`, `progress_log: Record<string, unknown>`, `program?: TrainingProgram` (defined in `src/types/database.ts:380-391`)
- `ProgramDay` has `day_of_week: number` (1=Mon..7=Sun), `label: string`, `exercises: ProgramExercise[]` (`src/types/database.ts:344-353`)
- `ProgramSchedule` has `weeks: ProgramWeek[]`, `repeat_from_week?: number` (`src/types/database.ts:332-335`)
- date-fns is already installed — use `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `addDays`, `addWeeks`, `format`, `isSameDay`, `isToday`, `isBefore`, `isAfter`, `nextMonday`, `getDay`

**Step 1: Create the calendar utility module**

```typescript
// src/lib/calendar.ts
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  format,
  isToday,
  isBefore,
  nextMonday,
  getDay,
} from "date-fns";
import type {
  SplitType,
  ProgramEnrollment,
  ProgramDay,
} from "@/types";

// --- Split color mapping ---

const SPLIT_COLORS: Record<string, string> = {
  push: "bg-blue-500",
  pull: "bg-green-500",
  legs: "bg-orange-500",
  upper: "bg-purple-500",
  lower: "bg-amber-500",
  full_body: "bg-pink-500",
  custom: "bg-zinc-400",
};

const SPLIT_COLORS_OUTLINE: Record<string, string> = {
  push: "border-blue-500",
  pull: "border-green-500",
  legs: "border-orange-500",
  upper: "border-purple-500",
  lower: "border-amber-500",
  full_body: "border-pink-500",
  custom: "border-zinc-400",
};

export function getSplitColor(splitType: SplitType | null): string {
  return SPLIT_COLORS[splitType || "custom"] || SPLIT_COLORS.custom;
}

export function getSplitOutlineColor(splitType: SplitType | null): string {
  return SPLIT_COLORS_OUTLINE[splitType || "custom"] || SPLIT_COLORS_OUTLINE.custom;
}

// --- Month grid helpers ---

export interface CalendarDay {
  date: string; // "yyyy-MM-dd"
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getMonthGrid(year: number, month: number): CalendarDay[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: CalendarDay[] = [];
  let current = gridStart;
  while (current <= gridEnd) {
    days.push({
      date: format(current, "yyyy-MM-dd"),
      isCurrentMonth:
        current.getMonth() === monthStart.getMonth(),
      isToday: isToday(current),
    });
    current = addDays(current, 1);
  }
  return days;
}

export function getMonthRange(
  year: number,
  month: number
): { start: string; end: string } {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return {
    start: gridStart.toISOString(),
    end: gridEnd.toISOString(),
  };
}

// --- Program day projection ---

export interface ProjectedProgramDay {
  date: string; // "yyyy-MM-dd"
  day: ProgramDay;
  weekNumber: number;
  weekLabel: string;
  isDeload: boolean;
  status: "completed" | "upcoming" | "today";
}

export function projectProgramDays(
  enrollment: ProgramEnrollment
): ProjectedProgramDay[] {
  const program = enrollment.program;
  if (!program) return [];

  const schedule = program.schedule;
  if (!schedule?.weeks?.length) return [];

  const result: ProjectedProgramDay[] = [];
  const enrollDate = new Date(enrollment.started_at);

  // Week 1 starts on the Monday of or after enrollment date
  // getDay: 0=Sun, 1=Mon..6=Sat. If already Monday use it, else next Monday.
  const enrollDow = getDay(enrollDate);
  const week1Start =
    enrollDow === 1 ? enrollDate : nextMonday(enrollDate);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // How many weeks to project: up to 4 weeks past current week, capped at 12
  const projectWeeks = Math.min(
    enrollment.current_week + 4,
    schedule.repeat_from_week !== undefined ? enrollment.current_week + 8 : schedule.weeks.length
  );

  for (let w = 0; w < projectWeeks; w++) {
    // Resolve actual week index (handle cycling)
    let weekIndex = w;
    if (weekIndex >= schedule.weeks.length) {
      if (schedule.repeat_from_week !== undefined) {
        const cycleLength = schedule.weeks.length - (schedule.repeat_from_week - 1);
        weekIndex =
          (schedule.repeat_from_week - 1) +
          ((weekIndex - (schedule.repeat_from_week - 1)) % cycleLength);
      } else {
        break;
      }
    }

    const week = schedule.weeks[weekIndex];
    if (!week) continue;

    const weekStart = addWeeks(week1Start, w);

    for (let d = 0; d < week.days.length; d++) {
      const day = week.days[d];
      // day_of_week: 1=Mon..7=Sun → offset from Monday: (dow - 1)
      const dayDate = addDays(weekStart, day.day_of_week - 1);
      const dateStr = format(dayDate, "yyyy-MM-dd");

      // Check if completed in progress_log
      const progressKey = `w${w + 1}d${d}`;
      const isCompleted = !!enrollment.progress_log[progressKey];

      let status: "completed" | "upcoming" | "today" = "upcoming";
      if (isCompleted) {
        status = "completed";
      } else if (dateStr === todayStr) {
        status = "today";
      } else if (isBefore(dayDate, today)) {
        // Past but not completed — still show as upcoming (missed)
        status = "upcoming";
      }

      result.push({
        date: dateStr,
        day,
        weekNumber: w + 1,
        weekLabel: week.label,
        isDeload: !!week.is_deload,
        status,
      });
    }
  }

  return result;
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/calendar.ts 2>&1 || echo "Check errors"`

If date-fns imports fail, verify with: `ls node_modules/date-fns/` — it's already installed (used throughout the app).

**Step 3: Commit**

```bash
git add src/lib/calendar.ts
git commit -m "feat(calendar): add calendar utility functions for month grid and program projection"
```

---

### Task 2: Data function — `getSessionsForRange` in workouts.ts

**Files:**
- Modify: `src/lib/database/workouts.ts` (append new function at end of file)

**Context:**
- Follow the existing auth pattern: `createClient()` → `supabase.auth.getUser()` → check user → query with `.eq("user_id", user.id)`
- Import `createClient` from `@/lib/supabase/client` (already imported in this file)
- The `workout_sets` table has `weight`, `reps`, `session_id` columns
- Filter completed sessions: `.not("ended_at", "is", null)`
- Date range filter: `.gte("started_at", start).lte("started_at", end)`

**Step 1: Add the CalendarSession interface and function**

Append to the end of `src/lib/database/workouts.ts`:

```typescript
// --- Calendar data ---

export interface CalendarSession {
  id: string;
  started_at: string;
  ended_at: string;
  split_type: SplitType | null;
  notes: string | null;
  totalSets: number;
  totalVolume: number;
  exercises: string[];
  prCount: number;
}

export async function getSessionsForRange(
  startDate: string,
  endDate: string
): Promise<CalendarSession[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select("id, started_at, ended_at, split_type, notes")
    .eq("user_id", user.id)
    .not("ended_at", "is", null)
    .gte("started_at", startDate)
    .lte("started_at", endDate)
    .order("started_at", { ascending: true });

  if (error) throw error;
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("session_id, weight, reps, is_pr, exercise:exercises(name)")
    .in("session_id", sessionIds);

  // Aggregate per session
  return sessions.map((s) => {
    const sessionSets = (sets || []).filter((set) => set.session_id === s.id);
    const exerciseNames = new Set<string>();
    let volume = 0;
    let prs = 0;
    for (const set of sessionSets) {
      volume += set.weight * set.reps;
      if (set.is_pr) prs++;
      const name = (set.exercise as unknown as { name: string }[] | null)?.[0]?.name;
      if (name) exerciseNames.add(name);
    }
    return {
      id: s.id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      split_type: s.split_type as SplitType | null,
      notes: s.notes,
      totalSets: sessionSets.length,
      totalVolume: volume,
      exercises: Array.from(exerciseNames),
      prCount: prs,
    };
  });
}
```

Note: `SplitType` may need importing at the top of the file if not already imported. Check and add `import type { SplitType } from "@/types";` if needed.

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/database/workouts.ts
git commit -m "feat(calendar): add getSessionsForRange for calendar date queries"
```

---

### Task 3: DayCell component

**Files:**
- Create: `src/components/calendar/day-cell.tsx`

**Context:**
- This is one cell in the month grid
- Shows: day number, colored dot(s) for completed workouts, outlined dot for scheduled program day, today ring
- Uses `getSplitColor()` and `getSplitOutlineColor()` from `src/lib/calendar.ts`
- Tap → navigates to `/calendar/day/[date]`

**Step 1: Create the component**

```typescript
// src/components/calendar/day-cell.tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getSplitColor, getSplitOutlineColor } from "@/lib/calendar";
import type { CalendarSession } from "@/lib/database/workouts";
import type { ProjectedProgramDay } from "@/lib/calendar";

interface DayCellProps {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: CalendarSession[];
  scheduledDay: ProjectedProgramDay | null;
}

export function DayCell({
  date,
  dayNumber,
  isCurrentMonth,
  isToday,
  sessions,
  scheduledDay,
}: DayCellProps) {
  const hasWorkout = sessions.length > 0;
  const hasScheduled = scheduledDay !== null && scheduledDay.status !== "completed";

  return (
    <Link
      href={`/calendar/day/${date}`}
      className={cn(
        "flex flex-col items-center justify-start p-1 min-h-[3rem] rounded-md transition-colors hover:bg-muted/50",
        !isCurrentMonth && "opacity-30"
      )}
    >
      <span
        className={cn(
          "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
          isToday && "bg-primary text-primary-foreground",
          !isToday && isCurrentMonth && "text-foreground",
          !isToday && !isCurrentMonth && "text-muted-foreground"
        )}
      >
        {dayNumber}
      </span>
      <div className="flex items-center gap-0.5 mt-0.5">
        {hasWorkout &&
          sessions.map((s) => (
            <span
              key={s.id}
              className={cn("size-1.5 rounded-full", getSplitColor(s.split_type))}
            />
          ))}
        {hasScheduled && !hasWorkout && (
          <span
            className={cn(
              "size-1.5 rounded-full border",
              getSplitOutlineColor(null)
            )}
          />
        )}
      </div>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/calendar/day-cell.tsx
git commit -m "feat(calendar): add DayCell component for month grid"
```

---

### Task 4: CalendarNav component

**Files:**
- Create: `src/components/calendar/calendar-nav.tsx`

**Context:**
- Segmented control for Month/Week toggle
- Prev/Next arrows for navigating months or weeks
- Display current month name + year (e.g., "March 2026")
- Uses `format` from date-fns, `ChevronLeft`/`ChevronRight` from lucide-react

**Step 1: Create the component**

```typescript
// src/components/calendar/calendar-nav.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarView = "month" | "week";

interface CalendarNavProps {
  title: string;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarNav({
  title,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: CalendarNavProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onPrev}>
            <ChevronLeft className="size-5" />
          </Button>
          <button
            onClick={onToday}
            className="text-lg font-semibold hover:underline min-w-[10rem] text-center"
          >
            {title}
          </button>
          <Button variant="ghost" size="icon" onClick={onNext}>
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border bg-muted p-0.5">
          <button
            onClick={() => onViewChange("month")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              view === "month"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Month
          </button>
          <button
            onClick={() => onViewChange("week")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              view === "week"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Week
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/calendar/calendar-nav.tsx
git commit -m "feat(calendar): add CalendarNav with month/week toggle"
```

---

### Task 5: MonthCalendar component

**Files:**
- Create: `src/components/calendar/month-calendar.tsx`

**Context:**
- Renders a 7-column grid of DayCells for the current month
- Header row: Mon Tue Wed Thu Fri Sat Sun
- Uses `getMonthGrid()` from `src/lib/calendar.ts` to get the day array
- Receives `sessions` (indexed by date) and `scheduledDays` (indexed by date) as props
- Footer: month stats (total sessions, total volume, training days)

**Step 1: Create the component**

```typescript
// src/components/calendar/month-calendar.tsx
"use client";

import { useMemo } from "react";
import { Dumbbell, Flame, TrendingUp } from "lucide-react";
import { getMonthGrid } from "@/lib/calendar";
import { DayCell } from "./day-cell";
import type { CalendarSession } from "@/lib/database/workouts";
import type { ProjectedProgramDay } from "@/lib/calendar";

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MonthCalendarProps {
  year: number;
  month: number;
  sessionsByDate: Record<string, CalendarSession[]>;
  scheduledByDate: Record<string, ProjectedProgramDay>;
}

export function MonthCalendar({
  year,
  month,
  sessionsByDate,
  scheduledByDate,
}: MonthCalendarProps) {
  const days = useMemo(() => getMonthGrid(year, month), [year, month]);

  // Month stats
  const monthSessions = Object.values(sessionsByDate).flat();
  const totalSessions = monthSessions.length;
  const totalVolume = monthSessions.reduce((s, sess) => s + sess.totalVolume, 0);
  const trainingDays = Object.keys(sessionsByDate).filter(
    (d) => sessionsByDate[d].length > 0
  ).length;

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <DayCell
            key={day.date}
            date={day.date}
            dayNumber={parseInt(day.date.split("-")[2], 10)}
            isCurrentMonth={day.isCurrentMonth}
            isToday={day.isToday}
            sessions={sessionsByDate[day.date] || []}
            scheduledDay={scheduledByDate[day.date] || null}
          />
        ))}
      </div>

      {/* Month stats footer */}
      {totalSessions > 0 && (
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Dumbbell className="size-3" />
            {trainingDays} day{trainingDays !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3" />
            {totalSessions} session{totalSessions !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="size-3" />
            {totalVolume.toLocaleString()} lbs
          </span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/calendar/month-calendar.tsx
git commit -m "feat(calendar): add MonthCalendar grid component"
```

---

### Task 6: WeekStrip component

**Files:**
- Create: `src/components/calendar/week-strip.tsx`

**Context:**
- Horizontal 7-day strip for the current week
- Each card shows: day name, date number, split label + volume (completed) or program day label + exercise count (scheduled) or "Rest"
- Arrow navigation to prev/next week
- Uses `startOfWeek`, `addDays`, `format` from date-fns

**Step 1: Create the component**

```typescript
// src/components/calendar/week-strip.tsx
"use client";

import Link from "next/link";
import { format, addDays, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { getSplitColor } from "@/lib/calendar";
import type { CalendarSession } from "@/lib/database/workouts";
import type { ProjectedProgramDay } from "@/lib/calendar";

interface WeekStripProps {
  weekStart: Date;
  sessionsByDate: Record<string, CalendarSession[]>;
  scheduledByDate: Record<string, ProjectedProgramDay>;
}

export function WeekStrip({
  weekStart,
  sessionsByDate,
  scheduledByDate,
}: WeekStripProps) {
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: format(d, "yyyy-MM-dd"),
      dayName: format(d, "EEE"),
      dayNum: format(d, "d"),
      isToday: format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
    };
  });

  return (
    <div className="grid grid-cols-7 gap-1">
      {weekDays.map((wd) => {
        const sessions = sessionsByDate[wd.date] || [];
        const scheduled = scheduledByDate[wd.date] || null;
        const hasWorkout = sessions.length > 0;
        const hasScheduled = scheduled && scheduled.status !== "completed";

        return (
          <Link
            key={wd.date}
            href={`/calendar/day/${wd.date}`}
            className={cn(
              "flex flex-col items-center rounded-lg border p-2 min-h-[5rem] transition-colors hover:bg-muted/50",
              wd.isToday && "border-primary",
              hasWorkout && "bg-muted/30"
            )}
          >
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              {wd.dayName}
            </span>
            <span
              className={cn(
                "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                wd.isToday && "bg-primary text-primary-foreground"
              )}
            >
              {wd.dayNum}
            </span>

            <div className="mt-auto text-center">
              {hasWorkout ? (
                <>
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full mb-0.5",
                      getSplitColor(sessions[0].split_type)
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {sessions[0].totalSets} sets
                  </p>
                </>
              ) : hasScheduled ? (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {scheduled.day.label}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground/50">Rest</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/calendar/week-strip.tsx
git commit -m "feat(calendar): add WeekStrip 7-day horizontal view"
```

---

### Task 7: DayDetailCard component

**Files:**
- Create: `src/components/calendar/day-detail-card.tsx`

**Context:**
- Shows details for completed sessions or scheduled program days on a given date
- Completed session: duration, exercises, sets, volume, PRs, split badge
- Scheduled day: program name, week/day label, exercises with sets/reps/RPE, "Start This Workout" button
- Uses Card, Badge from shadcn/ui

**Step 1: Create the component**

```typescript
// src/components/calendar/day-detail-card.tsx
"use client";

import Link from "next/link";
import { Clock, Dumbbell, Flame, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSplitColor } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { CalendarSession } from "@/lib/database/workouts";
import type { ProjectedProgramDay } from "@/lib/calendar";

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

interface SessionCardProps {
  session: CalendarSession;
}

function SessionCard({ session }: SessionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span
              className={cn("size-3 rounded-full", getSplitColor(session.split_type))}
            />
            {session.split_type
              ? session.split_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : "Workout"}
          </CardTitle>
          {session.split_type && (
            <Badge variant="secondary" className="text-xs">
              {session.split_type.replace("_", " ").toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(session.started_at, session.ended_at)}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3" />
            {session.totalSets} sets
          </span>
          <span className="flex items-center gap-1">
            <Flame className="size-3" />
            {session.totalVolume.toLocaleString()} lbs
          </span>
          {session.prCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-500">
              <Trophy className="size-3" />
              {session.prCount} PR{session.prCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {session.exercises.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {session.exercises.map((name) => (
              <Badge key={name} variant="outline" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        )}
        {session.notes && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            {session.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ScheduledDayCardProps {
  scheduled: ProjectedProgramDay;
  programName: string;
}

function ScheduledDayCard({ scheduled, programName }: ScheduledDayCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="size-4 text-muted-foreground" />
            {scheduled.day.label}
          </CardTitle>
          {scheduled.isDeload && (
            <Badge variant="secondary" className="text-xs">
              Deload
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {programName} — {scheduled.weekLabel}
        </p>
      </CardHeader>
      <CardContent>
        {scheduled.day.exercises.length > 0 && (
          <div className="space-y-1 mb-3">
            {scheduled.day.exercises.map((ex, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span>{ex.exercise_name}</span>
                <span className="text-xs text-muted-foreground">
                  {ex.sets} x {ex.reps}
                  {ex.rpe_target ? ` @RPE ${ex.rpe_target}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/workout">
          <Button className="w-full" size="sm">
            Start This Workout
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

interface DayDetailCardProps {
  sessions: CalendarSession[];
  scheduled: ProjectedProgramDay | null;
  programName: string;
}

export function DayDetailCard({
  sessions,
  scheduled,
  programName,
}: DayDetailCardProps) {
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
      {scheduled && scheduled.status !== "completed" && (
        <ScheduledDayCard scheduled={scheduled} programName={programName} />
      )}
      {sessions.length === 0 && !scheduled && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <Dumbbell className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No workout this day</p>
            <Link href="/workout" className="mt-3">
              <Button variant="outline" size="sm">
                Start Workout
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/calendar/day-detail-card.tsx
git commit -m "feat(calendar): add DayDetailCard for session and scheduled day display"
```

---

### Task 8: Calendar page (`/calendar`)

**Files:**
- Create: `src/app/(app)/calendar/page.tsx`

**Context:**
- Uses CalendarNav (month/week toggle), MonthCalendar, WeekStrip
- Fetches `getSessionsForRange()` and `getActiveEnrollment()` on mount and when month changes
- Uses `projectProgramDays()` to get scheduled days
- Indexes data by date for fast lookup
- Loading state with spinner (pattern from progress/page.tsx)

**Step 1: Create the page**

```typescript
// src/app/(app)/calendar/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, subMonths, addWeeks, subWeeks, startOfWeek, format } from "date-fns";
import { CalendarDays, Loader2 } from "lucide-react";
import { CalendarNav, type CalendarView } from "@/components/calendar/calendar-nav";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { WeekStrip } from "@/components/calendar/week-strip";
import { getSessionsForRange, type CalendarSession } from "@/lib/database/workouts";
import { getActiveEnrollment } from "@/lib/database/programs";
import { getMonthRange, projectProgramDays, type ProjectedProgramDay } from "@/lib/calendar";
import type { ProgramEnrollment } from "@/types";

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [enrollment, setEnrollment] = useState<ProgramEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const range = getMonthRange(year, month);
      const [sessionsData, enrollmentData] = await Promise.all([
        getSessionsForRange(range.start, range.end),
        getActiveEnrollment(),
      ]);
      setSessions(sessionsData);
      setEnrollment(enrollmentData);
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Index sessions by date
  const sessionsByDate = useMemo(() => {
    const map: Record<string, CalendarSession[]> = {};
    for (const s of sessions) {
      const dateKey = format(new Date(s.started_at), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(s);
    }
    return map;
  }, [sessions]);

  // Project program days indexed by date
  const scheduledByDate = useMemo(() => {
    if (!enrollment) return {};
    const projected = projectProgramDays(enrollment);
    const map: Record<string, ProjectedProgramDay> = {};
    for (const p of projected) {
      map[p.date] = p;
    }
    return map;
  }, [enrollment]);

  const title =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(weekStart, "MMM d")}`;

  function handlePrev() {
    setCurrentDate((d) =>
      view === "month" ? subMonths(d, 1) : subWeeks(d, 1)
    );
  }

  function handleNext() {
    setCurrentDate((d) =>
      view === "month" ? addMonths(d, 1) : addWeeks(d, 1)
    );
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="size-6" />
          Calendar
        </h1>
        <p className="text-sm text-muted-foreground">
          View your workouts and upcoming schedule.
        </p>
      </div>

      <CalendarNav
        title={title}
        view={view}
        onViewChange={setView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : view === "month" ? (
        <MonthCalendar
          year={year}
          month={month}
          sessionsByDate={sessionsByDate}
          scheduledByDate={scheduledByDate}
        />
      ) : (
        <WeekStrip
          weekStart={weekStart}
          sessionsByDate={sessionsByDate}
          scheduledByDate={scheduledByDate}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/calendar/page.tsx
git commit -m "feat(calendar): add calendar page with month and week views"
```

---

### Task 9: Day detail page (`/calendar/day/[date]`)

**Files:**
- Create: `src/app/(app)/calendar/day/[date]/page.tsx`

**Context:**
- Dynamic route: `params.date` is a `yyyy-MM-dd` string
- Fetches sessions for that specific date and the active enrollment
- Uses `DayDetailCard` component
- Shows date header with back navigation to `/calendar`
- Next.js 16 App Router: dynamic params are in the `params` prop

**Step 1: Create the page**

```typescript
// src/app/(app)/calendar/day/[date]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayDetailCard } from "@/components/calendar/day-detail-card";
import { getSessionsForRange, type CalendarSession } from "@/lib/database/workouts";
import { getActiveEnrollment } from "@/lib/database/programs";
import { projectProgramDays, type ProjectedProgramDay } from "@/lib/calendar";

export default function DayDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = use(params);
  const router = useRouter();
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [scheduled, setScheduled] = useState<ProjectedProgramDay | null>(null);
  const [programName, setProgramName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const dayStart = new Date(date + "T00:00:00").toISOString();
        const dayEnd = new Date(date + "T23:59:59").toISOString();

        const [sessionsData, enrollment] = await Promise.all([
          getSessionsForRange(dayStart, dayEnd),
          getActiveEnrollment(),
        ]);

        setSessions(sessionsData);

        if (enrollment) {
          setProgramName(enrollment.program?.name || "Program");
          const projected = projectProgramDays(enrollment);
          const match = projected.find((p) => p.date === date);
          setScheduled(match || null);
        }
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [date]);

  const displayDate = format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy");

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/calendar")}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{displayDate}</h1>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DayDetailCard
          sessions={sessions}
          scheduled={scheduled}
          programName={programName}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add "src/app/(app)/calendar/day/[date]/page.tsx"
git commit -m "feat(calendar): add day detail page with session and program info"
```

---

### Task 10: Add Calendar to navigation

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx`
- Modify: `src/components/layout/sidebar-nav.tsx`

**Context:**
- Bottom nav currently has 6 tabs: Dashboard, Workout, Exercises, Nutrition, Coach, Progress
- Sidebar nav has 7 items: Dashboard, Workout, Exercises, Nutrition, Progress, Coach, Settings
- Design says: insert Calendar between Exercises and Nutrition in both
- Use `CalendarDays` icon from lucide-react

**Step 1: Update bottom-nav.tsx**

In `src/components/layout/bottom-nav.tsx`:

1. Add `CalendarDays` to the lucide-react import (line 6):
   - Change: `import { Home, Dumbbell, BookOpen, Apple, Bot, BarChart3 } from "lucide-react";`
   - To: `import { Home, Dumbbell, BookOpen, CalendarDays, Apple, Bot, BarChart3 } from "lucide-react";`

2. Add calendar tab to the `tabs` array after `{ href: "/exercises", ... }` (between Exercises and Nutrition):
   ```typescript
   { href: "/calendar", label: "Calendar", icon: CalendarDays },
   ```

**Step 2: Update sidebar-nav.tsx**

In `src/components/layout/sidebar-nav.tsx`:

1. Add `CalendarDays` to the lucide-react import (line 6):
   - Change: `import { Home, Dumbbell, BookOpen, Apple, BarChart3, Settings, LogOut, Bot } from "lucide-react";`
   - To: `import { Home, Dumbbell, BookOpen, CalendarDays, Apple, BarChart3, Settings, LogOut, Bot } from "lucide-react";`

2. Add calendar item to `navItems` array after `{ href: "/exercises", ... }` (between Exercises and Nutrition):
   ```typescript
   { href: "/calendar", label: "Calendar", icon: CalendarDays },
   ```

**Step 3: Commit**

```bash
git add src/components/layout/bottom-nav.tsx src/components/layout/sidebar-nav.tsx
git commit -m "feat(calendar): add Calendar to bottom nav and sidebar nav"
```

---

### Task 11: Lint and build verification

**Files:** None (verification only)

**Step 1: Run lint**

```bash
npx eslint src/lib/calendar.ts src/components/calendar src/app/\(app\)/calendar
```

Fix any lint errors that come up.

**Step 2: Run SSR build**

```bash
npm run build
```

Expected: Build succeeds with the new `/calendar` and `/calendar/day/[date]` routes visible in the output.

**Step 3: Run Capacitor build**

```bash
npm run build:cap
```

Expected: Build succeeds (no API routes involved in this phase, so no exclusion issues).

**Step 4: Fix any errors and commit**

If there are type errors or lint issues, fix them and commit:

```bash
git add -A
git commit -m "fix(calendar): resolve lint and build errors"
```

---

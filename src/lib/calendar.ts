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
      isCurrentMonth: current.getMonth() === monthStart.getMonth(),
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
  const enrollDow = getDay(enrollDate);
  const week1Start = enrollDow === 1 ? enrollDate : nextMonday(enrollDate);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Project up to 4 weeks past current week, capped at 12
  const projectWeeks = Math.min(
    enrollment.current_week + 4,
    schedule.repeat_from_week !== undefined ? enrollment.current_week + 8 : schedule.weeks.length
  );

  for (let w = 0; w < projectWeeks; w++) {
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
      const dayDate = addDays(weekStart, day.day_of_week - 1);
      const dateStr = format(dayDate, "yyyy-MM-dd");

      const progressKey = `w${w + 1}d${d}`;
      const isCompleted = !!enrollment.progress_log[progressKey];

      let status: "completed" | "upcoming" | "today" = "upcoming";
      if (isCompleted) {
        status = "completed";
      } else if (dateStr === todayStr) {
        status = "today";
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

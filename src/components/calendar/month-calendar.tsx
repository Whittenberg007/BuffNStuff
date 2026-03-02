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

  const monthSessions = Object.values(sessionsByDate).flat();
  const totalSessions = monthSessions.length;
  const totalVolume = monthSessions.reduce((s, sess) => s + sess.totalVolume, 0);
  const trainingDays = Object.keys(sessionsByDate).filter(
    (d) => sessionsByDate[d].length > 0
  ).length;

  return (
    <div>
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

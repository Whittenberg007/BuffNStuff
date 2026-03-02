"use client";

import Link from "next/link";
import { addDays, format } from "date-fns";
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
        const hasScheduled = scheduled !== null && scheduled.status !== "completed";

        return (
          <Link
            key={wd.date}
            href={`/calendar/day?date=${wd.date}`}
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

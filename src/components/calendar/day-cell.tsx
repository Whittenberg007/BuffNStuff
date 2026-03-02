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
      href={`/calendar/day?date=${date}`}
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

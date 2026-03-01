"use client";

import { Check, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProgramEnrollment, ProgramWeek } from "@/types";

interface WeekViewProps {
  enrollment: ProgramEnrollment;
  onDayComplete: () => void;
}

export function WeekView({ enrollment, onDayComplete }: WeekViewProps) {
  const program = enrollment.program;
  if (!program) return null;

  const schedule = program.schedule;
  const weekIndex = enrollment.current_week - 1;

  // Resolve the current week, handling repeat_from_week for programs that cycle
  let currentWeek: ProgramWeek | undefined;
  if (weekIndex < schedule.weeks.length) {
    currentWeek = schedule.weeks[weekIndex];
  } else if (schedule.repeat_from_week !== undefined) {
    const repeatableWeeks = schedule.weeks.slice(schedule.repeat_from_week - 1);
    if (repeatableWeeks.length > 0) {
      const cycleIndex =
        (weekIndex - (schedule.repeat_from_week - 1)) % repeatableWeeks.length;
      currentWeek = repeatableWeeks[cycleIndex];
    }
  }

  if (!currentWeek) return null;

  const progressLog = enrollment.progress_log as Record<string, unknown>;

  function isDayCompleted(weekNumber: number, dayIndex: number): boolean {
    const key = `w${weekNumber}_d${dayIndex}`;
    return !!progressLog[key];
  }

  return (
    <div className="space-y-4">
      {/* Week header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">
          Week {enrollment.current_week}
          {currentWeek.label && (
            <span className="text-muted-foreground font-normal">
              {" "}
              &mdash; {currentWeek.label}
            </span>
          )}
        </h2>
        {currentWeek.is_deload && (
          <Badge
            variant="outline"
            className="border-0 bg-amber-900 text-amber-200 text-[10px]"
          >
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            Deload
          </Badge>
        )}
      </div>

      {/* Day cards */}
      <div className="space-y-3">
        {currentWeek.days.map((day, dayIndex) => {
          const isCurrentDay = dayIndex === enrollment.current_day_index;
          const completed = isDayCompleted(
            currentWeek!.week_number,
            dayIndex
          );

          return (
            <Card
              key={dayIndex}
              className={cn(
                "py-3",
                isCurrentDay && !completed && "border-primary border-2",
                completed && "opacity-70"
              )}
            >
              <CardContent className="px-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{day.label}</span>
                    {completed && (
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-900">
                        <Check className="h-3 w-3 text-emerald-300" />
                      </span>
                    )}
                  </div>
                  {isCurrentDay && !completed && (
                    <Button size="sm" onClick={onDayComplete}>
                      Complete Day
                    </Button>
                  )}
                </div>

                {/* Exercise list */}
                {day.exercises.length > 0 && (
                  <ul className="space-y-1">
                    {day.exercises.map((exercise, exIdx) => (
                      <li
                        key={exIdx}
                        className="text-xs text-muted-foreground flex items-center gap-1.5"
                      >
                        <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                        <span>
                          {exercise.exercise_name}
                          <span className="ml-1 text-zinc-500">
                            {exercise.sets} x {exercise.reps}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

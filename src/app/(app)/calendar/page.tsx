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

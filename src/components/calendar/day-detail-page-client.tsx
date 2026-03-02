"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayDetailCard } from "@/components/calendar/day-detail-card";
import { getSessionsForRange, type CalendarSession } from "@/lib/database/workouts";
import { getActiveEnrollment } from "@/lib/database/programs";
import { projectProgramDays, type ProjectedProgramDay } from "@/lib/calendar";

interface DayDetailClientProps {
  date: string;
}

export function DayDetailClient({ date }: DayDetailClientProps) {
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

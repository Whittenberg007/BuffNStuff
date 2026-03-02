"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TodayWorkout } from "@/components/dashboard/today-workout";
import { WeeklySummary } from "@/components/dashboard/weekly-summary";
import { StreakCounter } from "@/components/dashboard/streak-counter";
import { RecentPRs } from "@/components/dashboard/recent-prs";
import { BadgesDisplay } from "@/components/dashboard/badges-display";
import { InsightCards } from "@/components/ai/insight-card";
import { RotationSuggestions } from "@/components/training/rotation-suggestions";
import { PlateauAlerts } from "@/components/training/plateau-alerts";
import { VolumeLandmarks } from "@/components/training/volume-landmarks";
import { getActiveEnrollment } from "@/lib/database/programs";
import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ProgramEnrollment } from "@/types";

function ActiveProgramCard() {
  const [enrollment, setEnrollment] = useState<ProgramEnrollment | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getActiveEnrollment()
      .then(setEnrollment)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  if (!enrollment) {
    return (
      <Link href="/programs/browse">
        <Card className="border-dashed hover:bg-muted/50 transition-colors">
          <CardContent className="flex items-center gap-3 py-4">
            <BookOpen className="size-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Start a Training Program</p>
              <p className="text-xs text-muted-foreground">
                Science-based programs for strength and hypertrophy
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
    );
  }

  const program = enrollment.program;
  return (
    <Link href="/programs/active">
      <Card className="border-primary/30 hover:bg-muted/50 transition-colors">
        <CardContent className="flex items-center gap-3 py-4">
          <BookOpen className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">{program?.name || "Active Program"}</p>
            <p className="text-xs text-muted-foreground">
              Week {enrollment.current_week} of {program?.duration_weeks || "?"} — Day {enrollment.current_day_index + 1}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{getGreeting()}</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s your training overview.
        </p>
      </div>

      <ActiveProgramCard />

      <InsightCards />

      <TodayWorkout />

      <WeeklySummary />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <StreakCounter />
        <RecentPRs />
      </div>

      <BadgesDisplay />

      <RotationSuggestions />

      <PlateauAlerts />

      <VolumeLandmarks />
    </div>
  );
}

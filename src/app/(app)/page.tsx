"use client";

import { TodayWorkout } from "@/components/dashboard/today-workout";
import { WeeklySummary } from "@/components/dashboard/weekly-summary";
import { StreakCounter } from "@/components/dashboard/streak-counter";
import { RecentPRs } from "@/components/dashboard/recent-prs";
import { BadgesDisplay } from "@/components/dashboard/badges-display";
import { RotationSuggestions } from "@/components/training/rotation-suggestions";
import { PlateauAlerts } from "@/components/training/plateau-alerts";
import { VolumeLandmarks } from "@/components/training/volume-landmarks";

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

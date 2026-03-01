"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Dumbbell, Flame, Trophy, Calendar } from "lucide-react";
import { getFriendLeaderboard } from "@/lib/database/challenges";
import { LeaderboardCard } from "@/components/challenges/leaderboard-card";
import Link from "next/link";
import type { ChallengeParticipant } from "@/types";

type LeaderboardEntry = {
  profile: ChallengeParticipant["profile"];
  score: number;
};

export default function LeaderboardsPage() {
  const [weeklyVolume, setWeeklyVolume] = useState<LeaderboardEntry[]>([]);
  const [currentStreak, setCurrentStreak] = useState<LeaderboardEntry[]>([]);
  const [monthlyPrs, setMonthlyPrs] = useState<LeaderboardEntry[]>([]);
  const [monthlyWorkouts, setMonthlyWorkouts] = useState<LeaderboardEntry[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [vol, streak, prs, workouts] = await Promise.all([
          getFriendLeaderboard("weekly_volume"),
          getFriendLeaderboard("current_streak"),
          getFriendLeaderboard("monthly_prs"),
          getFriendLeaderboard("monthly_workouts"),
        ]);
        setWeeklyVolume(vol);
        setCurrentStreak(streak);
        setMonthlyPrs(prs);
        setMonthlyWorkouts(workouts);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="text-center py-8 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/community">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Leaderboards</h1>
          <p className="text-sm text-muted-foreground">
            See how you stack up against your friends
          </p>
        </div>
      </div>

      {/* Leaderboard grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LeaderboardCard
          title="Weekly Volume King"
          icon={<Dumbbell className="size-4" />}
          entries={weeklyVolume}
          formatScore={(n) => `${n.toLocaleString()} lbs`}
        />
        <LeaderboardCard
          title="Longest Streak"
          icon={<Flame className="size-4" />}
          entries={currentStreak}
          formatScore={(n) => `${n} days`}
        />
        <LeaderboardCard
          title="Monthly PR Count"
          icon={<Trophy className="size-4" />}
          entries={monthlyPrs}
          formatScore={(n) => `${n} PRs`}
        />
        <LeaderboardCard
          title="Monthly Workouts"
          icon={<Calendar className="size-4" />}
          entries={monthlyWorkouts}
          formatScore={(n) => `${n} workouts`}
        />
      </div>
    </div>
  );
}

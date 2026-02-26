"use client";

import { useEffect, useState } from "react";
import { Flame, Snowflake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentStreak } from "@/lib/database/stats";

function getStreakMessage(streak: number): string {
  if (streak === 0) return "Start a streak today!";
  if (streak === 1) return "Great start -- keep it going!";
  if (streak < 4) return "Building momentum!";
  if (streak < 7) return "You are on fire!";
  if (streak < 14) return "Unstoppable!";
  if (streak < 30) return "Beast mode activated!";
  return "Legendary consistency!";
}

export function StreakCounter() {
  const [streak, setStreak] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const s = await getCurrentStreak();
        setStreak(s);
      } catch {
        setStreak(0);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <Card className="py-4">
        <CardContent className="px-4">
          <div className="h-12 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const currentStreak = streak ?? 0;

  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
            {currentStreak > 0 ? (
              <Flame className="size-6 text-orange-500" />
            ) : (
              <Snowflake className="size-6 text-blue-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {currentStreak}
              </span>
              <span className="text-sm text-muted-foreground">day streak</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {getStreakMessage(currentStreak)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  LayoutTemplate,
  Loader2,
  Plus,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { startWorkoutSession, getRecentSessions, getSessionSets } from "@/lib/database/workouts";
import { TemplatePicker } from "@/components/workout/template-picker";
import { SessionCard } from "@/components/workout/session-card";
import type { WorkoutSession } from "@/types";

interface SessionWithStats extends WorkoutSession {
  totalSets: number;
  totalVolume: number;
}

export default function WorkoutPage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionWithStats[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Load recent sessions
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sessions = await getRecentSessions(5);

        // Only show completed sessions
        const completed = sessions.filter((s) => s.ended_at !== null);

        // Get stats for each session
        const withStats: SessionWithStats[] = await Promise.all(
          completed.map(async (session) => {
            try {
              const sets = await getSessionSets(session.id);
              const totalSets = sets.length;
              const totalVolume = sets.reduce(
                (sum, s) => sum + s.weight * s.reps,
                0
              );
              return { ...session, totalSets, totalVolume };
            } catch {
              return { ...session, totalSets: 0, totalVolume: 0 };
            }
          })
        );

        if (!cancelled) setRecentSessions(withStats);
      } catch {
        // Silently fail, user just won't see history
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleEmptyWorkout = useCallback(async () => {
    setIsStarting(true);
    try {
      const session = await startWorkoutSession();
      router.push(`/workout/active?sessionId=${session.id}`);
    } catch (err) {
      console.error("Failed to start workout:", err);
      toast.error("Failed to start workout");
      setIsStarting(false);
    }
  }, [router]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Workout</h1>
        <p className="mt-1 text-muted-foreground">
          Start a workout or review recent sessions.
        </p>
      </div>

      {/* Start Workout section */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Start Workout
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Empty Workout */}
          <Button
            variant="outline"
            className="h-20 flex-col gap-1.5 text-base"
            onClick={handleEmptyWorkout}
            disabled={isStarting}
          >
            {isStarting ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Plus className="size-6" />
            )}
            <span className="font-semibold">
              {isStarting ? "Starting..." : "Empty Workout"}
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Start from scratch
            </span>
          </Button>

          {/* From Template */}
          <Button
            variant="outline"
            className="h-20 flex-col gap-1.5 text-base"
            onClick={() => setShowTemplates((prev) => !prev)}
          >
            <LayoutTemplate className="size-6" />
            <span className="font-semibold">From Template</span>
            <span className="text-xs text-muted-foreground font-normal">
              Use a saved workout
            </span>
          </Button>
        </div>

        {/* Template picker */}
        {showTemplates && (
          <div className="mt-4">
            <TemplatePicker />
          </div>
        )}
      </section>

      <Separator />

      {/* Recent Workouts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Recent Workouts
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <a href="/workout/templates">
              <Settings className="size-4" /> Manage Templates
            </a>
          </Button>
        </div>

        {loadingSessions ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Dumbbell className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No workouts yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Start your first workout above!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                totalSets={session.totalSets}
                totalVolume={session.totalVolume}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

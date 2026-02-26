"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ActiveWorkout } from "@/components/workout/active-workout";
import { createClient } from "@/lib/supabase/client";
import { getExerciseById } from "@/lib/database/exercises";
import type { Exercise, WorkoutSession } from "@/types";

function ActiveWorkoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const exerciseIdsParam = searchParams.get("exerciseIds");

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/workout");
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (fetchError || !data) {
          if (!cancelled) {
            setError("Session not found");
            setTimeout(() => router.replace("/workout"), 2000);
          }
          return;
        }

        if (!cancelled) {
          setSession(data as WorkoutSession);
        }

        // Load exercises from query param if provided (from template)
        if (exerciseIdsParam) {
          const ids = exerciseIdsParam.split(",").filter(Boolean);
          const loaded: Exercise[] = [];
          for (const id of ids) {
            const ex = await getExerciseById(id);
            if (ex && !cancelled) loaded.push(ex);
          }
          if (!cancelled) setExercises(loaded);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load session");
          setTimeout(() => router.replace("/workout"), 2000);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId, exerciseIdsParam, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-destructive">
          {error || "Session not found"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Redirecting to workout page...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <ActiveWorkout
        session={session}
        initialExercises={exercises}
      />
    </div>
  );
}

export default function ActiveWorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ActiveWorkoutPageContent />
    </Suspense>
  );
}

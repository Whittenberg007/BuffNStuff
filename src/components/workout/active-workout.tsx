"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Dumbbell,
  Flame,
  Loader2,
  Plus,
  Square,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  endWorkoutSession,
  getSessionSets,
  getLastSessionForExercise,
} from "@/lib/database/workouts";
import { ExerciseSetCard } from "./exercise-set-card";
import { ExercisePickerDialog } from "./exercise-picker-dialog";
import { RestTimer } from "./rest-timer";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ActiveWorkoutProps {
  session: WorkoutSession;
  initialSets?: WorkoutSet[];
  initialExercises?: Exercise[];
}

export function ActiveWorkout({
  session,
  initialSets = [],
  initialExercises = [],
}: ActiveWorkoutProps) {
  const router = useRouter();

  // State
  const [sets, setSets] = useState<WorkoutSet[]>(initialSets);
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(
    initialExercises[0]?.id || null
  );
  const [lastSessionCache, setLastSessionCache] = useState<
    Record<string, WorkoutSet[]>
  >({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restTimerTrigger, setRestTimerTrigger] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [loading, setLoading] = useState(true);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing session sets on mount
  useEffect(() => {
    let cancelled = false;

    if (initialSets.length > 0) {
      setLoading(false);
      return;
    }

    getSessionSets(session.id)
      .then((data) => {
        if (cancelled) return;
        setSets(data);

        // Extract unique exercises from sets
        const exerciseMap = new Map<string, Exercise>();
        for (const s of data) {
          if (s.exercise) {
            exerciseMap.set(s.exercise.id, s.exercise);
          }
        }
        if (exerciseMap.size > 0 && initialExercises.length === 0) {
          const exArr = Array.from(exerciseMap.values());
          setExercises(exArr);
          if (!activeExerciseId) setActiveExerciseId(exArr[0].id);
        }
      })
      .catch(() => {
        // No sets yet, that's fine
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Fetch last session data for exercises
  useEffect(() => {
    for (const exercise of exercises) {
      if (lastSessionCache[exercise.id]) continue;

      getLastSessionForExercise(exercise.id)
        .then((data) => {
          setLastSessionCache((prev) => ({ ...prev, [exercise.id]: data }));
        })
        .catch(() => {
          setLastSessionCache((prev) => ({ ...prev, [exercise.id]: [] }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  // Elapsed timer
  useEffect(() => {
    const startTime = new Date(session.started_at).getTime();

    const tick = () => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    };

    tick();
    elapsedRef.current = setInterval(tick, 1000);

    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [session.started_at]);

  // Group sets by exercise
  const setsByExercise = exercises.reduce<Record<string, WorkoutSet[]>>(
    (acc, ex) => {
      acc[ex.id] = sets.filter((s) => s.exercise_id === ex.id);
      return acc;
    },
    {}
  );

  // Stats
  const totalSets = sets.length;
  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const uniqueExercises = exercises.length;

  const handleAddExercise = useCallback(
    (exercise: Exercise) => {
      if (!exercises.find((e) => e.id === exercise.id)) {
        setExercises((prev) => [...prev, exercise]);
      }
      setActiveExerciseId(exercise.id);
    },
    [exercises]
  );

  const handleSetLogged = useCallback(
    (newSet: WorkoutSet) => {
      setSets((prev) => [...prev, newSet]);
      toast.success("Set logged", {
        description: `${newSet.weight} lbs x ${newSet.reps} reps`,
        duration: 2000,
      });
    },
    []
  );

  const handleSetDeleted = useCallback((setId: string) => {
    setSets((prev) => prev.filter((s) => s.id !== setId));
    toast("Set deleted", { duration: 1500 });
  }, []);

  const handleRestTimerTrigger = useCallback(() => {
    setRestTimerTrigger((prev) => prev + 1);
  }, []);

  const handleFinishWorkout = useCallback(async () => {
    setIsFinishing(true);
    try {
      await endWorkoutSession(session.id);
      toast.success("Workout complete!", {
        description: `${totalSets} sets, ${totalVolume.toLocaleString()} lbs total volume`,
      });
      router.push("/workout");
    } catch (err) {
      console.error("Failed to end session:", err);
      toast.error("Failed to end workout");
    } finally {
      setIsFinishing(false);
      setShowFinishDialog(false);
    }
  }, [session.id, totalSets, totalVolume, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative pb-32">
      {/* Header: Timer + Stats */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b pb-3 mb-4 -mx-4 px-4 pt-4 md:-mx-8 md:px-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-lg font-mono font-bold tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {session.split_type && (
              <Badge variant="secondary" className="text-xs">
                {session.split_type.replace("_", " ").toUpperCase()}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Dumbbell className="size-3" />
            {uniqueExercises} exercise{uniqueExercises !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3" />
            {totalSets} set{totalSets !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="size-3" />
            {totalVolume.toLocaleString()} lbs
          </span>
        </div>
      </div>

      {/* Exercise cards */}
      {exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dumbbell className="size-10 text-muted-foreground/50 mb-3" />
          <p className="text-lg font-medium text-muted-foreground">
            No exercises yet
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add an exercise to start logging sets.
          </p>
          <Button onClick={() => setShowExercisePicker(true)}>
            <Plus className="size-4" /> Add Exercise
          </Button>
        </div>
      ) : (
        <ScrollArea className="h-auto">
          <div className="space-y-4">
            {exercises.map((exercise) => (
              <ExerciseSetCard
                key={exercise.id}
                exercise={exercise}
                sets={setsByExercise[exercise.id] || []}
                lastSessionSets={lastSessionCache[exercise.id] || []}
                sessionId={session.id}
                isActive={activeExerciseId === exercise.id}
                onActivate={() => setActiveExerciseId(exercise.id)}
                onSetLogged={handleSetLogged}
                onSetDeleted={handleSetDeleted}
                onRestTimerTrigger={handleRestTimerTrigger}
              />
            ))}

            <Separator className="my-4" />

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowExercisePicker(true)}
            >
              <Plus className="size-4" /> Add Exercise
            </Button>
          </div>
        </ScrollArea>
      )}

      {/* Finish Workout button */}
      <div className="fixed bottom-20 left-4 right-4 z-30 md:bottom-6 md:left-auto md:right-auto md:w-full md:max-w-2xl md:mx-auto md:px-8">
        <Button
          variant="destructive"
          className={cn("w-full h-12 text-base font-semibold shadow-lg")}
          onClick={() => setShowFinishDialog(true)}
        >
          <Square className="size-4" /> Finish Workout
        </Button>
      </div>

      {/* Rest Timer */}
      <RestTimer trigger={restTimerTrigger} />

      {/* Exercise Picker */}
      <ExercisePickerDialog
        open={showExercisePicker}
        onOpenChange={setShowExercisePicker}
        onSelect={handleAddExercise}
        existingExerciseIds={exercises.map((e) => e.id)}
      />

      {/* Finish Confirmation Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish Workout?</DialogTitle>
            <DialogDescription>
              Are you sure you want to finish this workout? This had{" "}
              <strong>{totalSets} set{totalSets !== 1 ? "s" : ""}</strong> across{" "}
              <strong>
                {uniqueExercises} exercise{uniqueExercises !== 1 ? "s" : ""}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 text-sm">
            <span>
              Duration: <strong>{formatElapsed(elapsedSeconds)}</strong>
            </span>
            <span>
              Total Volume:{" "}
              <strong>{totalVolume.toLocaleString()} lbs</strong>
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFinishDialog(false)}
            >
              Keep Going
            </Button>
            <Button
              variant="destructive"
              onClick={handleFinishWorkout}
              disabled={isFinishing}
            >
              {isFinishing ? "Finishing..." : "Finish Workout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

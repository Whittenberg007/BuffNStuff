"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logSet } from "@/lib/database/workouts";
import { getLastSessionForExercise } from "@/lib/database/workouts";
import type { Exercise, WorkoutSet, SetType } from "@/types";
import { hapticNotification } from "@/lib/capacitor/haptics";

const SET_TYPES: { value: SetType; label: string }[] = [
  { value: "working", label: "Working" },
  { value: "warmup", label: "Warmup" },
  { value: "dropset", label: "Drop Set" },
  { value: "failure", label: "Failure" },
];

interface SetLoggerProps {
  exercise: Exercise;
  sessionId: string;
  currentSetNumber: number;
  onSetLogged: (set: WorkoutSet) => void;
}

export function SetLogger({
  exercise,
  sessionId,
  currentSetNumber,
  onSetLogged,
}: SetLoggerProps) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [setType, setSetType] = useState<SetType>("working");
  const [rpeRir, setRpeRir] = useState<string>("");
  const [showRpe, setShowRpe] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSession, setLastSession] = useState<WorkoutSet[]>([]);
  const [loadingLast, setLoadingLast] = useState(true);

  const weightInputRef = useRef<HTMLInputElement>(null);

  // Fetch last session data
  useEffect(() => {
    let cancelled = false;
    setLoadingLast(true);

    getLastSessionForExercise(exercise.id)
      .then((data) => {
        if (!cancelled) {
          setLastSession(data);
          // Default weight to the last session's first set weight
          if (data.length > 0 && !weight) {
            setWeight(String(data[0].weight));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLastSession([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLast(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Auto-focus weight input
  useEffect(() => {
    const timer = setTimeout(() => {
      weightInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [exercise.id]);

  const handleLogSet = useCallback(async () => {
    const weightNum = parseFloat(weight) || 0;
    const repsNum = parseInt(reps) || 0;

    if (repsNum <= 0) return;

    setIsLogging(true);
    try {
      const newSet = await logSet({
        sessionId,
        exerciseId: exercise.id,
        setNumber: currentSetNumber,
        weight: weightNum,
        reps: repsNum,
        setType,
        rpeRir: rpeRir ? parseInt(rpeRir) : undefined,
      });

      onSetLogged(newSet);
      hapticNotification("success");

      // Brief success feedback
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 800);

      // Reset reps for next set; keep weight
      setReps("");
      setRpeRir("");
      weightInputRef.current?.focus();
    } catch (err) {
      console.error("Failed to log set:", err);
    } finally {
      setIsLogging(false);
    }
  }, [weight, reps, setType, rpeRir, sessionId, exercise.id, currentSetNumber, onSetLogged]);

  // Determine last session best for this set number
  const lastSetData = lastSession[currentSetNumber - 1] || lastSession[0];

  return (
    <div className="space-y-3">
      {/* Exercise name */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{exercise.name}</h3>
        <Badge variant="secondary" className="text-xs">
          Set {currentSetNumber}
        </Badge>
      </div>

      {/* Previous session reference */}
      <div className="text-sm text-muted-foreground">
        {loadingLast ? (
          <span className="animate-pulse">Loading previous data...</span>
        ) : lastSetData ? (
          <span>
            Last: {lastSetData.weight} lbs x {lastSetData.reps} reps
          </span>
        ) : (
          <span>No previous data</span>
        )}
      </div>

      {/* Weight + Reps inputs side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`weight-${exercise.id}`} className="text-xs mb-1 block text-muted-foreground">
            Weight (lbs)
          </Label>
          <Input
            ref={weightInputRef}
            id={`weight-${exercise.id}`}
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-14 text-2xl font-bold text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            step={2.5}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const repsInput = document.getElementById(`reps-${exercise.id}`);
                repsInput?.focus();
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor={`reps-${exercise.id}`} className="text-xs mb-1 block text-muted-foreground">
            Reps
          </Label>
          <Input
            id={`reps-${exercise.id}`}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-14 text-2xl font-bold text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleLogSet();
              }
            }}
          />
        </div>
      </div>

      {/* Set type pills */}
      <div className="flex flex-wrap gap-1.5">
        {SET_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => setSetType(type.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              setType === type.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* RPE/RIR collapsible */}
      <button
        type="button"
        onClick={() => setShowRpe((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showRpe ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        RPE / RIR (optional)
      </button>
      {showRpe && (
        <div className="flex items-center gap-3">
          <Label htmlFor={`rpe-${exercise.id}`} className="text-xs text-muted-foreground shrink-0">
            RPE (1-10)
          </Label>
          <Input
            id={`rpe-${exercise.id}`}
            type="number"
            inputMode="numeric"
            placeholder="8"
            value={rpeRir}
            onChange={(e) => setRpeRir(e.target.value)}
            className="h-10 w-20 text-center"
            min={1}
            max={10}
          />
        </div>
      )}

      {/* Log Set button */}
      <Button
        onClick={handleLogSet}
        disabled={isLogging || (!reps && !weight)}
        className={cn(
          "w-full h-12 text-base font-semibold transition-all",
          showSuccess && "bg-green-600 hover:bg-green-600"
        )}
      >
        {showSuccess ? (
          <>
            <Check className="size-5" /> Logged!
          </>
        ) : isLogging ? (
          "Logging..."
        ) : (
          `Log Set ${currentSetNumber}`
        )}
      </Button>
    </div>
  );
}

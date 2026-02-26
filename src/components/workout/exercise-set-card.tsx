"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { deleteSet } from "@/lib/database/workouts";
import { SetLogger } from "./set-logger";
import type { Exercise, WorkoutSet } from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

/** Compare a set to last session data and return color class */
function getComparisonColor(
  set: WorkoutSet,
  lastSessionSets: WorkoutSet[]
): string {
  if (lastSessionSets.length === 0) return "";
  const lastSet = lastSessionSets[set.set_number - 1] || lastSessionSets[0];
  if (!lastSet) return "";

  const currentVolume = set.weight * set.reps;
  const lastVolume = lastSet.weight * lastSet.reps;

  if (currentVolume > lastVolume) return "text-green-600 dark:text-green-400";
  if (currentVolume === lastVolume) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

interface ExerciseSetCardProps {
  exercise: Exercise;
  sets: WorkoutSet[];
  lastSessionSets: WorkoutSet[];
  sessionId: string;
  isActive: boolean;
  onActivate: () => void;
  onSetLogged: (set: WorkoutSet) => void;
  onSetDeleted: (setId: string) => void;
  onRestTimerTrigger: () => void;
}

export function ExerciseSetCard({
  exercise,
  sets,
  lastSessionSets,
  sessionId,
  isActive,
  onActivate,
  onSetLogged,
  onSetDeleted,
  onRestTimerTrigger,
}: ExerciseSetCardProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (setId: string) => {
    setDeletingId(setId);
    try {
      await deleteSet(setId);
      onSetDeleted(setId);
    } catch (err) {
      console.error("Failed to delete set:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetLogged = (set: WorkoutSet) => {
    onSetLogged(set);
    onRestTimerTrigger();
  };

  const nextSetNumber = sets.length + 1;

  return (
    <Card
      className={cn(
        "transition-all",
        isActive && "ring-2 ring-primary/50 border-primary/30"
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{exercise.name}</CardTitle>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {capitalize(exercise.primary_muscle_group)}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setIsExpanded((prev) => !prev);
              if (!isActive) onActivate();
            }}
          >
            {isExpanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </div>
        {sets.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {sets.length} set{sets.length !== 1 ? "s" : ""} logged
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Set table */}
        {sets.length > 0 && (
          <div className="mt-3">
            <div className="grid grid-cols-[2rem_1fr_1fr_auto_2rem] gap-1 text-xs font-medium text-muted-foreground mb-1 px-1">
              <span>#</span>
              <span>Weight</span>
              <span>Reps</span>
              <span>Type</span>
              <span />
            </div>
            <div className="space-y-0.5">
              {sets.map((set) => (
                <div
                  key={set.id}
                  className={cn(
                    "grid grid-cols-[2rem_1fr_1fr_auto_2rem] gap-1 items-center text-sm rounded-md px-1 py-1 hover:bg-muted/50 transition-colors",
                    getComparisonColor(set, lastSessionSets)
                  )}
                >
                  <span className="text-muted-foreground text-xs">
                    {set.set_number}
                  </span>
                  <span className="font-medium">{set.weight} lbs</span>
                  <span className="font-medium">{set.reps}</span>
                  <span className="text-xs text-muted-foreground">
                    {set.set_type === "working" ? "" : capitalize(set.set_type)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(set.id)}
                    disabled={deletingId === set.id}
                    className="opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expanded: set logger */}
        {isExpanded && isActive && (
          <div className="mt-4 pt-4 border-t">
            <SetLogger
              exercise={exercise}
              sessionId={sessionId}
              currentSetNumber={nextSetNumber}
              onSetLogged={handleSetLogged}
            />
          </div>
        )}

        {/* Add Set button when collapsed or not active */}
        {(!isExpanded || !isActive) && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => {
              setIsExpanded(true);
              onActivate();
            }}
          >
            <Plus className="size-4" /> Add Set
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

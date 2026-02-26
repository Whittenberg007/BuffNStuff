"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getExerciseVariations } from "@/lib/database/exercises";
import type { Exercise, EquipmentType } from "@/types";

const equipmentColorMap: Record<EquipmentType, string> = {
  barbell: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  dumbbell: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cable: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  machine: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  bodyweight: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  band: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const difficultyColorMap: Record<string, string> = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ExerciseDetailProps {
  exercise: Exercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciseDetail({
  exercise,
  open,
  onOpenChange,
}: ExerciseDetailProps) {
  const [variations, setVariations] = useState<Record<string, Exercise[]>>({});
  const [loadingVariations, setLoadingVariations] = useState(false);

  useEffect(() => {
    if (!exercise || !open) {
      setVariations({});
      return;
    }

    let cancelled = false;
    setLoadingVariations(true);

    getExerciseVariations(exercise.primary_muscle_group, exercise.id)
      .then((data) => {
        if (!cancelled) setVariations(data);
      })
      .catch(() => {
        if (!cancelled) setVariations({});
      })
      .finally(() => {
        if (!cancelled) setLoadingVariations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exercise, open]);

  if (!exercise) return null;

  const variationEntries = Object.entries(variations).filter(
    ([, exercises]) => exercises.length > 0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="text-xl">{exercise.name}</SheetTitle>
          <SheetDescription className="sr-only">
            Details for {exercise.name}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="space-y-5 px-6 pb-8">
            {/* Muscle groups */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Muscles
              </h4>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">
                  {capitalize(exercise.primary_muscle_group)}
                </Badge>
                {exercise.secondary_muscles.map((muscle) => (
                  <Badge key={muscle} variant="outline">
                    {capitalize(muscle)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "border-0",
                  equipmentColorMap[exercise.equipment_type]
                )}
              >
                {capitalize(exercise.equipment_type)}
              </Badge>
              <Badge variant="outline">
                {capitalize(exercise.movement_pattern)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "border-0",
                  difficultyColorMap[exercise.difficulty]
                )}
              >
                {capitalize(exercise.difficulty)}
              </Badge>
            </div>

            {/* Instructions */}
            {exercise.instructions && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Instructions
                </h4>
                <p className="text-sm leading-relaxed">
                  {exercise.instructions}
                </p>
              </div>
            )}

            {/* Tags */}
            {exercise.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {exercise.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5"
                    >
                      {tag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source credit */}
            {exercise.source_credit && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Source
                </h4>
                <p className="text-sm italic">{exercise.source_credit}</p>
              </div>
            )}

            <Separator />

            {/* Equipment Variations */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                Equipment Variations
              </h4>
              {loadingVariations ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-8 animate-pulse rounded-md bg-muted"
                    />
                  ))}
                </div>
              ) : variationEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other variations found.
                </p>
              ) : (
                <div className="space-y-4">
                  {variationEntries.map(([equipmentType, exercises]) => (
                    <div key={equipmentType}>
                      <h5 className="mb-1.5 text-sm font-medium">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-0",
                            equipmentColorMap[
                              equipmentType as EquipmentType
                            ]
                          )}
                        >
                          {capitalize(equipmentType)}
                        </Badge>
                      </h5>
                      <ul className="space-y-1 pl-1">
                        {exercises.map((ex) => (
                          <li
                            key={ex.id}
                            className="text-sm text-muted-foreground"
                          >
                            {ex.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

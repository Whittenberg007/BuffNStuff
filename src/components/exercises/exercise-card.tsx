"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

interface ExerciseCardProps {
  exercise: Exercise;
  onClick: (exercise: Exercise) => void;
}

export function ExerciseCard({ exercise, onClick }: ExerciseCardProps) {
  return (
    <button
      onClick={() => onClick(exercise)}
      className={cn(
        "w-full text-left rounded-xl border bg-card p-4 shadow-sm transition-all",
        "hover:shadow-md hover:border-primary/30 hover:bg-accent/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="mb-2">
        <h3 className="font-semibold text-sm leading-tight">{exercise.name}</h3>
        {exercise.source_credit && (
          <p className="mt-0.5 text-xs italic text-muted-foreground">
            {exercise.source_credit}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {capitalize(exercise.primary_muscle_group)}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 border-0",
            equipmentColorMap[exercise.equipment_type]
          )}
        >
          {capitalize(exercise.equipment_type)}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 border-0",
            difficultyColorMap[exercise.difficulty]
          )}
        >
          {capitalize(exercise.difficulty)}
        </Badge>
      </div>
      {exercise.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {exercise.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0"
            >
              {tag.replace(/_/g, " ")}
            </span>
          ))}
          {exercise.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{exercise.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

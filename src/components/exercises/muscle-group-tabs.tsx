"use client";

import { cn } from "@/lib/utils";
import type { MuscleGroup } from "@/types";

const muscleGroups: { value: MuscleGroup | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "glutes", label: "Glutes" },
  { value: "calves", label: "Calves" },
  { value: "core", label: "Core" },
  { value: "forearms", label: "Forearms" },
];

interface MuscleGroupTabsProps {
  selected: MuscleGroup | "all";
  onSelect: (value: MuscleGroup | "all") => void;
}

export function MuscleGroupTabs({ selected, onSelect }: MuscleGroupTabsProps) {
  return (
    <div className="sticky top-0 z-10 bg-background pb-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 md:flex-wrap">
        {muscleGroups.map((group) => (
          <button
            key={group.value}
            onClick={() => onSelect(group.value)}
            className={cn(
              "shrink-0 snap-start rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              selected === group.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {group.label}
          </button>
        ))}
      </div>
    </div>
  );
}

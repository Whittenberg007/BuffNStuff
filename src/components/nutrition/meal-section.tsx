"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NutritionEntry } from "@/types";

interface MealSectionProps {
  mealName: string;
  entries: NutritionEntry[];
  onEdit: (entry: NutritionEntry) => void;
  onDelete: (id: string) => void;
}

export function MealSection({
  mealName,
  entries,
  onEdit,
  onDelete,
}: MealSectionProps) {
  const mealCalories = entries.reduce((sum, e) => sum + e.calories, 0);

  return (
    <div className="space-y-1">
      {/* Meal header */}
      <div className="flex items-center justify-between py-2">
        <h3 className="text-sm font-semibold text-foreground">{mealName}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.round(mealCalories)} kcal
        </span>
      </div>

      {/* Entries */}
      <div className="space-y-0.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{entry.food_item}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {entry.calories} cal &middot; {entry.protein_g}p &middot;{" "}
                {entry.carbs_g}c &middot; {entry.fats_g}f
              </p>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onEdit(entry)}
                aria-label={`Edit ${entry.food_item}`}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDelete(entry.id)}
                aria-label={`Delete ${entry.food_item}`}
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

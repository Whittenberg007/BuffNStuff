"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { updateSettings } from "@/lib/database/settings";
import { toast } from "sonner";
import type { UserSettings } from "@/types";

interface NutritionSettingsProps {
  settings: UserSettings;
  onSettingsUpdated: (settings: UserSettings) => void;
}

export function NutritionSettings({
  settings,
  onSettingsUpdated,
}: NutritionSettingsProps) {
  const [calorieTarget, setCalorieTarget] = useState(
    settings.daily_calorie_target
  );
  const [proteinTarget, setProteinTarget] = useState(
    settings.protein_target_g
  );
  const [carbsTarget, setCarbsTarget] = useState(settings.carbs_target_g);
  const [fatsTarget, setFatsTarget] = useState(settings.fats_target_g);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate total calories from macros
  const macroCalories = useMemo(() => {
    return proteinTarget * 4 + carbsTarget * 4 + fatsTarget * 9;
  }, [proteinTarget, carbsTarget, fatsTarget]);

  const calorieDiff = macroCalories - calorieTarget;

  async function handleSave() {
    setIsSaving(true);
    try {
      const updated = await updateSettings({
        daily_calorie_target: calorieTarget,
        protein_target_g: proteinTarget,
        carbs_target_g: carbsTarget,
        fats_target_g: fatsTarget,
      });
      onSettingsUpdated(updated);
      toast.success("Nutrition settings saved");
    } catch (err) {
      console.error("Failed to save nutrition settings:", err);
      toast.error("Failed to save nutrition settings");
    } finally {
      setIsSaving(false);
    }
  }

  function handleNumberChange(
    setter: (val: number) => void,
    value: string,
    min: number = 0
  ) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= min) {
      setter(num);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrition Targets</CardTitle>
        <CardDescription>
          Set your daily calorie and macro goals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="calorie-target">Daily Calorie Target</Label>
          <Input
            id="calorie-target"
            type="number"
            min={0}
            value={calorieTarget}
            onChange={(e) =>
              handleNumberChange(setCalorieTarget, e.target.value)
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="protein-target">Protein (g)</Label>
            <Input
              id="protein-target"
              type="number"
              min={0}
              value={proteinTarget}
              onChange={(e) =>
                handleNumberChange(setProteinTarget, e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carbs-target">Carbs (g)</Label>
            <Input
              id="carbs-target"
              type="number"
              min={0}
              value={carbsTarget}
              onChange={(e) =>
                handleNumberChange(setCarbsTarget, e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fats-target">Fats (g)</Label>
            <Input
              id="fats-target"
              type="number"
              min={0}
              value={fatsTarget}
              onChange={(e) =>
                handleNumberChange(setFatsTarget, e.target.value)
              }
            />
          </div>
        </div>

        {/* Macro calorie breakdown */}
        <div className="rounded-lg border p-3 space-y-1">
          <div className="text-sm font-medium">Macro Calorie Breakdown</div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>Protein: {proteinTarget * 4} cal</div>
            <div>Carbs: {carbsTarget * 4} cal</div>
            <div>Fats: {fatsTarget * 9} cal</div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t text-sm">
            <span className="font-medium">
              Total from macros: {macroCalories} cal
            </span>
            {calorieDiff !== 0 && (
              <span
                className={
                  Math.abs(calorieDiff) > 100
                    ? "text-destructive text-xs"
                    : "text-muted-foreground text-xs"
                }
              >
                {calorieDiff > 0 ? "+" : ""}
                {calorieDiff} vs target
              </span>
            )}
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Nutrition Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

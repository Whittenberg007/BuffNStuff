"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createGoal } from "@/lib/database/goals";
import type { GoalType, MuscleGroup } from "@/types";

const GOAL_TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "body_comp", label: "Body Comp" },
  { value: "consistency", label: "Consistency" },
  { value: "volume", label: "Volume" },
  { value: "nutrition", label: "Nutrition" },
  { value: "custom", label: "Custom" },
];

const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "forearms",
];

interface GoalFormProps {
  onGoalCreated: () => void;
  onCancel?: () => void;
}

export function GoalForm({ onGoalCreated, onCancel }: GoalFormProps) {
  const [goalType, setGoalType] = useState<GoalType | "">("");
  const [isSaving, setIsSaving] = useState(false);

  // Strength fields
  const [exerciseName, setExerciseName] = useState("");
  const [targetWeight, setTargetWeight] = useState("");

  // Body comp fields
  const [bodyWeight, setBodyWeight] = useState("");

  // Consistency fields
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState("");

  // Volume fields
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | "">("");
  const [percentageIncrease, setPercentageIncrease] = useState("");

  // Nutrition fields
  const [macroTarget, setMacroTarget] = useState("");
  const [nutritionDaysPerWeek, setNutritionDaysPerWeek] = useState("");

  // Custom fields
  const [customTitle, setCustomTitle] = useState("");
  const [customTargetValue, setCustomTargetValue] = useState("");

  // Shared fields
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  function generateTitle(): string {
    switch (goalType) {
      case "strength":
        return `${exerciseName || "Exercise"} ${targetWeight || "?"} lbs`;
      case "body_comp":
        return `Reach ${bodyWeight || "?"} lbs body weight`;
      case "consistency":
        return `${workoutsPerWeek || "?"} workouts per week`;
      case "volume":
        return `Increase ${muscleGroup || "muscle group"} volume by ${percentageIncrease || "?"}%`;
      case "nutrition":
        return `Hit ${macroTarget || "macro"} target ${nutritionDaysPerWeek || "?"} days/week`;
      case "custom":
        return customTitle || "Custom Goal";
      default:
        return "New Goal";
    }
  }

  function getTargetValue(): number | null {
    switch (goalType) {
      case "strength":
        return targetWeight ? parseFloat(targetWeight) : null;
      case "body_comp":
        return bodyWeight ? parseFloat(bodyWeight) : null;
      case "consistency":
        return workoutsPerWeek ? parseInt(workoutsPerWeek, 10) : null;
      case "volume":
        return percentageIncrease ? parseFloat(percentageIncrease) : null;
      case "nutrition":
        return nutritionDaysPerWeek ? parseInt(nutritionDaysPerWeek, 10) : null;
      case "custom":
        return customTargetValue ? parseFloat(customTargetValue) : null;
      default:
        return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goalType) return;

    setIsSaving(true);
    try {
      await createGoal({
        type: goalType,
        title: generateTitle(),
        description: description || null,
        target_value: getTargetValue(),
        target_date: targetDate || null,
      });
      onGoalCreated();
    } catch (err) {
      console.error("Failed to create goal:", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Goal Type</Label>
        <Select
          value={goalType}
          onValueChange={(val) => setGoalType(val as GoalType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select goal type" />
          </SelectTrigger>
          <SelectContent>
            {GOAL_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dynamic fields based on goal type */}
      {goalType === "strength" && (
        <>
          <div className="space-y-2">
            <Label>Exercise Name</Label>
            <Input
              placeholder="e.g., Bench Press"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Target Weight (lbs)</Label>
            <Input
              type="number"
              placeholder="225"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              min="0"
              step="any"
              required
            />
          </div>
        </>
      )}

      {goalType === "body_comp" && (
        <div className="space-y-2">
          <Label>Target Body Weight (lbs)</Label>
          <Input
            type="number"
            placeholder="180"
            value={bodyWeight}
            onChange={(e) => setBodyWeight(e.target.value)}
            min="0"
            step="any"
            required
          />
        </div>
      )}

      {goalType === "consistency" && (
        <div className="space-y-2">
          <Label>Workouts Per Week</Label>
          <Input
            type="number"
            placeholder="4"
            value={workoutsPerWeek}
            onChange={(e) => setWorkoutsPerWeek(e.target.value)}
            min="1"
            max="7"
            required
          />
        </div>
      )}

      {goalType === "volume" && (
        <>
          <div className="space-y-2">
            <Label>Muscle Group</Label>
            <Select
              value={muscleGroup}
              onValueChange={(val) => setMuscleGroup(val as MuscleGroup)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select muscle group" />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map((mg) => (
                  <SelectItem key={mg} value={mg}>
                    {mg.charAt(0).toUpperCase() + mg.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target % Increase</Label>
            <Input
              type="number"
              placeholder="10"
              value={percentageIncrease}
              onChange={(e) => setPercentageIncrease(e.target.value)}
              min="1"
              required
            />
          </div>
        </>
      )}

      {goalType === "nutrition" && (
        <>
          <div className="space-y-2">
            <Label>Macro Target</Label>
            <Input
              placeholder="e.g., 150g protein"
              value={macroTarget}
              onChange={(e) => setMacroTarget(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Days Per Week</Label>
            <Input
              type="number"
              placeholder="5"
              value={nutritionDaysPerWeek}
              onChange={(e) => setNutritionDaysPerWeek(e.target.value)}
              min="1"
              max="7"
              required
            />
          </div>
        </>
      )}

      {goalType === "custom" && (
        <>
          <div className="space-y-2">
            <Label>Goal Title</Label>
            <Input
              placeholder="What do you want to achieve?"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Target Value (optional)</Label>
            <Input
              type="number"
              placeholder="e.g., 100"
              value={customTargetValue}
              onChange={(e) => setCustomTargetValue(e.target.value)}
              min="0"
              step="any"
            />
          </div>
        </>
      )}

      {/* Shared optional fields */}
      {goalType && (
        <>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <textarea
              className="border-input dark:bg-input/30 flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Any additional details about this goal..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Target Date (optional)</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSaving} className="flex-1">
              {isSaving ? "Saving..." : "Create Goal"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

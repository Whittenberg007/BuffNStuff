"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings } from "@/lib/database/settings";
import { toast } from "sonner";
import type { UserSettings } from "@/types";

type Gender = "male" | "female";

const ACTIVITY_LEVELS = [
  { value: "1.2", label: "Sedentary", description: "Little or no exercise" },
  {
    value: "1.375",
    label: "Lightly Active",
    description: "Light exercise 1-3 days/week",
  },
  {
    value: "1.55",
    label: "Moderately Active",
    description: "Moderate exercise 3-5 days/week",
  },
  {
    value: "1.725",
    label: "Very Active",
    description: "Hard exercise 6-7 days/week",
  },
  {
    value: "1.9",
    label: "Extra Active",
    description: "Very hard exercise, physical job",
  },
];

interface TDEECalculatorProps {
  settings: UserSettings;
  onSettingsUpdated: (settings: UserSettings) => void;
}

export function TDEECalculator({
  settings,
  onSettingsUpdated,
}: TDEECalculatorProps) {
  const [gender, setGender] = useState<Gender>("male");
  const [weightLbs, setWeightLbs] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [age, setAge] = useState("");
  const [activityLevel, setActivityLevel] = useState("1.55");
  const [tdeeResult, setTdeeResult] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function calculateTDEE() {
    const w = parseFloat(weightLbs);
    const ft = parseInt(heightFeet, 10);
    const inch = parseInt(heightInches, 10) || 0;
    const a = parseInt(age, 10);
    const multiplier = parseFloat(activityLevel);

    if (isNaN(w) || isNaN(ft) || isNaN(a) || w <= 0 || ft <= 0 || a <= 0) {
      toast.error("Please fill in all fields with valid values");
      return;
    }

    // Convert lbs to kg
    const weightKg = w * 0.453592;
    // Convert feet + inches to cm
    const heightCm = (ft * 12 + inch) * 2.54;

    // Mifflin-St Jeor formula
    let bmr: number;
    if (gender === "male") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * a + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * a - 161;
    }

    const tdee = Math.round(bmr * multiplier);
    setTdeeResult(tdee);
  }

  async function handleUseAsTarget() {
    if (!tdeeResult) return;

    setIsSaving(true);
    try {
      const updated = await updateSettings({
        daily_calorie_target: tdeeResult,
        tdee_estimate: tdeeResult,
      });
      onSettingsUpdated(updated);
      toast.success(`Calorie target set to ${tdeeResult} cal`);
    } catch (err) {
      console.error("Failed to update calorie target:", err);
      toast.error("Failed to update calorie target");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>TDEE Calculator</CardTitle>
        <CardDescription>
          Estimate your Total Daily Energy Expenditure using the Mifflin-St Jeor
          equation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Gender</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={gender === "male" ? "default" : "outline"}
              size="sm"
              onClick={() => setGender("male")}
            >
              Male
            </Button>
            <Button
              type="button"
              variant={gender === "female" ? "default" : "outline"}
              size="sm"
              onClick={() => setGender("female")}
            >
              Female
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tdee-weight">Weight (lbs)</Label>
          <Input
            id="tdee-weight"
            type="number"
            min={0}
            placeholder="180"
            value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Height</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={0}
              placeholder="5"
              value={heightFeet}
              onChange={(e) => setHeightFeet(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">ft</span>
            <Input
              type="number"
              min={0}
              max={11}
              placeholder="10"
              value={heightInches}
              onChange={(e) => setHeightInches(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">in</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tdee-age">Age</Label>
          <Input
            id="tdee-age"
            type="number"
            min={1}
            placeholder="25"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="activity-level">Activity Level</Label>
          <Select value={activityLevel} onValueChange={setActivityLevel}>
            <SelectTrigger id="activity-level" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {ACTIVITY_LEVELS.find((l) => l.value === activityLevel)
              ?.description}
          </p>
        </div>

        <Button onClick={calculateTDEE} className="w-full">
          Calculate TDEE
        </Button>

        {tdeeResult !== null && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                Estimated TDEE
              </div>
              <div className="text-3xl font-bold">
                {tdeeResult.toLocaleString()} cal
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                calories per day
              </div>
            </div>
            <Button
              onClick={handleUseAsTarget}
              variant="outline"
              className="w-full"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Use as Calorie Target"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

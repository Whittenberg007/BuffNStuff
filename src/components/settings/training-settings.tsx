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
import type { UserSettings, RotationMode } from "@/types";

const SPLIT_OPTIONS = [
  { value: "ppl", label: "Push / Pull / Legs" },
  { value: "upper_lower", label: "Upper / Lower" },
  { value: "full_body", label: "Full Body" },
  { value: "bro_split", label: "Bro Split" },
  { value: "custom", label: "Custom" },
];

const ROTATION_MODE_OPTIONS: {
  value: RotationMode;
  label: string;
  description: string;
}[] = [
  {
    value: "manual",
    label: "Manual",
    description: "You control all exercise changes",
  },
  {
    value: "suggested",
    label: "Suggested",
    description: "Get swap suggestions when exercises go stale",
  },
  {
    value: "auto",
    label: "Auto-rotate",
    description: "Exercises automatically rotate every 4-6 weeks",
  },
];

interface TrainingSettingsProps {
  settings: UserSettings;
  onSettingsUpdated: (settings: UserSettings) => void;
}

export function TrainingSettings({
  settings,
  onSettingsUpdated,
}: TrainingSettingsProps) {
  const [preferredSplit, setPreferredSplit] = useState(
    settings.preferred_split
  );
  const [trainingDays, setTrainingDays] = useState(
    settings.training_days_per_week
  );
  const [rotationMode, setRotationMode] = useState<RotationMode>(
    settings.rotation_mode
  );
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const updated = await updateSettings({
        preferred_split: preferredSplit,
        training_days_per_week: trainingDays,
        rotation_mode: rotationMode,
      });
      onSettingsUpdated(updated);
      toast.success("Training settings saved");
    } catch (err) {
      console.error("Failed to save training settings:", err);
      toast.error("Failed to save training settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training</CardTitle>
        <CardDescription>
          Configure your workout split and rotation preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="preferred-split">Preferred Split</Label>
          <Select value={preferredSplit} onValueChange={setPreferredSplit}>
            <SelectTrigger id="preferred-split" className="w-full">
              <SelectValue placeholder="Select a split" />
            </SelectTrigger>
            <SelectContent>
              {SPLIT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="training-days">Training Days Per Week</Label>
          <Input
            id="training-days"
            type="number"
            min={1}
            max={7}
            value={trainingDays}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1 && val <= 7) {
                setTrainingDays(val);
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Rotation Mode</Label>
          <div className="space-y-2">
            {ROTATION_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRotationMode(opt.value)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  rotationMode === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Training Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

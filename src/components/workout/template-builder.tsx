"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createTemplate,
  updateTemplateWithExercises,
} from "@/lib/database/templates";
import { ExercisePickerDialog } from "./exercise-picker-dialog";
import {
  getPairingTips,
  getVolumeStatus,
  VOLUME_LANDMARKS,
} from "@/lib/training/pairing-guidance";
import type {
  Exercise,
  MuscleGroup,
  SplitType,
  TrainingStyle,
  WorkoutTemplate,
  TemplateExercise,
} from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

interface TemplateExerciseRow {
  localId: string;
  exercise: Exercise;
  targetSets: number;
  targetReps: number;
  targetWeight: string;
}

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "upper", label: "Upper" },
  { value: "lower", label: "Lower" },
  { value: "full_body", label: "Full Body" },
  { value: "custom", label: "Custom" },
];

const STYLE_OPTIONS: { value: TrainingStyle; label: string }[] = [
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "strength", label: "Strength" },
  { value: "mixed", label: "Mixed" },
];

interface TemplateBuilderProps {
  /** If provided, the builder is in edit mode */
  existingTemplate?: WorkoutTemplate;
  existingExercises?: TemplateExercise[];
}

export function TemplateBuilder({
  existingTemplate,
  existingExercises = [],
}: TemplateBuilderProps) {
  const router = useRouter();
  const isEditMode = !!existingTemplate;

  // Form state
  const [name, setName] = useState(existingTemplate?.name || "");
  const [splitType, setSplitType] = useState<SplitType>(
    existingTemplate?.split_type || "push"
  );
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>(
    existingTemplate?.training_style || "hypertrophy"
  );
  const [description, setDescription] = useState(
    existingTemplate?.description || ""
  );

  // Exercise rows
  const [exercises, setExercises] = useState<TemplateExerciseRow[]>(() =>
    existingExercises
      .filter((te) => te.exercise)
      .map((te, idx) => ({
        localId: `existing-${idx}-${te.id}`,
        exercise: te.exercise!,
        targetSets: te.target_sets,
        targetReps: te.target_reps,
        targetWeight: te.target_weight ? String(te.target_weight) : "",
      }))
  );

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Unique muscle groups from exercises
  const muscleGroups = useMemo(() => {
    const groups = new Set<MuscleGroup>();
    for (const row of exercises) {
      groups.add(row.exercise.primary_muscle_group);
      if (row.exercise.secondary_muscles) {
        for (const m of row.exercise.secondary_muscles) {
          groups.add(m);
        }
      }
    }
    return Array.from(groups);
  }, [exercises]);

  // Pairing tips
  const tips = useMemo(() => getPairingTips(muscleGroups), [muscleGroups]);

  // Volume context per muscle group
  const volumeContext = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of exercises) {
      const mg = row.exercise.primary_muscle_group;
      counts[mg] = (counts[mg] || 0) + row.targetSets;
    }
    return Object.entries(counts).map(([mg, sets]) => ({
      muscleGroup: mg as MuscleGroup,
      sets,
      ...getVolumeStatus(mg as MuscleGroup, sets),
    }));
  }, [exercises]);

  // Add exercise handler
  const handleAddExercise = useCallback(
    (exercise: Exercise) => {
      setExercises((prev) => [
        ...prev,
        {
          localId: `new-${Date.now()}-${exercise.id}`,
          exercise,
          targetSets: 3,
          targetReps: trainingStyle === "strength" ? 5 : 10,
          targetWeight: "",
        },
      ]);
    },
    [trainingStyle]
  );

  // Remove exercise
  const handleRemoveExercise = useCallback((localId: string) => {
    setExercises((prev) => prev.filter((e) => e.localId !== localId));
  }, []);

  // Move exercise
  const handleMoveExercise = useCallback(
    (localId: string, direction: "up" | "down") => {
      setExercises((prev) => {
        const idx = prev.findIndex((e) => e.localId === localId);
        if (idx === -1) return prev;
        if (direction === "up" && idx === 0) return prev;
        if (direction === "down" && idx === prev.length - 1) return prev;

        const newArr = [...prev];
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
        return newArr;
      });
    },
    []
  );

  // Update exercise field
  const handleUpdateExercise = useCallback(
    (
      localId: string,
      field: "targetSets" | "targetReps" | "targetWeight",
      value: string
    ) => {
      setExercises((prev) =>
        prev.map((e) => {
          if (e.localId !== localId) return e;
          if (field === "targetWeight") {
            return { ...e, targetWeight: value };
          }
          const num = parseInt(value) || 0;
          return { ...e, [field]: num };
        })
      );
    },
    []
  );

  // Save
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    setIsSaving(true);
    try {
      const exerciseData = exercises.map((e) => ({
        exerciseId: e.exercise.id,
        targetSets: e.targetSets || 3,
        targetReps: e.targetReps || 10,
        targetWeight: e.targetWeight ? parseFloat(e.targetWeight) : undefined,
      }));

      if (isEditMode && existingTemplate) {
        await updateTemplateWithExercises(existingTemplate.id, {
          name: name.trim(),
          splitType,
          trainingStyle,
          description: description.trim() || undefined,
          exercises: exerciseData,
        });
        toast.success("Template updated");
      } else {
        await createTemplate({
          name: name.trim(),
          splitType,
          trainingStyle,
          description: description.trim() || undefined,
          exercises: exerciseData,
        });
        toast.success("Template created");
      }

      router.push("/workout/templates");
    } catch (err) {
      console.error("Failed to save template:", err);
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    splitType,
    trainingStyle,
    description,
    exercises,
    isEditMode,
    existingTemplate,
    router,
  ]);

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? "Edit Template" : "New Template"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="template-name" className="text-sm mb-1.5 block">
              Template Name
            </Label>
            <Input
              id="template-name"
              placeholder="e.g. Push Day A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Split type + Training style */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1.5 block">Split Type</Label>
              <Select
                value={splitType}
                onValueChange={(v) => setSplitType(v as SplitType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
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
            <div>
              <Label className="text-sm mb-1.5 block">Training Style</Label>
              <Select
                value={trainingStyle}
                onValueChange={(v) => setTrainingStyle(v as TrainingStyle)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="template-desc" className="text-sm mb-1.5 block">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <textarea
              id="template-desc"
              placeholder="Notes about this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Exercise list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Exercises ({exercises.length})
          </h2>
        </div>

        {exercises.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              No exercises added yet
            </p>
            <Button onClick={() => setShowExercisePicker(true)}>
              <Plus className="size-4" /> Add Exercise
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {exercises.map((row, index) => (
              <Card key={row.localId} className="py-3">
                <CardContent className="space-y-3">
                  {/* Exercise header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {index + 1}.
                      </span>
                      <span className="font-medium text-sm truncate">
                        {row.exercise.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 shrink-0"
                      >
                        {capitalize(row.exercise.primary_muscle_group)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          handleMoveExercise(row.localId, "up")
                        }
                        disabled={index === 0}
                      >
                        <ArrowUp className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          handleMoveExercise(row.localId, "down")
                        }
                        disabled={index === exercises.length - 1}
                      >
                        <ArrowDown className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveExercise(row.localId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Inputs row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-1 block">
                        Sets
                      </Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        value={row.targetSets}
                        onChange={(e) =>
                          handleUpdateExercise(
                            row.localId,
                            "targetSets",
                            e.target.value
                          )
                        }
                        className="h-9 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-1 block">
                        Reps
                      </Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        value={row.targetReps}
                        onChange={(e) =>
                          handleUpdateExercise(
                            row.localId,
                            "targetReps",
                            e.target.value
                          )
                        }
                        className="h-9 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-1 block">
                        Weight (lbs)
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={2.5}
                        placeholder="--"
                        value={row.targetWeight}
                        onChange={(e) =>
                          handleUpdateExercise(
                            row.localId,
                            "targetWeight",
                            e.target.value
                          )
                        }
                        className="h-9 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowExercisePicker(true)}
            >
              <Plus className="size-4" /> Add Exercise
            </Button>
          </div>
        )}
      </div>

      {/* Pairing Guidance Panel */}
      {exercises.length > 0 && (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-4 text-yellow-500" />
                <CardTitle className="text-sm">Pairing Guidance</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowGuidance((prev) => !prev)}
              >
                {showGuidance ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
            </div>
          </CardHeader>

          {showGuidance && (
            <CardContent className="space-y-3">
              {/* Muscle targets */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Muscles targeted:
                </p>
                <div className="flex flex-wrap gap-1">
                  {muscleGroups.map((mg) => (
                    <Badge
                      key={mg}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {capitalize(mg)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Pairing tips */}
              {tips.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Pairing tips:
                  </p>
                  <ul className="space-y-1">
                    {tips.map((tip, i) => (
                      <li
                        key={i}
                        className="text-xs text-green-600 dark:text-green-400 flex items-start gap-1.5"
                      >
                        <span className="shrink-0 mt-0.5">*</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Volume context */}
              {volumeContext.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Volume per session (this template):
                  </p>
                  <div className="space-y-1">
                    {volumeContext.map((vc) => (
                      <div
                        key={vc.muscleGroup}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="capitalize">{vc.muscleGroup}</span>
                        <span className={cn("font-medium", vc.color)}>
                          {vc.sets} sets
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/workout/templates")}
          disabled={isSaving}
        >
          <X className="size-4" /> Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="size-4" /> {isEditMode ? "Update" : "Create"}{" "}
              Template
            </>
          )}
        </Button>
      </div>

      {/* Exercise Picker Dialog */}
      <ExercisePickerDialog
        open={showExercisePicker}
        onOpenChange={setShowExercisePicker}
        onSelect={handleAddExercise}
        existingExerciseIds={exercises.map((e) => e.exercise.id)}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createProgram } from "@/lib/database/programs";
import { ProgressionConfig } from "./progression-config";
import type {
  ProgramGoal,
  ProgramDifficulty,
  PeriodizationType,
  ProgressionRules,
  DeloadConfig,
  ProgramWeek,
  ProgramDay,
  ProgramExercise,
  ProgramSchedule,
} from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

const GOAL_OPTIONS: { value: ProgramGoal; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "endurance", label: "Endurance" },
  { value: "recomp", label: "Recomp" },
  { value: "general", label: "General" },
];

const DIFFICULTY_OPTIONS: { value: ProgramDifficulty; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const PERIODIZATION_OPTIONS: { value: PeriodizationType; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "dup", label: "Daily Undulating (DUP)" },
  { value: "block", label: "Block" },
  { value: "conjugate", label: "Conjugate" },
];

const selectClassName =
  "w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm";
const inputClassName =
  "w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm";

const TOTAL_STEPS = 5;

interface ProgramBuilderProps {
  onCreated: () => void;
}

function createEmptyExercise(): ProgramExercise {
  return {
    exercise_id: crypto.randomUUID(),
    exercise_name: "",
    sets: 3,
    reps: 10,
  };
}

function createEmptyDay(dayIndex: number): ProgramDay {
  return {
    day_of_week: dayIndex + 1,
    template_id: null,
    label: `Day ${dayIndex + 1}`,
    exercises: [createEmptyExercise()],
  };
}

function createEmptyWeek(
  weekNumber: number,
  daysPerWeek: number
): ProgramWeek {
  return {
    week_number: weekNumber,
    label: `Week ${weekNumber}`,
    is_deload: false,
    days: Array.from({ length: daysPerWeek }, (_, i) => createEmptyDay(i)),
  };
}

function deepCloneWeek(source: ProgramWeek, newWeekNumber: number): ProgramWeek {
  return {
    ...JSON.parse(JSON.stringify(source)),
    week_number: newWeekNumber,
    label: `Week ${newWeekNumber}`,
  };
}

export function ProgramBuilder({ onCreated }: ProgramBuilderProps) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState<ProgramGoal>("hypertrophy");
  const [difficulty, setDifficulty] = useState<ProgramDifficulty>("intermediate");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [periodization, setPeriodization] = useState<PeriodizationType>("linear");

  // Step 2: Schedule
  const [weeks, setWeeks] = useState<ProgramWeek[]>(() => [
    createEmptyWeek(1, 4),
  ]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    () => new Set([1])
  );

  // Step 3: Progression
  const [progressionRules, setProgressionRules] = useState<ProgressionRules>({
    type: "linear_weight",
    compound_increment_lbs: 5,
    isolation_increment_lbs: 2.5,
    failure_protocol: "deload_10_percent",
  });

  // Step 4: Deload
  const [deloadConfig, setDeloadConfig] = useState<DeloadConfig>({
    every_n_weeks: 4,
    volume_reduction: 0.5,
    intensity_reduction: 0,
  });

  // Sync weeks array when moving to Step 2
  function syncWeeksToSettings() {
    setWeeks((prev) => {
      const currentLength = prev.length;
      if (currentLength === durationWeeks && prev[0]?.days.length === daysPerWeek) {
        return prev;
      }

      const newWeeks: ProgramWeek[] = [];
      for (let w = 1; w <= durationWeeks; w++) {
        if (w <= currentLength) {
          // Keep existing week but adjust days count
          const existingWeek = prev[w - 1];
          const existingDays = existingWeek.days;
          let adjustedDays: ProgramDay[];
          if (existingDays.length === daysPerWeek) {
            adjustedDays = existingDays;
          } else if (existingDays.length < daysPerWeek) {
            adjustedDays = [
              ...existingDays,
              ...Array.from(
                { length: daysPerWeek - existingDays.length },
                (_, i) => createEmptyDay(existingDays.length + i)
              ),
            ];
          } else {
            adjustedDays = existingDays.slice(0, daysPerWeek);
          }
          newWeeks.push({
            ...existingWeek,
            week_number: w,
            label: existingWeek.label || `Week ${w}`,
            days: adjustedDays,
          });
        } else {
          newWeeks.push(createEmptyWeek(w, daysPerWeek));
        }
      }
      return newWeeks;
    });
  }

  function toggleWeekExpanded(weekNumber: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  }

  function copyWeekOneToAll() {
    if (weeks.length === 0) return;
    const weekOne = weeks[0];
    setWeeks((prev) =>
      prev.map((w, i) =>
        i === 0 ? w : deepCloneWeek(weekOne, i + 1)
      )
    );
    toast.success("Week 1 schedule copied to all weeks");
  }

  function updateDayLabel(weekIndex: number, dayIndex: number, label: string) {
    setWeeks((prev) =>
      prev.map((w, wi) =>
        wi === weekIndex
          ? {
              ...w,
              days: w.days.map((d, di) =>
                di === dayIndex ? { ...d, label } : d
              ),
            }
          : w
      )
    );
  }

  function addExercise(weekIndex: number, dayIndex: number) {
    setWeeks((prev) =>
      prev.map((w, wi) =>
        wi === weekIndex
          ? {
              ...w,
              days: w.days.map((d, di) =>
                di === dayIndex
                  ? { ...d, exercises: [...d.exercises, createEmptyExercise()] }
                  : d
              ),
            }
          : w
      )
    );
  }

  function removeExercise(
    weekIndex: number,
    dayIndex: number,
    exerciseIndex: number
  ) {
    setWeeks((prev) =>
      prev.map((w, wi) =>
        wi === weekIndex
          ? {
              ...w,
              days: w.days.map((d, di) =>
                di === dayIndex
                  ? {
                      ...d,
                      exercises: d.exercises.filter(
                        (_, ei) => ei !== exerciseIndex
                      ),
                    }
                  : d
              ),
            }
          : w
      )
    );
  }

  function updateExercise(
    weekIndex: number,
    dayIndex: number,
    exerciseIndex: number,
    field: keyof ProgramExercise,
    rawValue: string
  ) {
    setWeeks((prev) =>
      prev.map((w, wi) =>
        wi === weekIndex
          ? {
              ...w,
              days: w.days.map((d, di) =>
                di === dayIndex
                  ? {
                      ...d,
                      exercises: d.exercises.map((ex, ei) => {
                        if (ei !== exerciseIndex) return ex;
                        if (field === "exercise_name") {
                          return { ...ex, exercise_name: rawValue };
                        }
                        if (field === "reps") {
                          // Allow text like "5/3/1"
                          const numVal = parseInt(rawValue);
                          return {
                            ...ex,
                            reps: isNaN(numVal) ? rawValue : numVal,
                          };
                        }
                        if (field === "sets") {
                          return {
                            ...ex,
                            sets: parseInt(rawValue) || 1,
                          };
                        }
                        return ex;
                      }),
                    }
                  : d
              ),
            }
          : w
      )
    );
  }

  function handleNext() {
    if (step === 1) {
      if (!name.trim()) {
        toast.error("Program name is required");
        return;
      }
      syncWeeksToSettings();
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Program name is required");
      return;
    }

    setIsSaving(true);
    try {
      const schedule: ProgramSchedule = { weeks };

      await createProgram({
        name: name.trim(),
        description: description.trim() || null,
        duration_weeks: durationWeeks,
        difficulty,
        goal,
        days_per_week: daysPerWeek,
        periodization,
        schedule,
        progression_rules: progressionRules,
        deload_config: deloadConfig,
      });

      toast.success("Program created successfully");
      onCreated();
    } catch (err) {
      console.error("Failed to create program:", err);
      toast.error("Failed to create program");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </p>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full transition-colors ${
                i + 1 <= step ? "bg-primary" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Basics */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Program Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">
                Program Name <span className="text-red-400">*</span>
              </Label>
              <input
                type="text"
                className={inputClassName}
                placeholder="e.g. 12-Week Strength Builder"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <textarea
                className={`${inputClassName} resize-none min-h-[80px]`}
                placeholder="Describe your program..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1.5 block">Goal</Label>
                <select
                  className={selectClassName}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as ProgramGoal)}
                >
                  {GOAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Difficulty</Label>
                <select
                  className={selectClassName}
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as ProgramDifficulty)
                  }
                >
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1.5 block">Days Per Week</Label>
                <input
                  type="number"
                  className={inputClassName}
                  value={daysPerWeek}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 3;
                    setDaysPerWeek(Math.max(3, Math.min(6, v)));
                  }}
                  min={3}
                  max={6}
                />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Duration (weeks)</Label>
                <input
                  type="number"
                  className={inputClassName}
                  value={durationWeeks}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 4;
                    setDurationWeeks(Math.max(4, Math.min(12, v)));
                  }}
                  min={4}
                  max={12}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">Periodization</Label>
              <select
                className={selectClassName}
                value={periodization}
                onChange={(e) =>
                  setPeriodization(e.target.value as PeriodizationType)
                }
              >
                {PERIODIZATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Schedule */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Weekly Schedule</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={copyWeekOneToAll}
                disabled={weeks.length <= 1}
              >
                <Copy className="size-4" />
                Copy Week 1 to All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {weeks.map((week, weekIndex) => {
              const isExpanded = expandedWeeks.has(week.week_number);
              return (
                <div
                  key={week.week_number}
                  className="border border-zinc-700 rounded-lg overflow-hidden"
                >
                  {/* Week header - collapsible */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
                    onClick={() => toggleWeekExpanded(week.week_number)}
                  >
                    <span className="text-sm font-medium">
                      {week.label}
                      {week.is_deload && (
                        <span className="text-xs text-yellow-400 ml-2">
                          (Deload)
                        </span>
                      )}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Week content */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {week.days.map((day, dayIndex) => (
                        <div
                          key={dayIndex}
                          className="border border-zinc-700/50 rounded-md p-3 space-y-3"
                        >
                          {/* Day label */}
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Day {dayIndex + 1} Label
                            </Label>
                            <input
                              type="text"
                              className={inputClassName}
                              value={day.label}
                              onChange={(e) =>
                                updateDayLabel(
                                  weekIndex,
                                  dayIndex,
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Push Day, Upper Power"
                            />
                          </div>

                          {/* Exercises */}
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                              Exercises
                            </p>
                            {day.exercises.map((exercise, exIndex) => (
                              <div
                                key={exercise.exercise_id}
                                className="flex items-end gap-2"
                              >
                                <div className="flex-1">
                                  {exIndex === 0 && (
                                    <Label className="text-[11px] text-muted-foreground mb-1 block">
                                      Name
                                    </Label>
                                  )}
                                  <input
                                    type="text"
                                    className={inputClassName}
                                    value={exercise.exercise_name}
                                    onChange={(e) =>
                                      updateExercise(
                                        weekIndex,
                                        dayIndex,
                                        exIndex,
                                        "exercise_name",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Exercise name"
                                  />
                                </div>
                                <div className="w-16">
                                  {exIndex === 0 && (
                                    <Label className="text-[11px] text-muted-foreground mb-1 block">
                                      Sets
                                    </Label>
                                  )}
                                  <input
                                    type="number"
                                    className={`${inputClassName} text-center`}
                                    value={exercise.sets}
                                    onChange={(e) =>
                                      updateExercise(
                                        weekIndex,
                                        dayIndex,
                                        exIndex,
                                        "sets",
                                        e.target.value
                                      )
                                    }
                                    min={1}
                                    max={20}
                                  />
                                </div>
                                <div className="w-20">
                                  {exIndex === 0 && (
                                    <Label className="text-[11px] text-muted-foreground mb-1 block">
                                      Reps
                                    </Label>
                                  )}
                                  <input
                                    type="text"
                                    className={`${inputClassName} text-center`}
                                    value={String(exercise.reps)}
                                    onChange={(e) =>
                                      updateExercise(
                                        weekIndex,
                                        dayIndex,
                                        exIndex,
                                        "reps",
                                        e.target.value
                                      )
                                    }
                                    placeholder="10"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 text-destructive hover:text-destructive h-9 w-9"
                                  onClick={() =>
                                    removeExercise(weekIndex, dayIndex, exIndex)
                                  }
                                  disabled={day.exercises.length <= 1}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => addExercise(weekIndex, dayIndex)}
                            >
                              <Plus className="size-4" />
                              Add Exercise
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Progression */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Progression Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressionConfig
              value={progressionRules}
              onChange={setProgressionRules}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Deload */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Deload Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">
                Deload Every N Weeks
              </Label>
              <input
                type="number"
                className={inputClassName}
                value={deloadConfig.every_n_weeks}
                onChange={(e) =>
                  setDeloadConfig((prev) => ({
                    ...prev,
                    every_n_weeks: parseInt(e.target.value) || 4,
                  }))
                }
                min={2}
                max={12}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A deload week will be programmed every {deloadConfig.every_n_weeks}{" "}
                weeks
              </p>
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">
                Volume Reduction ({Math.round(deloadConfig.volume_reduction * 100)}
                %)
              </Label>
              <input
                type="number"
                className={inputClassName}
                value={Math.round(deloadConfig.volume_reduction * 100)}
                onChange={(e) => {
                  const pct = parseInt(e.target.value) || 0;
                  setDeloadConfig((prev) => ({
                    ...prev,
                    volume_reduction: Math.max(0, Math.min(100, pct)) / 100,
                  }));
                }}
                min={0}
                max={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Reduce total sets/volume by this percentage during deload
              </p>
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">
                Intensity Reduction (
                {Math.round(deloadConfig.intensity_reduction * 100)}%)
              </Label>
              <input
                type="number"
                className={inputClassName}
                value={Math.round(deloadConfig.intensity_reduction * 100)}
                onChange={(e) => {
                  const pct = parseInt(e.target.value) || 0;
                  setDeloadConfig((prev) => ({
                    ...prev,
                    intensity_reduction: Math.max(0, Math.min(100, pct)) / 100,
                  }));
                }}
                min={0}
                max={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Reduce weight/intensity by this percentage during deload
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Program</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Basics Summary */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Basics
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{name}</span>
                </div>
                {description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium text-right max-w-[60%] truncate">
                      {description}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goal</span>
                  <span className="font-medium">{capitalize(goal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Difficulty</span>
                  <span className="font-medium">{capitalize(difficulty)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Per Week</span>
                  <span className="font-medium">{daysPerWeek}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{durationWeeks} weeks</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Periodization</span>
                  <span className="font-medium">
                    {capitalize(periodization)}
                  </span>
                </div>
              </div>
            </div>

            {/* Schedule Summary */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Schedule
              </h3>
              <div className="space-y-2">
                {weeks.slice(0, 2).map((week) => (
                  <div key={week.week_number} className="text-sm">
                    <p className="font-medium">{week.label}</p>
                    <div className="ml-3 space-y-0.5">
                      {week.days.map((day, di) => (
                        <p key={di} className="text-muted-foreground text-xs">
                          {day.label}: {day.exercises.length} exercise
                          {day.exercises.length !== 1 ? "s" : ""}
                          {day.exercises.length > 0 && (
                            <span className="text-zinc-500">
                              {" "}
                              (
                              {day.exercises
                                .map((ex) => ex.exercise_name || "Unnamed")
                                .join(", ")}
                              )
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {weeks.length > 2 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {weeks.length - 2} more week
                    {weeks.length - 2 !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Progression Summary */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Progression
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {capitalize(progressionRules.type)}
                  </span>
                </div>
                {progressionRules.type === "linear_weight" && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Compound Increment
                      </span>
                      <span className="font-medium">
                        {progressionRules.compound_increment_lbs} lbs
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Isolation Increment
                      </span>
                      <span className="font-medium">
                        {progressionRules.isolation_increment_lbs} lbs
                      </span>
                    </div>
                  </>
                )}
                {progressionRules.type === "percentage" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Percentage Increase
                    </span>
                    <span className="font-medium">
                      {progressionRules.percentage_increase}%
                    </span>
                  </div>
                )}
                {progressionRules.type === "rpe" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">RPE Target</span>
                    <span className="font-medium">
                      {progressionRules.rpe_target}
                    </span>
                  </div>
                )}
                {progressionRules.failure_protocol && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Failure Protocol
                    </span>
                    <span className="font-medium">
                      {capitalize(progressionRules.failure_protocol)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Deload Summary */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Deload
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frequency</span>
                  <span className="font-medium">
                    Every {deloadConfig.every_n_weeks} weeks
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Volume Reduction
                  </span>
                  <span className="font-medium">
                    {Math.round(deloadConfig.volume_reduction * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Intensity Reduction
                  </span>
                  <span className="font-medium">
                    {Math.round(deloadConfig.intensity_reduction * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={handleBack} disabled={isSaving}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        )}

        <div className="flex-1" />

        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={isSaving || !name.trim()}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Program"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

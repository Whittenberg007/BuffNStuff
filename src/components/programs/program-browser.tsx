"use client";

import { useState } from "react";
import { ProgramCard } from "@/components/programs/program-card";
import type { TrainingProgram, ProgramGoal, ProgramDifficulty } from "@/types";

interface ProgramBrowserProps {
  programs: TrainingProgram[];
  onSelect: (program: TrainingProgram) => void;
}

export function ProgramBrowser({ programs, onSelect }: ProgramBrowserProps) {
  const [goalFilter, setGoalFilter] = useState<"all" | ProgramGoal>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | ProgramDifficulty>("all");
  const [daysFilter, setDaysFilter] = useState<"all" | string>("all");

  const filtered = programs.filter((p) => {
    if (goalFilter !== "all" && p.goal !== goalFilter) return false;
    if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter) return false;
    if (daysFilter !== "all" && p.days_per_week !== Number(daysFilter)) return false;
    return true;
  });

  const selectClassName =
    "rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={goalFilter}
          onChange={(e) => setGoalFilter(e.target.value as "all" | ProgramGoal)}
          className={selectClassName}
        >
          <option value="all">All Goals</option>
          <option value="strength">Strength</option>
          <option value="hypertrophy">Hypertrophy</option>
          <option value="endurance">Endurance</option>
          <option value="recomp">Recomp</option>
          <option value="general">General</option>
        </select>

        <select
          value={difficultyFilter}
          onChange={(e) =>
            setDifficultyFilter(e.target.value as "all" | ProgramDifficulty)
          }
          className={selectClassName}
        >
          <option value="all">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <select
          value={daysFilter}
          onChange={(e) => setDaysFilter(e.target.value)}
          className={selectClassName}
        >
          <option value="all">Any Days</option>
          <option value="3">3 days/week</option>
          <option value="4">4 days/week</option>
          <option value="5">5 days/week</option>
          <option value="6">6 days/week</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No programs match your filters
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onSelect={() => onSelect(program)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

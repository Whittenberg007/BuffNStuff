"use client";

import { Dumbbell, Calendar, Clock, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TrainingProgram, ProgramGoal, ProgramDifficulty } from "@/types";

const goalColorMap: Record<ProgramGoal, string> = {
  strength: "bg-red-900 text-red-200",
  hypertrophy: "bg-purple-900 text-purple-200",
  general: "bg-blue-900 text-blue-200",
  endurance: "bg-green-900 text-green-200",
  recomp: "bg-yellow-900 text-yellow-200",
};

const goalLabelMap: Record<ProgramGoal, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  general: "General",
  endurance: "Endurance",
  recomp: "Recomp",
};

const difficultyColorMap: Record<ProgramDifficulty, string> = {
  beginner: "bg-green-900 text-green-200",
  intermediate: "bg-yellow-900 text-yellow-200",
  advanced: "bg-red-900 text-red-200",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ProgramCardProps {
  program: TrainingProgram;
  onSelect?: () => void;
  enrolled?: boolean;
}

export function ProgramCard({ program, onSelect, enrolled }: ProgramCardProps) {
  return (
    <Card
      className={cn(
        "py-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
        enrolled && "border-emerald-500/50"
      )}
      onClick={onSelect}
    >
      <CardHeader className="px-4 pb-0 pt-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{program.name}</CardTitle>
          {enrolled && (
            <Badge
              variant="outline"
              className="border-0 bg-emerald-900 text-emerald-200 text-[10px] shrink-0"
            >
              Active
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 border-0",
              goalColorMap[program.goal]
            )}
          >
            <Target className="h-3 w-3 mr-0.5" />
            {goalLabelMap[program.goal]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 border-0",
              difficultyColorMap[program.difficulty]
            )}
          >
            {capitalize(program.difficulty)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-2 space-y-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {program.days_per_week} days/week
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {program.duration_weeks} weeks
          </span>
          <span className="flex items-center gap-1">
            <Dumbbell className="h-3 w-3" />
            {capitalize(program.periodization)}
          </span>
        </div>
        {program.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {program.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

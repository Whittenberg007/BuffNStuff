"use client";

import { Check, X } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { completeGoal, abandonGoal } from "@/lib/database/goals";
import type { Goal } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  strength: "Strength",
  body_comp: "Body Comp",
  consistency: "Consistency",
  volume: "Volume",
  nutrition: "Nutrition",
  custom: "Custom",
};

interface GoalCardProps {
  goal: Goal;
  onUpdated: () => void;
}

export function GoalCard({ goal, onUpdated }: GoalCardProps) {
  const percentage =
    goal.target_value && goal.target_value > 0
      ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
      : 0;

  const isCompleted = goal.status === "completed";
  const isAbandoned = goal.status === "abandoned";
  const isActive = goal.status === "active";

  // Determine countdown and color
  let daysRemaining: number | null = null;
  let isOverdue = false;

  if (goal.target_date && isActive) {
    daysRemaining = differenceInDays(parseISO(goal.target_date), new Date());
    isOverdue = daysRemaining < 0;
  }

  // Color logic: green for on-track, yellow for behind, gold border for completed
  let progressColor = "bg-emerald-500";
  let borderClass = "";

  if (isCompleted) {
    borderClass = "border-amber-400 border-2";
    progressColor = "bg-amber-500";
  } else if (isAbandoned) {
    progressColor = "bg-muted-foreground";
  } else if (isOverdue || (daysRemaining !== null && daysRemaining < 7 && percentage < 75)) {
    progressColor = "bg-yellow-500";
  }

  async function handleComplete() {
    try {
      await completeGoal(goal.id);
      onUpdated();
    } catch (err) {
      console.error("Failed to complete goal:", err);
    }
  }

  async function handleAbandon() {
    try {
      await abandonGoal(goal.id);
      onUpdated();
    } catch (err) {
      console.error("Failed to abandon goal:", err);
    }
  }

  return (
    <Card className={`py-4 ${borderClass}`}>
      <CardContent className="px-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm leading-tight truncate">
                {goal.title}
              </h3>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {TYPE_LABELS[goal.type] || goal.type}
              </Badge>
            </div>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {goal.description}
              </p>
            )}
          </div>

          {isActive && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleComplete}
                title="Complete goal"
                className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
              >
                <Check />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleAbandon}
                title="Abandon goal"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X />
              </Button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {goal.target_value !== null && goal.target_value > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {goal.current_value} / {goal.target_value}
              </span>
              <span>{percentage}%</span>
            </div>
            <div className="bg-primary/20 relative h-2 w-full overflow-hidden rounded-full">
              <div
                className={`h-full transition-all ${progressColor}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Target date */}
        {goal.target_date && isActive && (
          <div className="text-xs text-muted-foreground">
            {isOverdue ? (
              <span className="text-yellow-600 font-medium">
                Overdue by {Math.abs(daysRemaining!)} day
                {Math.abs(daysRemaining!) !== 1 ? "s" : ""}
              </span>
            ) : (
              <span>
                {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
              </span>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="text-xs text-amber-600 font-medium">Completed</div>
        )}
        {isAbandoned && (
          <div className="text-xs text-muted-foreground">Abandoned</div>
        )}
      </CardContent>
    </Card>
  );
}

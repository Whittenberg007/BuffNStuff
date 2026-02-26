"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Target, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { GoalForm } from "./goal-form";
import { GoalCard } from "./goal-card";
import { getAllGoals } from "@/lib/database/goals";
import type { Goal } from "@/types";

export function GoalsList() {
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [completedGoals, setCompletedGoals] = useState<Goal[]>([]);
  const [abandonedGoals, setAbandonedGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      const data = await getAllGoals();
      setActiveGoals(data.active);
      setCompletedGoals(data.completed.slice(0, 10));
      setAbandonedGoals(data.abandoned.slice(0, 10));
    } catch {
      // User may not be authenticated yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  function handleGoalCreated() {
    setDialogOpen(false);
    loadGoals();
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const hasNoGoals =
    activeGoals.length === 0 &&
    completedGoals.length === 0 &&
    abandonedGoals.length === 0;

  return (
    <div className="space-y-6">
      {/* Header with New Goal button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Goals</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Goal</DialogTitle>
              <DialogDescription>
                Set a goal to track your progress and stay motivated.
              </DialogDescription>
            </DialogHeader>
            <GoalForm
              onGoalCreated={handleGoalCreated}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {hasNoGoals && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
            <Target className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Set your first goal</p>
          <p className="text-xs text-muted-foreground mt-1">
            Track your progress towards strength, body comp, and more.
          </p>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Active</h3>
          {activeGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onUpdated={loadGoals} />
          ))}
        </div>
      )}

      {/* Completed goals (collapsible) */}
      {completedGoals.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCompleted ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
            Completed ({completedGoals.length})
          </button>
          {showCompleted && (
            <div className="space-y-3">
              {completedGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onUpdated={loadGoals} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { GoalsList } from "@/components/goals/goals-list";

export default function GoalsPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Goals</h1>
        <p className="text-sm text-muted-foreground">
          Set targets and track your progress over time.
        </p>
      </div>

      <GoalsList />
    </div>
  );
}

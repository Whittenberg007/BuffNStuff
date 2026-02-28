"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Play, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMealPlans, deleteMealPlan, applyPlanToDay, getMealPlanItems } from "@/lib/database/meal-plans";
import type { MealPlan, MealPlanItem } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";

interface PlanWithTotals extends MealPlan {
  items: MealPlanItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
}

export default function MealPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const allPlans = await getMealPlans();
      const plansWithTotals: PlanWithTotals[] = await Promise.all(
        allPlans.map(async (plan) => {
          const items = await getMealPlanItems(plan.id);
          return {
            ...plan,
            items,
            totalCalories: items.reduce((sum, i) => sum + i.calories, 0),
            totalProtein: items.reduce((sum, i) => sum + i.protein_g, 0),
            totalCarbs: items.reduce((sum, i) => sum + i.carbs_g, 0),
            totalFats: items.reduce((sum, i) => sum + i.fats_g, 0),
          };
        })
      );
      setPlans(plansWithTotals);
    } catch {
      toast.error("Failed to load meal plans");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApply(planId: string) {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      await applyPlanToDay(planId, today);
      toast.success("Plan applied to today!");
    } catch {
      toast.error("Failed to apply plan");
    }
  }

  async function handleDelete(planId: string) {
    try {
      await deleteMealPlan(planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      toast.success("Plan deleted");
    } catch {
      toast.error("Failed to delete plan");
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">Meal Plans</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meal Plans</h1>
        <Button onClick={() => router.push("/nutrition/plans/new")} size="sm">
          <Plus className="size-4 mr-1" />
          New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="py-8">
          <CardContent className="text-center">
            <UtensilsCrossed className="mx-auto size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No meal plans yet. Create your first plan!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="py-4">
              <CardContent className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {plan.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground tabular-nums">
                      <span>{plan.totalCalories} cal</span>
                      <span>{plan.totalProtein}g P</span>
                      <span>{plan.totalCarbs}g C</span>
                      <span>{plan.totalFats}g F</span>
                      <span>{plan.items.length} items</span>
                    </div>
                    {plan.eating_window_start && plan.eating_window_end && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Window: {plan.eating_window_start} – {plan.eating_window_end}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => handleApply(plan.id)}
                      title="Apply to today"
                    >
                      <Play className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => handleDelete(plan.id)}
                      title="Delete plan"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

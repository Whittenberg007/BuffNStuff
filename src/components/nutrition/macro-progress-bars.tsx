"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface MacroProgressBarsProps {
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  };
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

function getBarColor(percentage: number): string {
  if (percentage > 100) return "bg-red-500";
  if (percentage >= 80) return "bg-yellow-500";
  return "bg-emerald-500";
}

function MacroBar({
  label,
  current,
  target,
  unit,
  emphasized = false,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  emphasized?: boolean;
}) {
  const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
  const clampedPercentage = Math.min(percentage, 100);
  const barColor = getBarColor(percentage);

  return (
    <div className={cn("space-y-1.5", emphasized && "space-y-2")}>
      <div className="flex items-center justify-between text-sm">
        <span
          className={cn(
            "text-muted-foreground",
            emphasized && "text-foreground font-semibold"
          )}
        >
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          <span className="text-foreground font-medium">
            {Math.round(current)}
          </span>
          {" / "}
          {target}
          {unit} ({percentage}%)
        </span>
      </div>
      <Progress
        value={clampedPercentage}
        className={cn(
          "[&>[data-slot=progress-indicator]]:transition-all",
          emphasized ? "h-3" : "h-2",
          `[&>[data-slot=progress-indicator]]:${barColor}`
        )}
        style={
          {
            "--bar-color": barColor,
          } as React.CSSProperties
        }
      />
      {/* Inline style override for the indicator color */}
      <style>{`
        [data-slot="progress"] { position: relative; }
      `}</style>
    </div>
  );
}

export function MacroProgressBars({ totals, targets }: MacroProgressBarsProps) {
  const macros = [
    {
      label: "Calories",
      current: totals.calories,
      target: targets.calories,
      unit: " kcal",
      emphasized: false,
    },
    {
      label: "Protein",
      current: totals.protein_g,
      target: targets.protein,
      unit: "g",
      emphasized: true,
    },
    {
      label: "Carbs",
      current: totals.carbs_g,
      target: targets.carbs,
      unit: "g",
      emphasized: false,
    },
    {
      label: "Fats",
      current: totals.fats_g,
      target: targets.fats,
      unit: "g",
      emphasized: false,
    },
  ];

  return (
    <div className="space-y-3">
      {macros.map((macro) => {
        const percentage =
          macro.target > 0
            ? Math.round((macro.current / macro.target) * 100)
            : 0;
        const clampedPercentage = Math.min(percentage, 100);
        const colorClass =
          percentage > 100
            ? "[&>[data-slot=progress-indicator]]:bg-red-500"
            : percentage >= 80
              ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
              : "[&>[data-slot=progress-indicator]]:bg-emerald-500";

        return (
          <div
            key={macro.label}
            className={cn("space-y-1.5", macro.emphasized && "space-y-2")}
          >
            <div className="flex items-center justify-between text-sm">
              <span
                className={cn(
                  "text-muted-foreground",
                  macro.emphasized && "text-foreground font-semibold"
                )}
              >
                {macro.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                <span className="text-foreground font-medium">
                  {Math.round(macro.current)}
                </span>
                {" / "}
                {macro.target}
                {macro.unit} ({percentage}%)
              </span>
            </div>
            <Progress
              value={clampedPercentage}
              className={cn(
                macro.emphasized ? "h-3" : "h-2",
                colorClass
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

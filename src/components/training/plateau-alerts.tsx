"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { detectPlateaus } from "@/lib/training/plateau-detector";
import type { PlateauResult } from "@/lib/training/plateau-detector";

export function PlateauAlerts() {
  const [plateaus, setPlateaus] = useState<PlateauResult[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await detectPlateaus();
        setPlateaus(data);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function handleDismiss(exerciseId: string) {
    setDismissed((prev) => new Set(prev).add(exerciseId));
  }

  const visiblePlateaus = plateaus.filter(
    (p) => !dismissed.has(p.exerciseId)
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-yellow-500" />
            Plateau Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-yellow-500" />
          Plateau Detection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visiblePlateaus.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No plateaus detected. Keep pushing!
          </p>
        ) : (
          <div className="space-y-4">
            {visiblePlateaus.map((plateau) => {
              const isRegression = plateau.plateauType === "regression";
              const borderColor = isRegression
                ? "border-red-500/50"
                : "border-yellow-500/50";
              const icon = isRegression ? (
                <TrendingDown className="size-4 text-red-400" />
              ) : (
                <AlertTriangle className="size-4 text-yellow-400" />
              );
              const typeLabel = isRegression ? "Regression" : "Plateau";

              return (
                <div
                  key={plateau.exerciseId}
                  className={`rounded-lg border-2 ${borderColor} p-4 space-y-3`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {icon}
                      <div>
                        <p className="font-medium text-sm">
                          {plateau.exerciseName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabel} -- {plateau.sessionCount} sessions at{" "}
                          {plateau.lastWeight} lbs x {plateau.lastReps} reps
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDismiss(plateau.exerciseId)}
                      aria-label="Dismiss alert"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>

                  {/* Interventions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Suggested interventions
                    </p>
                    <ul className="space-y-1.5">
                      {plateau.interventions.map((intervention, i) => (
                        <li
                          key={`${plateau.exerciseId}-${intervention.type}-${i}`}
                          className="text-xs text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">
                            {intervention.title}:
                          </span>{" "}
                          {intervention.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

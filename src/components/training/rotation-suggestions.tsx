"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ArrowRight, Check, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getSwapSuggestions,
  getFreshnessStatus,
} from "@/lib/training/rotation-engine";
import { acceptSwap, dismissSwap } from "@/lib/database/rotation";
import type { Exercise, ExerciseRotationState } from "@/types";

interface SwapSuggestion {
  rotation: ExerciseRotationState;
  currentExercise: Exercise | null;
  suggestedReplacement: Exercise | null;
  freshness: number;
  reason: string;
}

export function RotationSuggestions() {
  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSwapSuggestions();
        setSuggestions(data);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleAccept(rotationId: string) {
    setProcessingId(rotationId);
    try {
      await acceptSwap(rotationId);
      setSuggestions((prev) =>
        prev.filter((s) => s.rotation.id !== rotationId)
      );
    } catch {
      // Silently handle
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDismiss(rotationId: string) {
    setProcessingId(rotationId);
    try {
      await dismissSwap(rotationId);
      setSuggestions((prev) =>
        prev.filter((s) => s.rotation.id !== rotationId)
      );
    } catch {
      // Silently handle
    } finally {
      setProcessingId(null);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="size-4 text-blue-400" />
            Exercise Rotation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
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
          <RefreshCw className="size-4 text-blue-400" />
          Exercise Rotation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All exercises are fresh! No rotations needed.
          </p>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion) => {
              const status = getFreshnessStatus(suggestion.freshness);
              const isProcessing =
                processingId === suggestion.rotation.id;

              return (
                <div
                  key={suggestion.rotation.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  {/* Freshness indicator bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Freshness</span>
                      <span className="text-muted-foreground">
                        {status.label} ({(suggestion.freshness * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${status.color}`}
                        style={{
                          width: `${Math.max(suggestion.freshness * 100, 2)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Swap suggestion */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate">
                      {suggestion.currentExercise?.name || "Unknown exercise"}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-blue-400 truncate">
                      {suggestion.suggestedReplacement?.name ||
                        "No replacement found"}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-muted-foreground">
                    {suggestion.reason}
                  </p>

                  {/* Actions */}
                  {suggestion.suggestedReplacement && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isProcessing}
                        onClick={() =>
                          handleAccept(suggestion.rotation.id)
                        }
                      >
                        <Check className="size-3" />
                        Swap
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() =>
                          handleDismiss(suggestion.rotation.id)
                        }
                      >
                        <X className="size-3" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

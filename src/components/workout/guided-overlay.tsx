"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSuggestion,
  type OverloadSuggestion,
} from "@/lib/training/progressive-overload";
import type { TrainingStyle, WorkoutSet } from "@/types";

interface GuidedOverlayProps {
  exerciseId: string;
  trainingStyle?: TrainingStyle;
  /** The most recently logged set (for feedback) */
  lastLoggedSet?: WorkoutSet | null;
}

export function GuidedOverlay({
  exerciseId,
  trainingStyle = "hypertrophy",
  lastLoggedSet,
}: GuidedOverlayProps) {
  const [suggestion, setSuggestion] = useState<OverloadSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getSuggestion(exerciseId, trainingStyle)
      .then((data) => {
        if (!cancelled) setSuggestion(data);
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exerciseId, trainingStyle]);

  if (loading) {
    return (
      <div className="h-[56px] flex items-center px-3 rounded-lg bg-muted/40 animate-pulse">
        <span className="text-xs text-muted-foreground">
          Loading suggestion...
        </span>
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="h-[56px] flex items-center px-3 rounded-lg bg-muted/30 border border-dashed">
        <span className="text-xs text-muted-foreground">
          No previous data -- log your first set to enable guided mode
        </span>
      </div>
    );
  }

  // Determine feedback if a set was just logged
  let feedback: {
    icon: React.ReactNode;
    color: string;
    text: string;
  } | null = null;

  if (lastLoggedSet) {
    const loggedVolume = lastLoggedSet.weight * lastLoggedSet.reps;
    const suggestedVolume = suggestion.suggestedWeight * suggestion.suggestedReps;
    const lastVolume = suggestion.lastWeight * suggestion.lastReps;

    if (loggedVolume > lastVolume) {
      feedback = {
        icon: <Check className="size-3" />,
        color: "text-green-500 bg-green-500/10",
        text: "Beat previous!",
      };
    } else if (loggedVolume === lastVolume) {
      feedback = {
        icon: <Minus className="size-3" />,
        color: "text-yellow-500 bg-yellow-500/10",
        text: "Matched previous",
      };
    } else {
      feedback = {
        icon: <ArrowDown className="size-3" />,
        color: "text-red-500 bg-red-500/10",
        text: "Below previous",
      };
    }
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-muted/30 border max-h-[60px] overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        {/* Last session info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <span className="shrink-0">
            Last: {suggestion.lastWeight} lbs x {suggestion.lastReps} reps (
            {suggestion.lastSets} sets)
          </span>
        </div>

        {/* Suggestion */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary shrink-0">
          <ArrowUp className="size-3" />
          <span>
            Try: {suggestion.suggestedWeight} lbs x {suggestion.suggestedReps}{" "}
            reps
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Message */}
        <p className="text-[11px] text-muted-foreground truncate">
          {suggestion.message}
        </p>

        {/* Post-set feedback badge */}
        {feedback && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
              feedback.color
            )}
          >
            {feedback.icon}
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}

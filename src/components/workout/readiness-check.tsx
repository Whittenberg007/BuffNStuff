"use client";

import { useState } from "react";
import { Moon, Activity, Zap, SkipForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveReadinessCheckin } from "@/lib/database/recovery";

interface ReadinessCheckProps {
  sessionId: string;
  onComplete: (moodEnergy: number | null) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Average",
  4: "Good",
  5: "Great",
};

interface RatingRowProps {
  label: string;
  icon: React.ElementType;
  value: number | null;
  onChange: (val: number) => void;
  lowLabel: string;
  highLabel: string;
}

function RatingRow({ label, icon: Icon, value, onChange, lowLabel, highLabel }: RatingRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-medium">{label}</span>
        {value && (
          <span className="ml-auto text-xs text-muted-foreground">
            {RATING_LABELS[value]}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 rounded-lg py-3 text-lg font-bold transition-all",
              value === n
                ? "bg-primary text-primary-foreground scale-105"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function ReadinessCheck({ sessionId, onComplete }: ReadinessCheckProps) {
  const [sleep, setSleep] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    setIsSaving(true);
    try {
      await saveReadinessCheckin({
        sessionId,
        sleepQuality: sleep,
        soreness,
        energy,
      });

      const values = [sleep, soreness, energy].filter((v): v is number => v !== null);
      const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
      onComplete(avg);
    } catch {
      onComplete(null);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkip() {
    onComplete(null);
  }

  const hasAnyRating = sleep !== null || soreness !== null || energy !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold">How are you feeling?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quick check-in before your workout
          </p>
        </div>

        <div className="space-y-5">
          <RatingRow
            label="Sleep Quality"
            icon={Moon}
            value={sleep}
            onChange={setSleep}
            lowLabel="Terrible"
            highLabel="Amazing"
          />

          <RatingRow
            label="Soreness"
            icon={Activity}
            value={soreness}
            onChange={setSoreness}
            lowLabel="Very sore"
            highLabel="Fresh"
          />

          <RatingRow
            label="Energy Level"
            icon={Zap}
            value={energy}
            onChange={setEnergy}
            lowLabel="Exhausted"
            highLabel="Energized"
          />
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !hasAnyRating}
            className="w-full h-12 text-base font-semibold"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Start Workout"
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            className="w-full text-muted-foreground"
          >
            <SkipForward className="size-4 mr-1.5" />
            Skip Check-In
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logWeight } from "@/lib/database/weight";
import type { WeightEntry } from "@/types";

interface WeightTrackerProps {
  history: WeightEntry[];
  onWeightLogged: () => void;
}

export function WeightTracker({ history, onWeightLogged }: WeightTrackerProps) {
  const [weight, setWeight] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayEntry = history.find((e) => e.date === today);
  const latestEntry = history.length > 0 ? history[history.length - 1] : null;

  // Calculate changes
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoStr = format(oneWeekAgo, "yyyy-MM-dd");

  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const oneMonthAgoStr = format(oneMonthAgo, "yyyy-MM-dd");

  // Find closest entry to 1 week ago
  const weekAgoEntry = history
    .filter((e) => e.date <= oneWeekAgoStr)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  // Find closest entry to 1 month ago
  const monthAgoEntry = history
    .filter((e) => e.date <= oneMonthAgoStr)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const weekChange =
    latestEntry && weekAgoEntry
      ? Math.round((latestEntry.weight - weekAgoEntry.weight) * 10) / 10
      : null;

  const monthChange =
    latestEntry && monthAgoEntry
      ? Math.round((latestEntry.weight - monthAgoEntry.weight) * 10) / 10
      : null;

  async function handleLogWeight() {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) return;

    setIsSubmitting(true);
    try {
      await logWeight(today, w);
      setWeight("");
      onWeightLogged();
    } catch {
      // Handle error silently
    } finally {
      setIsSubmitting(false);
    }
  }

  function TrendIcon({ change }: { change: number }) {
    if (change > 0) return <TrendingUp className="size-3.5 text-red-400" />;
    if (change < 0) return <TrendingDown className="size-3.5 text-emerald-400" />;
    return <Minus className="size-3.5 text-muted-foreground" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="size-4" />
          Weight
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick entry */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={todayEntry ? `${todayEntry.weight}` : "Weight"}
            min={0}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogWeight();
            }}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">lbs</span>
          <Button
            onClick={handleLogWeight}
            disabled={isSubmitting || !weight}
            size="sm"
          >
            {todayEntry ? "Update" : "Log Today"}
          </Button>
        </div>

        {/* Current weight and changes */}
        {latestEntry && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-lg font-bold tabular-nums">
                {latestEntry.weight}
              </p>
              <p className="text-xs text-muted-foreground">lbs</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This Week</p>
              {weekChange !== null ? (
                <div className="flex items-center justify-center gap-1">
                  <TrendIcon change={weekChange} />
                  <p className="text-lg font-bold tabular-nums">
                    {weekChange > 0 ? "+" : ""}
                    {weekChange}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">--</p>
              )}
              <p className="text-xs text-muted-foreground">lbs</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This Month</p>
              {monthChange !== null ? (
                <div className="flex items-center justify-center gap-1">
                  <TrendIcon change={monthChange} />
                  <p className="text-lg font-bold tabular-nums">
                    {monthChange > 0 ? "+" : ""}
                    {monthChange}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">--</p>
              )}
              <p className="text-xs text-muted-foreground">lbs</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

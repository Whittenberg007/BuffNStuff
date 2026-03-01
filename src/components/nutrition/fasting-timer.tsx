"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFastingSettings, getFastingLog, upsertFastingLog } from "@/lib/database/fasting";
import type { FastingSettings, FastingLog } from "@/types";
import { toast } from "sonner";

type FastingState = "fasting" | "eating" | "window_closed";

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function FastingTimer() {
  const [settings, setSettings] = useState<FastingSettings | null>(null);
  const [log, setLog] = useState<FastingLog | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        getFastingSettings(),
        getFastingLog(getToday()),
      ]);
      setSettings(s);
      setLog(l);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tick every minute for live updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card className="py-6">
        <CardContent className="px-4">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card className="py-6">
        <CardContent className="px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Set up fasting in Settings to start tracking
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine fasting state
  const windowStart = settings.eating_window_start; // e.g. "12:00"
  const windowEnd = settings.eating_window_end; // e.g. "20:00"
  const nowDate = new Date(now);
  const currentTime = `${nowDate.getHours().toString().padStart(2, "0")}:${nowDate.getMinutes().toString().padStart(2, "0")}`;

  let state: FastingState;
  let progressPercent: number;
  let statusText: string;
  let timeText: string;

  const isInWindow = currentTime >= windowStart && currentTime < windowEnd;
  const hasStartedEating = log?.eating_start != null;
  const hasStoppedEating = log?.eating_end != null;

  if (hasStoppedEating) {
    // Done eating for the day — fasting
    const endTime = new Date(log!.eating_end!).getTime();
    const elapsed = now - endTime;
    const targetMs = settings.target_fast_hours * 3600000;
    progressPercent = Math.min((elapsed / targetMs) * 100, 100);
    state = "fasting";
    statusText = "Fasting";
    timeText = formatDuration(elapsed);
  } else if (hasStartedEating && isInWindow) {
    // Currently eating
    const [endH, endM] = windowEnd.split(":").map(Number);
    const windowEndDate = new Date(nowDate);
    windowEndDate.setHours(endH, endM, 0, 0);
    const remaining = windowEndDate.getTime() - now;
    const [startH, startM] = windowStart.split(":").map(Number);
    const windowStartDate = new Date(nowDate);
    windowStartDate.setHours(startH, startM, 0, 0);
    const totalWindow = windowEndDate.getTime() - windowStartDate.getTime();
    progressPercent = Math.min(((totalWindow - remaining) / totalWindow) * 100, 100);
    state = "eating";
    statusText = "Eating Window";
    timeText = `${formatDuration(Math.max(remaining, 0))} remaining`;
  } else if (hasStartedEating && !isInWindow) {
    // Eating window closed
    state = "window_closed";
    const [endH, endM] = windowEnd.split(":").map(Number);
    const windowEndDate = new Date(nowDate);
    windowEndDate.setHours(endH, endM, 0, 0);
    const overtime = now - windowEndDate.getTime();
    progressPercent = 100;
    statusText = "Window Closed";
    timeText = `${formatDuration(Math.max(overtime, 0))} ago`;
  } else {
    // Haven't started eating yet — fasting from midnight or last end
    const todayStart = new Date(nowDate);
    todayStart.setHours(0, 0, 0, 0);
    const elapsed = now - todayStart.getTime();
    const targetMs = settings.target_fast_hours * 3600000;
    progressPercent = Math.min((elapsed / targetMs) * 100, 100);
    state = "fasting";
    statusText = "Fasting";
    timeText = formatDuration(elapsed);
  }

  const ringColor =
    state === "fasting" ? "text-green-500" : state === "eating" ? "text-amber-500" : "text-red-500";

  async function handleStartEating() {
    try {
      const updated = await upsertFastingLog({
        date: getToday(),
        eating_start: new Date().toISOString(),
        target_fast_hours: settings!.target_fast_hours,
      });
      setLog(updated);
      toast.success("Started eating window");
    } catch {
      toast.error("Failed to start eating");
    }
  }

  async function handleStopEating() {
    if (!log?.eating_start) return;
    try {
      const start = new Date(log.eating_start).getTime();
      const end = Date.now();
      // Calculate fasting hours: 24 - eating duration in hours
      const eatingHours = (end - start) / 3600000;
      const achievedFastHours = Math.round((24 - eatingHours) * 10) / 10;
      const hitTarget = achievedFastHours >= settings!.target_fast_hours;

      const updated = await upsertFastingLog({
        date: getToday(),
        eating_start: log.eating_start,
        eating_end: new Date().toISOString(),
        target_fast_hours: settings!.target_fast_hours,
        achieved_fast_hours: achievedFastHours,
        hit_target: hitTarget,
      });
      setLog(updated);
      toast.success(
        hitTarget
          ? `Fasting complete! ${achievedFastHours}h — target hit!`
          : `Eating window closed. ${achievedFastHours}h fasting today.`
      );
    } catch {
      toast.error("Failed to stop eating");
    }
  }

  // SVG ring setup
  const size = 140;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  return (
    <Card className="py-6">
      <CardContent className="px-4">
        <div className="flex flex-col items-center gap-4">
          {/* Circular progress ring */}
          <div className="relative">
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/30"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={`transition-all duration-1000 ${ringColor}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-bold tabular-nums">{timeText}</p>
              <p className="text-xs text-muted-foreground">{statusText}</p>
            </div>
          </div>

          {/* Protocol badge + controls */}
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {settings.protocol}
            </span>
            {!hasStartedEating ? (
              <Button size="sm" onClick={handleStartEating}>
                Start Eating
              </Button>
            ) : !hasStoppedEating ? (
              <Button size="sm" variant="destructive" onClick={handleStopEating}>
                Stop Eating
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Done for today</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

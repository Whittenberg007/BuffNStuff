"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { hapticNotification } from "@/lib/capacitor/haptics";

type TimerMode = "emom" | "amrap";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface WorkoutTimerProps {
  open: boolean;
  onClose: () => void;
}

export function WorkoutTimer({ open, onClose }: WorkoutTimerProps) {
  const [mode, setMode] = useState<TimerMode>("emom");
  const [isConfiguring, setIsConfiguring] = useState(true);

  // EMOM config
  const [emomInterval, setEmomInterval] = useState(60);
  const [emomRounds, setEmomRounds] = useState(10);

  // AMRAP config
  const [amrapDuration, setAmrapDuration] = useState(600);

  // Running state
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(0);
  const [roundCount, setRoundCount] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetEndRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    if (mode === "emom") {
      setRemaining(emomInterval);
      setCurrentRound(1);
      setTotalRounds(emomRounds);
    } else {
      setRemaining(amrapDuration);
      setRoundCount(0);
    }

    targetEndRef.current =
      Date.now() +
      (mode === "emom" ? emomInterval : amrapDuration) * 1000;

    setIsRunning(true);
    setIsConfiguring(false);
  }, [mode, emomInterval, emomRounds, amrapDuration]);

  // Countdown logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeLeft = Math.max(
        0,
        Math.ceil((targetEndRef.current - now) / 1000)
      );
      setRemaining(timeLeft);

      if (timeLeft <= 0) {
        hapticNotification("warning");

        if (mode === "emom") {
          setCurrentRound((prev) => {
            const next = prev + 1;
            if (next > totalRounds) {
              setIsRunning(false);
              hapticNotification("success");
              return prev;
            }
            targetEndRef.current = Date.now() + emomInterval * 1000;
            return next;
          });
        } else {
          setIsRunning(false);
          hapticNotification("success");
        }
      }
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, emomInterval, totalRounds]);

  const handleToggle = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      targetEndRef.current = Date.now() + remaining * 1000;
      setIsRunning(true);
    }
  }, [isRunning, remaining]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsConfiguring(true);
    setRoundCount(0);
    setCurrentRound(1);
  }, []);

  const handleDismiss = useCallback(() => {
    setIsRunning(false);
    setIsConfiguring(true);
    setRoundCount(0);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const totalDuration = mode === "emom" ? emomInterval : amrapDuration;
  const progress = totalDuration > 0 ? remaining / totalDuration : 0;
  const strokeDashoffset = circumference * (1 - progress);

  // Configuration screen
  if (isConfiguring) {
    return (
      <div className="fixed bottom-20 right-4 z-50 w-72 rounded-2xl bg-card border shadow-xl p-4 md:bottom-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workout Timer
          </span>
          <Button variant="ghost" size="icon-xs" onClick={handleDismiss}>
            <X className="size-3" />
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          {(["emom", "amrap"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {mode === "emom" ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Interval (seconds)</Label>
              <Input
                type="number"
                value={emomInterval}
                onChange={(e) =>
                  setEmomInterval(Math.max(10, parseInt(e.target.value) || 60))
                }
                min={10}
                max={300}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Total Rounds</Label>
              <Input
                type="number"
                value={emomRounds}
                onChange={(e) =>
                  setEmomRounds(Math.max(1, parseInt(e.target.value) || 10))
                }
                min={1}
                max={60}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatTime(emomInterval * emomRounds)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={Math.round(amrapDuration / 60)}
                onChange={(e) =>
                  setAmrapDuration(
                    Math.max(60, (parseInt(e.target.value) || 10) * 60)
                  )
                }
                min={1}
                max={60}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <Button onClick={handleStart} className="w-full mt-4">
          <Play className="size-4" /> Start {mode.toUpperCase()}
        </Button>
      </div>
    );
  }

  // Minimized pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-card border shadow-lg px-4 py-2 md:bottom-6">
        <span className="text-[10px] font-medium uppercase text-muted-foreground">
          {mode.toUpperCase()}
        </span>
        <span
          className={cn(
            "text-sm font-mono font-bold",
            remaining <= 10 && remaining > 0 && "text-destructive animate-pulse"
          )}
        >
          {formatTime(remaining)}
        </span>
        {mode === "emom" && (
          <span className="text-xs text-muted-foreground">
            R{currentRound}/{totalRounds}
          </span>
        )}
        {mode === "amrap" && (
          <span className="text-xs text-muted-foreground">
            ×{roundCount}
          </span>
        )}
        <Button variant="ghost" size="icon-xs" onClick={handleToggle}>
          {isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setIsMinimized(false)}>
          <ChevronUp className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={handleDismiss}>
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  // Full timer
  return (
    <div className="fixed bottom-20 right-4 z-50 w-64 rounded-2xl bg-card border shadow-xl p-4 md:bottom-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {mode.toUpperCase()}
          {mode === "emom" && ` — Round ${currentRound}/${totalRounds}`}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => setIsMinimized(true)}>
            <ChevronDown className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={handleDismiss}>
            <X className="size-3" />
          </Button>
        </div>
      </div>

      <div className="flex justify-center mb-3">
        <div className="relative flex items-center justify-center">
          <svg width="112" height="112" className="-rotate-90">
            <circle
              cx="56" cy="56" r={radius}
              fill="none" stroke="currentColor" strokeWidth="6"
              className="text-muted/30"
            />
            <circle
              cx="56" cy="56" r={radius}
              fill="none" stroke="currentColor" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn(
                "transition-all duration-300 ease-linear",
                remaining <= 10 && remaining > 0
                  ? "text-destructive"
                  : mode === "emom"
                    ? "text-primary"
                    : "text-orange-500"
              )}
            />
          </svg>
          <span
            className={cn(
              "absolute text-2xl font-mono font-bold",
              remaining <= 10 && remaining > 0 && "text-destructive"
            )}
          >
            {formatTime(remaining)}
          </span>
        </div>
      </div>

      {mode === "amrap" && (
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="text-sm text-muted-foreground">Rounds:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRoundCount((prev) => prev + 1)}
            className="gap-1"
          >
            <Plus className="size-3" /> {roundCount}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={handleReset}>
          <RotateCcw className="size-4" />
        </Button>
        <Button
          variant={isRunning ? "secondary" : "default"}
          size="sm"
          onClick={handleToggle}
          className="min-w-[80px]"
        >
          {isRunning ? (
            <><Pause className="size-4" /> Pause</>
          ) : (
            <><Play className="size-4" /> Resume</>
          )}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Pause, Play, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticNotification } from "@/lib/capacitor/haptics";

const PRESETS = [60, 90, 120, 180, 300] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface RestTimerProps {
  /** Called when timer reaches 0 */
  onComplete?: () => void;
  /** Called when dismissed */
  onDismiss?: () => void;
  /** Trigger value: increment to auto-start the timer */
  trigger?: number;
  /** Default duration in seconds */
  defaultDuration?: number;
}

export function RestTimer({
  onComplete,
  onDismiss,
  trigger = 0,
  defaultDuration = 90,
}: RestTimerProps) {
  const [duration, setDuration] = useState(defaultDuration);
  const [remaining, setRemaining] = useState(defaultDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTrigger = useRef(trigger);

  // Auto-start when trigger increments
  useEffect(() => {
    if (trigger > prevTrigger.current) {
      setRemaining(duration);
      setIsRunning(true);
      setIsVisible(true);
      setIsMinimized(false);
    }
    prevTrigger.current = trigger;
  }, [trigger, duration]);

  // Countdown logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            onComplete?.();
            hapticNotification("warning");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, onComplete]);

  const handlePreset = useCallback((seconds: number) => {
    setDuration(seconds);
    setRemaining(seconds);
    setIsRunning(true);
  }, []);

  const handleToggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setRemaining(duration);
  }, [duration]);

  const handleDismiss = useCallback(() => {
    setIsRunning(false);
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!isVisible) return null;

  // SVG ring progress
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = duration > 0 ? remaining / duration : 0;
  const strokeDashoffset = circumference * (1 - progress);

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-card border shadow-lg px-4 py-2 md:bottom-6">
        <span
          className={cn(
            "text-sm font-mono font-bold",
            remaining <= 10 && remaining > 0 && "text-destructive animate-pulse"
          )}
        >
          {formatTime(remaining)}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleToggle}
        >
          {isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsMinimized(false)}
        >
          <ChevronUp className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleDismiss}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-64 rounded-2xl bg-card border shadow-xl p-4 md:bottom-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Rest Timer
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsMinimized(true)}
          >
            <ChevronDown className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDismiss}
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {/* Circular timer */}
      <div className="flex justify-center mb-3">
        <div className="relative flex items-center justify-center">
          <svg width="112" height="112" className="-rotate-90">
            {/* Background ring */}
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/30"
            />
            {/* Progress ring */}
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn(
                "transition-all duration-1000 ease-linear",
                remaining <= 10 && remaining > 0
                  ? "text-destructive"
                  : "text-primary"
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

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleReset}
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          variant={isRunning ? "secondary" : "default"}
          size="sm"
          onClick={handleToggle}
          className="min-w-[80px]"
        >
          {isRunning ? (
            <>
              <Pause className="size-4" /> Pause
            </>
          ) : (
            <>
              <Play className="size-4" /> Start
            </>
          )}
        </Button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {PRESETS.map((seconds) => (
          <Button
            key={seconds}
            variant={duration === seconds ? "default" : "outline"}
            size="xs"
            onClick={() => handlePreset(seconds)}
            className="text-xs"
          >
            {formatTime(seconds)}
          </Button>
        ))}
      </div>
    </div>
  );
}

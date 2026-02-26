"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSeconds, parseTimestamp } from "@/lib/youtube/utils";
import { Timer, Play, Scissors } from "lucide-react";

interface TimelineSelectorProps {
  duration: number;
  startTime: number;
  endTime: number;
  currentTime: number;
  onStartTimeChange: (seconds: number) => void;
  onEndTimeChange: (seconds: number) => void;
  onSetStartFromPlayback: () => void;
  onSetEndFromPlayback: () => void;
  onPreviewClip: () => void;
}

export function TimelineSelector({
  duration,
  startTime,
  endTime,
  currentTime,
  onStartTimeChange,
  onEndTimeChange,
  onSetStartFromPlayback,
  onSetEndFromPlayback,
  onPreviewClip,
}: TimelineSelectorProps) {
  const clipDuration = Math.max(0, endTime - startTime);
  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleStartInputChange = useCallback(
    (value: string) => {
      const seconds = parseTimestamp(value);
      if (seconds >= 0 && seconds < endTime) {
        onStartTimeChange(seconds);
      }
    },
    [endTime, onStartTimeChange]
  );

  const handleEndInputChange = useCallback(
    (value: string) => {
      const seconds = parseTimestamp(value);
      if (seconds > startTime && seconds <= duration) {
        onEndTimeChange(seconds);
      }
    },
    [startTime, duration, onEndTimeChange]
  );

  const handleStartRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (value < endTime) {
        onStartTimeChange(value);
      }
    },
    [endTime, onStartTimeChange]
  );

  const handleEndRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (value > startTime) {
        onEndTimeChange(value);
      }
    },
    [startTime, onEndTimeChange]
  );

  return (
    <div className="space-y-4">
      {/* Timeline bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>0:00</span>
          <span className="flex items-center gap-1">
            <Timer className="size-3" />
            {formatSeconds(duration)}
          </span>
        </div>

        <div className="relative h-8">
          {/* Background track */}
          <div className="absolute top-3 h-2 w-full rounded-full bg-muted" />

          {/* Selected range highlight */}
          <div
            className="absolute top-3 h-2 rounded-full bg-primary/40"
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
            }}
          />

          {/* Current playback indicator */}
          <div
            className="absolute top-2 h-4 w-0.5 bg-foreground/60 transition-[left] duration-200"
            style={{ left: `${currentPercent}%` }}
          />

          {/* Start range input */}
          <input
            type="range"
            min={0}
            max={Math.floor(duration)}
            value={Math.floor(startTime)}
            onChange={handleStartRangeChange}
            className="absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
            style={{ zIndex: startTime > duration * 0.5 ? 3 : 2 }}
          />

          {/* End range input */}
          <input
            type="range"
            min={0}
            max={Math.floor(duration)}
            value={Math.floor(endTime)}
            onChange={handleEndRangeChange}
            className="absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
            style={{ zIndex: endTime < duration * 0.5 ? 3 : 2 }}
          />
        </div>
      </div>

      {/* Time inputs and buttons */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Start Time</Label>
          <div className="flex gap-2">
            <Input
              value={formatSeconds(startTime)}
              onChange={(e) => handleStartInputChange(e.target.value)}
              placeholder="0:00"
              className="h-8 text-sm font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSetStartFromPlayback}
              title="Set start to current playback position"
            >
              <Scissors className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">End Time</Label>
          <div className="flex gap-2">
            <Input
              value={formatSeconds(endTime)}
              onChange={(e) => handleEndInputChange(e.target.value)}
              placeholder="0:00"
              className="h-8 text-sm font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSetEndFromPlayback}
              title="Set end to current playback position"
            >
              <Scissors className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Clip info and preview */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Clip duration:{" "}
          <span className="font-mono font-medium text-foreground">
            {formatSeconds(clipDuration)}
          </span>
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPreviewClip}
          disabled={clipDuration <= 0}
        >
          <Play className="size-3.5" />
          Preview Clip
        </Button>
      </div>
    </div>
  );
}

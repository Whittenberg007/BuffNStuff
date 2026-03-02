"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bike, Footprints, Loader2, Waves, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logCardioSession, getCardioHistory } from "@/lib/database/cardio";
import { getSettings } from "@/lib/database/settings";
import Link from "next/link";
import { format } from "date-fns";
import type { CardioSession, CardioActivityType } from "@/types";

const ACTIVITY_OPTIONS: {
  value: CardioActivityType;
  label: string;
  icon: typeof Footprints;
}[] = [
  { value: "run", label: "Run", icon: Footprints },
  { value: "bike", label: "Bike", icon: Bike },
  { value: "row", label: "Row", icon: Waves },
  { value: "swim", label: "Swim", icon: Waves },
  { value: "walk", label: "Walk", icon: Wind },
];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
  return `${s}s`;
}

function formatPace(paceSeconds: number, unit: string): string {
  const m = Math.floor(paceSeconds / 60);
  const s = paceSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")} /${unit}`;
}

export default function CardioPage() {
  const [activityType, setActivityType] = useState<CardioActivityType>("run");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [history, setHistory] = useState<CardioSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState("mi");

  useEffect(() => {
    getSettings()
      .then((s) => setDistanceUnit(s.unit_preference === "kg" ? "km" : "mi"))
      .catch(() => {});

    getCardioHistory(30)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  const totalSeconds =
    (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
  const distanceNum = parseFloat(distance) || 0;
  const computedPace =
    distanceNum > 0 && totalSeconds > 0
      ? Math.round(totalSeconds / distanceNum)
      : null;

  const handleLog = useCallback(async () => {
    if (totalSeconds <= 0) return;
    setIsLogging(true);
    try {
      const session = await logCardioSession({
        activity_type: activityType,
        duration_seconds: totalSeconds,
        distance: distanceNum > 0 ? distanceNum : undefined,
        notes: notes.trim() || undefined,
      });
      setHistory((prev) => [session, ...prev]);
      toast.success("Cardio session logged!", {
        description: `${formatDuration(totalSeconds)}${distanceNum > 0 ? ` — ${distanceNum} ${distanceUnit}` : ""}`,
      });
      setMinutes("");
      setSeconds("");
      setDistance("");
      setNotes("");
    } catch (err) {
      console.error("Failed to log cardio:", err);
      toast.error("Failed to log cardio session");
    } finally {
      setIsLogging(false);
    }
  }, [activityType, totalSeconds, distanceNum, distanceUnit, notes]);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/workout">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Log Cardio</h1>
          <p className="text-sm text-muted-foreground">
            Track your cardio sessions
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Activity Type */}
          <div className="space-y-2">
            <Label>Activity</Label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActivityType(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      activityType === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="size-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="h-12 text-xl font-bold text-center"
                  min={0}
                />
                <span className="block text-xs text-muted-foreground text-center mt-1">
                  min
                </span>
              </div>
              <span className="text-xl font-bold text-muted-foreground">:</span>
              <div className="flex-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="00"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  className="h-12 text-xl font-bold text-center"
                  min={0}
                  max={59}
                />
                <span className="block text-xs text-muted-foreground text-center mt-1">
                  sec
                </span>
              </div>
            </div>
          </div>

          {/* Distance (optional) */}
          <div className="space-y-2">
            <Label>Distance ({distanceUnit}) — optional</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="h-12 text-xl font-bold text-center"
              min={0}
              step={0.1}
            />
          </div>

          {/* Computed pace */}
          {computedPace && (
            <div className="text-sm text-muted-foreground text-center">
              Pace: {formatPace(computedPace, distanceUnit)}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="How did it feel?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Log Button */}
          <Button
            onClick={handleLog}
            disabled={isLogging || totalSeconds <= 0}
            className="w-full h-12 text-base font-semibold"
          >
            {isLogging ? "Logging..." : "Log Cardio Session"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Recent Sessions
        </h2>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No cardio sessions yet. Log your first one above!
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {s.activity_type}
                    </Badge>
                    <div>
                      <div className="text-sm font-medium">
                        {formatDuration(s.duration_seconds)}
                        {s.distance ? ` — ${s.distance} ${distanceUnit}` : ""}
                      </div>
                      {s.avg_pace && (
                        <div className="text-xs text-muted-foreground">
                          Pace: {formatPace(s.avg_pace, distanceUnit)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(s.completed_at), "MMM d")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

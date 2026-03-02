"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCardioHistory, getCardioStats } from "@/lib/database/cardio";
import { getSettings } from "@/lib/database/settings";
import type { CardioSession, CardioActivityType } from "@/types";
import { format } from "date-fns";

const ACTIVITY_LABELS: Record<string, string> = {
  all: "All Activities",
  run: "Running",
  bike: "Cycling",
  row: "Rowing",
  swim: "Swimming",
  walk: "Walking",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatPace(paceSeconds: number, unit: string): string {
  const m = Math.floor(paceSeconds / 60);
  const s = paceSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")} /${unit}`;
}

export function CardioProgress() {
  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [filter, setFilter] = useState<"all" | CardioActivityType>("all");
  const [stats, setStats] = useState<{
    totalSessions: number;
    totalDurationSeconds: number;
    totalDistance: number;
    avgPace: number | null;
  } | null>(null);
  const [distanceUnit, setDistanceUnit] = useState("mi");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCardioHistory(90), getCardioStats(90), getSettings()])
      .then(([history, statsData, settings]) => {
        if (cancelled) return;
        setSessions(history);
        setStats(statsData);
        setDistanceUnit(settings.unit_preference === "kg" ? "km" : "mi");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered =
    filter === "all"
      ? sessions
      : sessions.filter((s) => s.activity_type === filter);

  const chartData = filtered.reduce<
    Array<{ date: string; duration: number; distance: number }>
  >((acc, s) => {
    const dateKey = format(new Date(s.completed_at), "yyyy-MM-dd");
    const existing = acc.find((d) => d.date === dateKey);
    if (existing) {
      existing.duration += Math.round(s.duration_seconds / 60);
      existing.distance += s.distance || 0;
    } else {
      acc.push({
        date: dateKey,
        duration: Math.round(s.duration_seconds / 60),
        distance: s.distance || 0,
      });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">{stats.totalSessions}</div>
              <div className="text-xs text-muted-foreground">Sessions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">
                {formatDuration(stats.totalDurationSeconds)}
              </div>
              <div className="text-xs text-muted-foreground">Total Time</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">
                {stats.totalDistance > 0
                  ? `${stats.totalDistance.toFixed(1)}`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Total {distanceUnit}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">
                {stats.avgPace ? formatPace(stats.avgPace, distanceUnit) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Avg Pace</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Activity Over Time</CardTitle>
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No cardio data for this period.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(240 3.7% 25%)"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                    stroke="hsl(240 5% 55%)"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="hsl(240 5% 55%)"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(d) =>
                      format(new Date(d as string), "MMM d, yyyy")
                    }
                    formatter={(value, name) => [
                      name === "duration"
                        ? `${value} min`
                        : `${value} ${distanceUnit}`,
                      name === "duration" ? "Duration" : "Distance",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="duration"
                    stroke="hsl(217 91% 60%)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(217 91% 60%)" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

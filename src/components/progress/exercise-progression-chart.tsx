"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
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
import { getExercises } from "@/lib/database/exercises";
import { getExerciseProgression } from "@/lib/database/analytics";
import type { Exercise } from "@/types";

interface DataPoint {
  date: string;
  weight: number;
  reps: number;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function formatDateLabel(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T00:00:00"), "MMM d");
  } catch {
    return dateStr;
  }
}

function ProgressionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">
        {label ? formatDateLabel(label) : ""}
      </p>
      {payload.map((entry: TooltipPayloadItem) => (
        <p
          key={entry.name}
          className="tabular-nums"
          style={{ color: entry.color }}
        >
          {entry.name === "weight" ? "Weight" : "Reps"}: {entry.value}
          {entry.name === "weight" ? " lbs" : ""}
        </p>
      ))}
    </div>
  );
}

export function ExerciseProgressionChart() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [data, setData] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadExercises() {
      try {
        const list = await getExercises();
        setExercises(list);
        if (list.length > 0) {
          setSelectedId(list[0].id);
        }
      } catch {
        // Silently handle
      }
    }
    loadExercises();
  }, []);

  const loadProgression = useCallback(async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      const progression = await getExerciseProgression(selectedId, 90);
      setData(progression);
    } catch {
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadProgression();
  }, [loadProgression]);

  // Compute Y-axis domain
  const weights = data.map((d) => d.weight);
  const minWeight = weights.length > 0 ? Math.min(...weights) : 0;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 100;
  const padding = Math.max((maxWeight - minWeight) * 0.15, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Exercise Progression</CardTitle>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Select exercise" />
            </SelectTrigger>
            <SelectContent>
              {exercises.map((ex) => (
                <SelectItem key={ex.id} value={ex.id}>
                  {ex.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Loading progression data...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No data yet for this exercise. Log some working sets to see your
            progression.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(240 3.7% 25%)"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  stroke="hsl(240 5% 55%)"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[
                    Math.floor(minWeight - padding),
                    Math.ceil(maxWeight + padding),
                  ]}
                  stroke="hsl(240 5% 55%)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip content={<ProgressionTooltip />} />
                <Line
                  type="monotone"
                  dataKey="weight"
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
  );
}

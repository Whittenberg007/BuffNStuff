"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getVolumeByMuscleGroup } from "@/lib/database/analytics";

// Color palette for muscle groups
const MUSCLE_COLORS: Record<string, string> = {
  chest: "hsl(0 70% 55%)",
  back: "hsl(217 91% 60%)",
  shoulders: "hsl(38 92% 50%)",
  biceps: "hsl(142 70% 45%)",
  triceps: "hsl(280 65% 60%)",
  quads: "hsl(190 80% 45%)",
  hamstrings: "hsl(340 75% 55%)",
  glutes: "hsl(25 85% 55%)",
  calves: "hsl(160 60% 45%)",
  core: "hsl(60 70% 50%)",
  forearms: "hsl(200 50% 55%)",
};

function getMuscleColor(muscle: string): string {
  return MUSCLE_COLORS[muscle] || "hsl(240 5% 55%)";
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function VolumeTooltip({
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
      <p className="mb-1 font-medium text-foreground">Week of {label}</p>
      {payload
        .filter((e: TooltipPayloadItem) => e.value > 0)
        .map((entry: TooltipPayloadItem) => (
          <p
            key={entry.name}
            className="tabular-nums"
            style={{ color: entry.color }}
          >
            {capitalizeFirst(entry.name)}: {entry.value} sets
          </p>
        ))}
    </div>
  );
}

export function VolumeTrendsChart() {
  const [data, setData] = useState<Record<string, number | string>[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const volumeData = await getVolumeByMuscleGroup(90);
        setData(volumeData);

        // Collect all muscle groups across all weeks
        const muscles = new Set<string>();
        for (const week of volumeData) {
          for (const key of Object.keys(week)) {
            if (key !== "week") muscles.add(key);
          }
        }
        setMuscleGroups(Array.from(muscles).sort());
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Volume Trends</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Loading volume data...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            No workout data yet. Complete some sessions to see volume trends.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(240 3.7% 25%)"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="week"
                  stroke="hsl(240 5% 55%)"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="hsl(240 5% 55%)"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "Sets",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "hsl(240 5% 55%)" },
                  }}
                />
                <Tooltip content={<VolumeTooltip />} />
                <Legend
                  formatter={(value: string) => capitalizeFirst(value)}
                  wrapperStyle={{ fontSize: 11 }}
                />
                {muscleGroups.map((muscle) => (
                  <Bar
                    key={muscle}
                    dataKey={muscle}
                    stackId="volume"
                    fill={getMuscleColor(muscle)}
                    name={muscle}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

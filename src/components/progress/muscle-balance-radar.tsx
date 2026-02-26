"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMuscleGroupBalance } from "@/lib/database/analytics";
import type { MuscleGroup } from "@/types";

interface BalanceData {
  muscleGroup: MuscleGroup;
  sets: number;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface TooltipPayloadItem {
  name: string;
  value: number;
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      {payload.map((entry: TooltipPayloadItem) => (
        <p key={entry.name} className="tabular-nums text-foreground">
          {entry.value} sets
        </p>
      ))}
    </div>
  );
}

export function MuscleBalanceRadar() {
  const [data, setData] = useState<BalanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const balance = await getMuscleGroupBalance(30);
        setData(balance);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Format data for RadarChart
  const chartData = data.map((d) => ({
    muscle: capitalizeFirst(d.muscleGroup),
    sets: d.sets,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Muscle Balance</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Loading balance data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            No workout data yet. Train different muscle groups to see your
            balance.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} cx="50%" cy="50%">
                <PolarGrid stroke="hsl(240 3.7% 25%)" opacity={0.5} />
                <PolarAngleAxis
                  dataKey="muscle"
                  tick={{ fontSize: 10, fill: "hsl(240 5% 65%)" }}
                />
                <PolarRadiusAxis
                  tick={{ fontSize: 9, fill: "hsl(240 5% 55%)" }}
                  axisLine={false}
                />
                <Tooltip content={<RadarTooltip />} />
                <Radar
                  name="sets"
                  dataKey="sets"
                  stroke="hsl(217 91% 60%)"
                  fill="hsl(217 91% 60%)"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartData.length > 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Set distribution across muscle groups (last 30 days)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

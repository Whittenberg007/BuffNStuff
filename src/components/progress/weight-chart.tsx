"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WeightChartData {
  date: string;
  weight: number;
  average: number | null;
}

interface WeightChartProps {
  data: WeightChartData[];
  selectedRange: number;
  onRangeChange: (days: number) => void;
}

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

function formatDateLabel(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T00:00:00"), "MMM d");
  } catch {
    return dateStr;
  }
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
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
          {entry.name === "weight" ? "Actual" : "7-day Avg"}:{" "}
          {entry.value?.toFixed(1)} lbs
        </p>
      ))}
    </div>
  );
}

export function WeightChart({
  data,
  selectedRange,
  onRangeChange,
}: WeightChartProps) {
  // Compute domain with padding
  const weights = data.map((d) => d.weight).filter(Boolean);
  const averages = data.map((d) => d.average).filter(Boolean) as number[];
  const allValues = [...weights, ...averages];
  const minWeight = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxWeight = allValues.length > 0 ? Math.max(...allValues) : 200;
  const padding = Math.max((maxWeight - minWeight) * 0.15, 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weight Trend</CardTitle>
          <div className="flex items-center gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.days}
                variant={selectedRange === opt.days ? "default" : "ghost"}
                size="xs"
                onClick={() => onRangeChange(opt.days)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No weight data yet. Log your weight to see trends.
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
                <Tooltip content={<CustomTooltip />} />
                {/* Actual weight — dotted, faint */}
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(240 5% 65%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ r: 2, fill: "hsl(240 5% 65%)" }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
                {/* 7-day moving average — solid, bold */}
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="hsl(142 70% 45%)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(142 70% 45%)" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* Legend */}
        {data.length > 0 && (
          <div className="flex items-center justify-center gap-6 pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-px w-4 border-t-2 border-dashed border-zinc-400" />
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded-full bg-emerald-500" />
              <span>7-day Average</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
import type { BodyMeasurement, MeasurementField } from "@/types";

interface MeasurementChartProps {
  data: BodyMeasurement[];
  selectedRange: number;
  onRangeChange: (days: number) => void;
}

const RANGE_OPTIONS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

const FIELD_CONFIG: { key: MeasurementField; label: string; color: string }[] = [
  { key: "neck", label: "Neck", color: "hsl(210 70% 55%)" },
  { key: "chest", label: "Chest", color: "hsl(142 70% 45%)" },
  { key: "waist", label: "Waist", color: "hsl(0 70% 55%)" },
  { key: "hips", label: "Hips", color: "hsl(280 70% 55%)" },
  { key: "left_bicep", label: "L Bicep", color: "hsl(45 80% 50%)" },
  { key: "right_bicep", label: "R Bicep", color: "hsl(45 80% 65%)" },
  { key: "left_thigh", label: "L Thigh", color: "hsl(180 60% 45%)" },
  { key: "right_thigh", label: "R Thigh", color: "hsl(180 60% 60%)" },
  { key: "left_calf", label: "L Calf", color: "hsl(30 70% 50%)" },
  { key: "right_calf", label: "R Calf", color: "hsl(30 70% 65%)" },
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
      {payload.map((entry: TooltipPayloadItem) => {
        const config = FIELD_CONFIG.find((f) => f.key === entry.name);
        return (
          <p key={entry.name} className="tabular-nums" style={{ color: entry.color }}>
            {config?.label || entry.name}: {entry.value}
          </p>
        );
      })}
    </div>
  );
}

export function MeasurementChart({
  data,
  selectedRange,
  onRangeChange,
}: MeasurementChartProps) {
  const [visible, setVisible] = useState<Set<MeasurementField>>(
    new Set(["waist", "chest", "left_bicep", "right_bicep"])
  );

  function toggleField(field: MeasurementField) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  const availableFields = FIELD_CONFIG.filter((f) =>
    data.some((d) => d[f.key] !== null)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Measurement Trends</CardTitle>
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
            No measurement data yet. Log measurements to see trends.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {availableFields.map((f) => (
                <button
                  key={f.key}
                  onClick={() => toggleField(f.key)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    visible.has(f.key)
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground"
                  }`}
                  style={
                    visible.has(f.key)
                      ? { backgroundColor: f.color }
                      : undefined
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

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
                    stroke="hsl(240 5% 55%)"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {FIELD_CONFIG.filter((f) => visible.has(f.key)).map((f) => (
                    <Line
                      key={f.key}
                      type="monotone"
                      dataKey={f.key}
                      stroke={f.color}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

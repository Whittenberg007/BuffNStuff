"use client";

import { Minus, Ruler } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BodyMeasurement, MeasurementField } from "@/types";

interface MeasurementSummaryProps {
  latest: BodyMeasurement | null;
  previous: BodyMeasurement | null;
}

// Fields where decrease is considered "good" (losing inches)
const DECREASE_IS_GOOD: MeasurementField[] = ["waist", "hips"];

const FIELD_LABELS: Record<MeasurementField, string> = {
  neck: "Neck",
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  left_bicep: "L Bicep",
  right_bicep: "R Bicep",
  left_thigh: "L Thigh",
  right_thigh: "R Thigh",
  left_calf: "L Calf",
  right_calf: "R Calf",
};

const ALL_FIELDS: MeasurementField[] = [
  "neck", "chest", "waist", "hips",
  "left_bicep", "right_bicep",
  "left_thigh", "right_thigh",
  "left_calf", "right_calf",
];

function DeltaDisplay({ field, current, prev }: { field: MeasurementField; current: number; prev: number | null }) {
  if (prev === null) return null;
  const delta = Math.round((current - prev) * 10) / 10;
  if (delta === 0) return <Minus className="size-3 text-muted-foreground inline" />;

  const isGood = DECREASE_IS_GOOD.includes(field) ? delta < 0 : delta > 0;

  return (
    <span className={isGood ? "text-emerald-400" : "text-red-400"}>
      {delta > 0 ? "+" : ""}{delta}
    </span>
  );
}

export function MeasurementSummary({ latest, previous }: MeasurementSummaryProps) {
  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ruler className="size-4" />
            Latest Measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No measurements logged yet. Use the form below to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const populated = ALL_FIELDS.filter((f) => latest[f] !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ruler className="size-4" />
            Latest Measurements
          </CardTitle>
          <span className="text-xs text-muted-foreground">{latest.date}</span>
        </div>
      </CardHeader>
      <CardContent>
        {populated.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No values recorded in latest entry.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {populated.map((field) => (
              <div key={field} className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase">
                  {FIELD_LABELS[field]}
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {latest[field]}
                </p>
                <p className="text-xs tabular-nums">
                  <DeltaDisplay
                    field={field}
                    current={latest[field]!}
                    prev={previous?.[field] ?? null}
                  />
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Ruler, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logMeasurements, type MeasurementInput } from "@/lib/database/measurements";
import type { BodyMeasurement, MeasurementField } from "@/types";

interface MeasurementFormProps {
  latest: BodyMeasurement | null;
  onSaved: () => void;
}

const FIELD_GROUPS: { label: string; fields: { key: MeasurementField; label: string }[] }[] = [
  {
    label: "Upper Body",
    fields: [
      { key: "neck", label: "Neck" },
      { key: "chest", label: "Chest" },
      { key: "left_bicep", label: "L Bicep" },
      { key: "right_bicep", label: "R Bicep" },
    ],
  },
  {
    label: "Core",
    fields: [
      { key: "waist", label: "Waist" },
      { key: "hips", label: "Hips" },
    ],
  },
  {
    label: "Lower Body",
    fields: [
      { key: "left_thigh", label: "L Thigh" },
      { key: "right_thigh", label: "R Thigh" },
      { key: "left_calf", label: "L Calf" },
      { key: "right_calf", label: "R Calf" },
    ],
  },
];

export function MeasurementForm({ latest, onSaved }: MeasurementFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(field: MeasurementField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    const input: MeasurementInput = {};
    let hasValue = false;

    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const raw = values[f.key];
        if (raw) {
          const num = parseFloat(raw);
          if (!isNaN(num) && num > 0) {
            input[f.key] = num;
            hasValue = true;
          }
        }
      }
    }

    if (!hasValue) return;
    if (notes.trim()) input.notes = notes.trim();

    setIsSubmitting(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      await logMeasurements(today, input);
      setValues({});
      setNotes("");
      onSaved();
    } catch {
      // Silently handle
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ruler className="size-4" />
          Log Measurements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {FIELD_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground w-14 shrink-0">
                    {f.label}
                  </label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    placeholder={latest?.[f.key]?.toString() || "—"}
                    value={values[f.key] || ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-sm"
        />

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || Object.keys(values).length === 0}
          className="w-full"
          size="sm"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Save Measurements"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

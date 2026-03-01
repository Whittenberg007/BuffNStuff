"use client";

import { Label } from "@/components/ui/label";
import type { ProgressionRules, ProgressionType } from "@/types";

const PROGRESSION_TYPE_OPTIONS: {
  value: ProgressionType;
  label: string;
  description: string;
}[] = [
  {
    value: "linear_weight",
    label: "Linear Weight",
    description: "Add weight each session/week",
  },
  {
    value: "linear_reps",
    label: "Linear Reps",
    description: "Add reps until target, then increase weight",
  },
  {
    value: "percentage",
    label: "Percentage",
    description: "Increase by % each cycle",
  },
  {
    value: "rpe",
    label: "RPE",
    description: "Autoregulated by RPE/RIR",
  },
  {
    value: "wave",
    label: "Wave",
    description: "Heavy/medium/light week rotation",
  },
  {
    value: "volume_ramp",
    label: "Volume Ramp",
    description: "Increase sets from MEV to MRV",
  },
];

const FAILURE_PROTOCOL_OPTIONS: { value: string; label: string }[] = [
  { value: "deload_10_percent", label: "Deload 10%" },
  { value: "repeat_weight", label: "Repeat Weight" },
  { value: "drop_to_previous", label: "Drop to Previous" },
];

const selectClassName =
  "w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm";
const inputClassName =
  "w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm";

interface ProgressionConfigProps {
  value: ProgressionRules;
  onChange: (rules: ProgressionRules) => void;
}

export function ProgressionConfig({ value, onChange }: ProgressionConfigProps) {
  function handleTypeChange(type: ProgressionType) {
    const updated: ProgressionRules = { type };

    // Set defaults based on selected type
    switch (type) {
      case "linear_weight":
        updated.compound_increment_lbs = 5;
        updated.isolation_increment_lbs = 2.5;
        break;
      case "percentage":
        updated.percentage_increase = 2.5;
        break;
      case "rpe":
        updated.rpe_target = 8;
        break;
    }

    updated.failure_protocol = value.failure_protocol || "deload_10_percent";
    onChange(updated);
  }

  function handleFieldChange(
    field: keyof ProgressionRules,
    rawValue: string
  ) {
    const numValue = parseFloat(rawValue);
    onChange({
      ...value,
      [field]: isNaN(numValue) ? undefined : numValue,
    });
  }

  function handleFailureProtocolChange(protocol: string) {
    onChange({ ...value, failure_protocol: protocol });
  }

  return (
    <div className="space-y-4">
      {/* Progression Type */}
      <div>
        <Label className="text-sm mb-1.5 block">Progression Type</Label>
        <select
          className={selectClassName}
          value={value.type}
          onChange={(e) => handleTypeChange(e.target.value as ProgressionType)}
        >
          {PROGRESSION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} - {opt.description}
            </option>
          ))}
        </select>
      </div>

      {/* Conditional fields based on type */}
      {value.type === "linear_weight" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm mb-1.5 block">
              Compound Increment (lbs)
            </Label>
            <input
              type="number"
              className={inputClassName}
              value={value.compound_increment_lbs ?? 5}
              onChange={(e) =>
                handleFieldChange("compound_increment_lbs", e.target.value)
              }
              min={0}
              step={2.5}
            />
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">
              Isolation Increment (lbs)
            </Label>
            <input
              type="number"
              className={inputClassName}
              value={value.isolation_increment_lbs ?? 2.5}
              onChange={(e) =>
                handleFieldChange("isolation_increment_lbs", e.target.value)
              }
              min={0}
              step={2.5}
            />
          </div>
        </div>
      )}

      {value.type === "percentage" && (
        <div>
          <Label className="text-sm mb-1.5 block">
            Percentage Increase (%)
          </Label>
          <input
            type="number"
            className={inputClassName}
            value={value.percentage_increase ?? 2.5}
            onChange={(e) =>
              handleFieldChange("percentage_increase", e.target.value)
            }
            min={0}
            step={0.5}
          />
        </div>
      )}

      {value.type === "rpe" && (
        <div>
          <Label className="text-sm mb-1.5 block">RPE Target</Label>
          <input
            type="number"
            className={inputClassName}
            value={value.rpe_target ?? 8}
            onChange={(e) => handleFieldChange("rpe_target", e.target.value)}
            min={1}
            max={10}
            step={0.5}
          />
        </div>
      )}

      {/* Failure Protocol (all types) */}
      <div>
        <Label className="text-sm mb-1.5 block">Failure Protocol</Label>
        <select
          className={selectClassName}
          value={value.failure_protocol || "deload_10_percent"}
          onChange={(e) => handleFailureProtocolChange(e.target.value)}
        >
          {FAILURE_PROTOCOL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          What to do when you fail to hit the target reps
        </p>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLATES_LBS = [45, 35, 25, 10, 5, 2.5] as const;
const PLATES_KG = [20, 15, 10, 5, 2.5, 1.25] as const;
const BAR_LBS = 45;
const BAR_KG = 20;

interface PlateCalculatorProps {
  weight: number;
  unit: "lbs" | "kg";
  onClose: () => void;
}

function calculatePlates(
  totalWeight: number,
  barWeight: number,
  availablePlates: readonly number[]
): { plates: number[]; achievable: number } {
  const perSide = (totalWeight - barWeight) / 2;
  if (perSide <= 0) return { plates: [], achievable: barWeight };

  const plates: number[] = [];
  let remaining = perSide;

  for (const plate of availablePlates) {
    while (remaining >= plate) {
      plates.push(plate);
      remaining -= plate;
    }
  }

  const actualPerSide = perSide - remaining;
  const achievable = barWeight + actualPerSide * 2;

  return { plates, achievable };
}

function getPlateColor(plate: number, unit: "lbs" | "kg"): string {
  if (unit === "lbs") {
    if (plate === 45) return "bg-blue-600 text-white";
    if (plate === 35) return "bg-yellow-500 text-black";
    if (plate === 25) return "bg-green-600 text-white";
    if (plate === 10) return "bg-zinc-300 text-black";
    if (plate === 5) return "bg-zinc-500 text-white";
    return "bg-zinc-700 text-white";
  }
  if (plate === 20) return "bg-blue-600 text-white";
  if (plate === 15) return "bg-yellow-500 text-black";
  if (plate === 10) return "bg-green-600 text-white";
  if (plate === 5) return "bg-zinc-300 text-black";
  if (plate === 2.5) return "bg-zinc-500 text-white";
  return "bg-zinc-700 text-white";
}

export function PlateCalculator({ weight, unit, onClose }: PlateCalculatorProps) {
  const barWeight = unit === "lbs" ? BAR_LBS : BAR_KG;
  const plates = unit === "lbs" ? PLATES_LBS : PLATES_KG;

  const result = useMemo(
    () => calculatePlates(weight, barWeight, plates),
    [weight, barWeight, plates]
  );

  const isExact = result.achievable === weight;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-card border-t p-4 sm:rounded-2xl sm:border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-primary" />
            <span className="font-semibold">Plate Calculator</span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums">
            {weight} <span className="text-lg text-muted-foreground">{unit}</span>
          </p>
          {!isExact && (
            <p className="text-xs text-yellow-500 mt-1">
              Nearest: {result.achievable} {unit} (closest)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Bar: {barWeight} {unit} | Each side:
          </p>
          {result.plates.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-4">
              Just the bar
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5 py-2">
              {result.plates.map((plate, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-bold tabular-nums min-w-[3rem]",
                    getPlateColor(plate, unit)
                  )}
                >
                  {plate}
                </span>
              ))}
            </div>
          )}
        </div>

        {result.plates.length > 0 && (
          <div className="text-xs text-muted-foreground text-center space-y-0.5">
            <p>
              {result.plates.length} plate{result.plates.length !== 1 ? "s" : ""} per side
            </p>
            <p>
              Total plate weight: {result.achievable - barWeight} {unit}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

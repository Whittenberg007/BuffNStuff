"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhotoUrl } from "@/lib/database/photos";
import type { ProgressPhoto, PhotoPose, BodyMeasurement, MeasurementField } from "@/types";

interface PhotoCompareProps {
  photos: ProgressPhoto[];
  measurements: BodyMeasurement[];
}

const POSES: PhotoPose[] = ["front", "side", "back"];

const COMPARE_FIELDS: { key: MeasurementField; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "left_bicep", label: "L Bicep" },
  { key: "right_bicep", label: "R Bicep" },
];

export function PhotoCompare({ photos, measurements }: PhotoCompareProps) {
  const [pose, setPose] = useState<PhotoPose>("front");
  const [urlA, setUrlA] = useState<string | null>(null);
  const [urlB, setUrlB] = useState<string | null>(null);
  const [dateOverrideA, setDateOverrideA] = useState<string | null>(null);
  const [dateOverrideB, setDateOverrideB] = useState<string | null>(null);

  // Get unique dates that have the selected pose
  const availableDates = useMemo(
    () =>
      Array.from(
        new Set(photos.filter((p) => p.pose === pose).map((p) => p.date))
      ).sort(),
    [photos, pose]
  );

  // Derive selected dates: use override if set, otherwise auto-select first/last
  const dateA = dateOverrideA ?? (availableDates.length >= 1 ? availableDates[0] : "");
  const dateB = dateOverrideB ?? (availableDates.length >= 2 ? availableDates[availableDates.length - 1] : "");

  // Reset overrides when pose changes
  function handlePoseChange(newPose: PhotoPose) {
    setPose(newPose);
    setDateOverrideA(null);
    setDateOverrideB(null);
  }

  // Load photo URLs when dates change
  useEffect(() => {
    async function loadUrls() {
      const photoA = photos.find((p) => p.pose === pose && p.date === dateA);
      const photoB = photos.find((p) => p.pose === pose && p.date === dateB);
      setUrlA(photoA ? await getPhotoUrl(photoA.storage_path) : null);
      setUrlB(photoB ? await getPhotoUrl(photoB.storage_path) : null);
    }
    if (dateA || dateB) loadUrls();
  }, [dateA, dateB, pose, photos]);

  // Find measurements for selected dates
  const measA = measurements.find((m) => m.date === dateA);
  const measB = measurements.find((m) => m.date === dateB);

  if (photos.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="size-4" />
            Compare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Take at least 2 progress photos to compare them side by side.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="size-4" />
          Compare
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pose selector */}
        <div className="flex gap-1">
          {POSES.map((p) => (
            <Button
              key={p}
              variant={pose === p ? "default" : "outline"}
              size="sm"
              onClick={() => handlePoseChange(p)}
              className="flex-1 capitalize"
            >
              {p}
            </Button>
          ))}
        </div>

        {/* Date selectors */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={dateA}
            onChange={(e) => setDateOverrideA(e.target.value || null)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Before</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {format(new Date(d + "T00:00:00"), "MMM d, yyyy")}
              </option>
            ))}
          </select>
          <select
            value={dateB}
            onChange={(e) => setDateOverrideB(e.target.value || null)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">After</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {format(new Date(d + "T00:00:00"), "MMM d, yyyy")}
              </option>
            ))}
          </select>
        </div>

        {/* Side-by-side photos */}
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-[3/4] rounded-md bg-zinc-900 overflow-hidden">
            {urlA ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlA} alt="Before" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                {dateA ? "Loading..." : "Select date"}
              </div>
            )}
          </div>
          <div className="aspect-[3/4] rounded-md bg-zinc-900 overflow-hidden">
            {urlB ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlB} alt="After" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                {dateB ? "Loading..." : "Select date"}
              </div>
            )}
          </div>
        </div>

        {/* Measurement deltas */}
        {measA && measB && (
          <div className="grid grid-cols-5 gap-1 text-center">
            {COMPARE_FIELDS.map((f) => {
              const valA = measA[f.key];
              const valB = measB[f.key];
              if (valA === null || valB === null) return null;
              const delta = Math.round((valB - valA) * 10) / 10;
              return (
                <div key={f.key}>
                  <p className="text-[10px] text-muted-foreground">{f.label}</p>
                  <p
                    className={`text-xs font-bold tabular-nums ${
                      delta < 0 ? "text-emerald-400" : delta > 0 ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}{delta}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

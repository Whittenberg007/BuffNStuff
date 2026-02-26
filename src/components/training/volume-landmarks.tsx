"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  VOLUME_LANDMARKS,
  getVolumeStatus,
} from "@/lib/training/pairing-guidance";
import { getVolumeByMuscleGroup } from "@/lib/database/analytics";
import type { MuscleGroup } from "@/types";

interface MuscleVolumeData {
  muscleGroup: MuscleGroup;
  currentSets: number;
  mev: number;
  mavMin: number;
  mavMax: number;
  mrv: number;
  status: ReturnType<typeof getVolumeStatus>;
}

export function VolumeLandmarks() {
  const [volumeData, setVolumeData] = useState<MuscleVolumeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Get current week's volume data (7 days)
        const rawData = await getVolumeByMuscleGroup(7);

        if (!rawData.length) {
          setVolumeData([]);
          return;
        }

        // The most recent week entry contains the current week's data
        const currentWeek = rawData[rawData.length - 1];
        const muscleGroups = Object.keys(VOLUME_LANDMARKS) as MuscleGroup[];

        const data: MuscleVolumeData[] = [];

        for (const mg of muscleGroups) {
          const currentSets =
            typeof currentWeek[mg] === "number"
              ? (currentWeek[mg] as number)
              : 0;

          // Only show muscle groups that have data
          if (currentSets === 0) continue;

          const landmarks = VOLUME_LANDMARKS[mg];
          const status = getVolumeStatus(mg, currentSets);

          data.push({
            muscleGroup: mg,
            currentSets,
            mev: landmarks.mev,
            mavMin: landmarks.mav_min,
            mavMax: landmarks.mav_max,
            mrv: landmarks.mrv,
            status,
          });
        }

        // Sort by muscle group name for consistent display
        data.sort((a, b) => a.muscleGroup.localeCompare(b.muscleGroup));
        setVolumeData(data);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-green-400" />
            Weekly Volume Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-green-400" />
          Weekly Volume Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {volumeData.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No training data this week. Complete a workout to see volume status.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-sm bg-blue-500" />
                Below MEV
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-sm bg-green-500" />
                In MAV
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-sm bg-yellow-500" />
                Near MRV
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-sm bg-red-500" />
                Over MRV
              </span>
            </div>

            {/* Volume bars */}
            <div className="space-y-3">
              {volumeData.map((item) => {
                const barColor = getBarColor(item.status.status);
                // Calculate percentage: show current sets relative to MRV
                const percentage = Math.min(
                  (item.currentSets / item.mrv) * 100,
                  100
                );

                return (
                  <div key={item.muscleGroup} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium capitalize">
                        {item.muscleGroup}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {item.currentSets} / {item.mrv} sets
                      </span>
                    </div>

                    {/* Volume bar with zone markers */}
                    <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                      {/* Zone background indicators */}
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-500/10"
                        style={{
                          width: `${(item.mev / item.mrv) * 100}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 bg-green-500/10"
                        style={{
                          left: `${(item.mev / item.mrv) * 100}%`,
                          width: `${((item.mavMax - item.mev) / item.mrv) * 100}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 bg-yellow-500/10"
                        style={{
                          left: `${(item.mavMax / item.mrv) * 100}%`,
                          width: `${((item.mrv - item.mavMax) / item.mrv) * 100}%`,
                        }}
                      />

                      {/* Current volume bar */}
                      <div
                        className={`relative h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(percentage, 3)}%` }}
                      />
                    </div>

                    {/* Zone labels */}
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>MEV: {item.mev}</span>
                      <span>
                        MAV: {item.mavMin}-{item.mavMax}
                      </span>
                      <span>MRV: {item.mrv}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getBarColor(
  status: "below_mev" | "mev" | "mav" | "approaching_mrv" | "over_mrv"
): string {
  switch (status) {
    case "below_mev":
      return "bg-blue-500";
    case "mev":
    case "mav":
      return "bg-green-500";
    case "approaching_mrv":
      return "bg-yellow-500";
    case "over_mrv":
      return "bg-red-500";
    default:
      return "bg-green-500";
  }
}

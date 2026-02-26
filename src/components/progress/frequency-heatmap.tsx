"use client";

import { useEffect, useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTrainingFrequency } from "@/lib/database/analytics";

interface DayData {
  date: string;
  muscleGroupCount: number;
  muscleGroups: string[];
}

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-muted/30";
  if (count === 1) return "bg-emerald-900/60";
  if (count === 2) return "bg-emerald-700/70";
  if (count === 3) return "bg-emerald-600/80";
  return "bg-emerald-500";
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function FrequencyHeatmap() {
  const [data, setData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const freq = await getTrainingFrequency(90);
        setData(freq);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Build a map for quick lookup
  const dataMap = new Map<string, DayData>();
  for (const d of data) {
    dataMap.set(d.date, d);
  }

  // Build the grid: 13 weeks x 7 days
  const today = new Date();
  const gridStart = startOfWeek(subDays(today, 89), { weekStartsOn: 1 });

  const weeks: Array<Array<{ date: string; count: number; muscles: string[] }>> = [];
  let currentDate = gridStart;

  while (currentDate <= today) {
    const weekStartDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekKey = format(weekStartDate, "yyyy-MM-dd");

    // Find or create week array
    let week = weeks.find(
      (w) =>
        w.length > 0 &&
        format(
          startOfWeek(new Date(w[0].date + "T00:00:00"), { weekStartsOn: 1 }),
          "yyyy-MM-dd"
        ) === weekKey
    );

    if (!week) {
      week = [];
      weeks.push(week);
    }

    const dateKey = format(currentDate, "yyyy-MM-dd");
    const dayData = dataMap.get(dateKey);

    week.push({
      date: dateKey,
      count: dayData?.muscleGroupCount || 0,
      muscles: dayData?.muscleGroups || [],
    });

    currentDate = addDays(currentDate, 1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Training Frequency</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Loading frequency data...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1">
              {/* Day labels column */}
              <div className="flex flex-col gap-[3px] pr-1">
                {DAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="flex h-[14px] items-center text-[9px] text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Heatmap grid */}
              <div className="flex gap-[3px] overflow-x-auto">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {/* Pad incomplete first week */}
                    {wi === 0 &&
                      week.length < 7 &&
                      Array.from({ length: 7 - week.length }).map((_, pi) => (
                        <div
                          key={`pad-${pi}`}
                          className="size-[14px] rounded-[2px]"
                        />
                      ))}
                    {week.map((day) => (
                      <div
                        key={day.date}
                        className={`size-[14px] rounded-[2px] transition-colors ${getIntensityClass(day.count)}`}
                        title={`${format(new Date(day.date + "T00:00:00"), "MMM d, yyyy")}${day.count > 0 ? ` — ${day.count} muscle group${day.count > 1 ? "s" : ""}: ${day.muscles.join(", ")}` : " — Rest day"}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className={`size-[10px] rounded-[2px] ${getIntensityClass(0)}`} />
              <div className={`size-[10px] rounded-[2px] ${getIntensityClass(1)}`} />
              <div className={`size-[10px] rounded-[2px] ${getIntensityClass(2)}`} />
              <div className={`size-[10px] rounded-[2px] ${getIntensityClass(3)}`} />
              <div className={`size-[10px] rounded-[2px] ${getIntensityClass(4)}`} />
              <span>More</span>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Last 90 days -- color intensity shows muscle groups trained per day
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

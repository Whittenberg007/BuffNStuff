"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Weight, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getWeeklySummary } from "@/lib/database/stats";

interface WeeklyData {
  daysThisWeek: number;
  totalVolume: number;
  totalSets: number;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(1)}M`;
  }
  return volume.toLocaleString();
}

export function WeeklySummary() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const summary = await getWeeklySummary();
        setData(summary);
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
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="py-4">
            <CardContent className="px-4">
              <div className="h-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Days Trained",
      value: data?.daysThisWeek ?? 0,
      suffix: "",
      icon: Dumbbell,
    },
    {
      label: "Total Volume",
      value: data?.totalVolume ? formatVolume(data.totalVolume) : "0",
      suffix: "lbs",
      icon: Weight,
    },
    {
      label: "Total Sets",
      value: data?.totalSets ?? 0,
      suffix: "",
      icon: Hash,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="py-4">
          <CardContent className="px-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold tabular-nums leading-tight">
                  {stat.value}
                  {stat.suffix && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {stat.suffix}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

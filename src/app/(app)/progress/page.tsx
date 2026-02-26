"use client";

import { useCallback, useEffect, useState } from "react";
import { WeightTracker } from "@/components/progress/weight-tracker";
import { WeightChart } from "@/components/progress/weight-chart";
import { getWeightHistory, getWeightTrend } from "@/lib/database/weight";
import type { WeightEntry } from "@/types";

export default function ProgressPage() {
  const [range, setRange] = useState(30);
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [trendData, setTrendData] = useState<
    { date: string; weight: number; average: number | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [historyData, trend] = await Promise.all([
        getWeightHistory(range),
        getWeightTrend(range),
      ]);
      setHistory(historyData);
      setTrendData(trend);
    } catch {
      // Silently handle — user may not be authenticated yet
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground">
          Track your weight and body composition
        </p>
      </div>

      <WeightTracker history={history} onWeightLogged={loadData} />

      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Loading chart data...
        </div>
      ) : (
        <WeightChart
          data={trendData}
          selectedRange={range}
          onRangeChange={setRange}
        />
      )}
    </div>
  );
}

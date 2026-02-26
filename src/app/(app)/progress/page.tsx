"use client";

import { useCallback, useEffect, useState } from "react";
import { WeightTracker } from "@/components/progress/weight-tracker";
import { WeightChart } from "@/components/progress/weight-chart";
import { ExerciseProgressionChart } from "@/components/progress/exercise-progression-chart";
import { VolumeTrendsChart } from "@/components/progress/volume-trends-chart";
import { MuscleBalanceRadar } from "@/components/progress/muscle-balance-radar";
import { FrequencyHeatmap } from "@/components/progress/frequency-heatmap";
import { GoalsList } from "@/components/goals/goals-list";
import { getWeightHistory, getWeightTrend } from "@/lib/database/weight";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground">
          Track your weight, exercise progression, and training volume.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
          <TabsTrigger value="volume">Volume</TabsTrigger>
          <TabsTrigger value="frequency">Frequency</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
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
        </TabsContent>

        <TabsContent value="exercises" className="mt-4 space-y-6">
          <ExerciseProgressionChart />
        </TabsContent>

        <TabsContent value="volume" className="mt-4 space-y-6">
          <VolumeTrendsChart />
          <MuscleBalanceRadar />
        </TabsContent>

        <TabsContent value="frequency" className="mt-4 space-y-6">
          <FrequencyHeatmap />
        </TabsContent>

        <TabsContent value="goals" className="mt-4 space-y-6">
          <GoalsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAllExercisePRs, getRepMaxes, get1RMHistory } from "@/lib/database/strength";
import { getWeightHistory } from "@/lib/database/weight";
import {
  getStrengthLevel,
  getStrengthLevelColor,
  matchExerciseToStandard,
  BIG_FOUR,
  STANDARD_LABELS,
} from "@/lib/utils/strength";
import type { RepMax, StrengthLevel } from "@/types";
import { format } from "date-fns";

interface Big4Entry {
  key: string;
  label: string;
  rm1: RepMax | null;
  level: StrengthLevel | null;
}

export function StrengthProfile() {
  const [prs, setPrs] = useState<RepMax[]>([]);
  const [big4, setBig4] = useState<Big4Entry[]>([]);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [repMaxDetail, setRepMaxDetail] = useState<{
    rm1: RepMax | null;
    rm3: RepMax | null;
    rm5: RepMax | null;
    best: RepMax | null;
  } | null>(null);
  const [trendData, setTrendData] = useState<{ date: string; weight: number }[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load initial data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [allPRs, weightData] = await Promise.all([
          getAllExercisePRs(),
          getWeightHistory(1),
        ]);

        if (cancelled) return;

        const bw = weightData.length > 0 ? weightData[weightData.length - 1].weight : null;
        setBodyweight(bw);
        setPrs(allPRs);

        // Build Big 4 data
        const big4Data: Big4Entry[] = BIG_FOUR.map((key) => {
          const match = allPRs.find(
            (pr) => matchExerciseToStandard(pr.exerciseName) === key
          );
          return {
            key,
            label: STANDARD_LABELS[key],
            rm1: match || null,
            level: null,
          };
        });

        // For each Big 4 lift that has a match, fetch actual 1RM
        const enriched = await Promise.all(
          big4Data.map(async (entry) => {
            if (!entry.rm1) return entry;
            const maxes = await getRepMaxes(entry.rm1.exerciseId);
            const actual1RM = maxes.rm1;
            const level =
              actual1RM && bw
                ? getStrengthLevel(actual1RM.weight, bw, entry.rm1.exerciseName)
                : null;
            return { ...entry, rm1: actual1RM, level };
          })
        );

        if (!cancelled) setBig4(enriched);
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Load detail when exercise selected
  useEffect(() => {
    if (!selectedExercise) {
      setRepMaxDetail(null);
      setTrendData([]);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);

    Promise.all([
      getRepMaxes(selectedExercise),
      get1RMHistory(selectedExercise),
    ])
      .then(([maxes, history]) => {
        if (!cancelled) {
          setRepMaxDetail(maxes);
          setTrendData(history);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => { cancelled = true; };
  }, [selectedExercise]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Big 4 Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4" /> Big 4 Lifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!bodyweight && (
            <p className="text-xs text-muted-foreground mb-3">
              Log your bodyweight in the Overview tab to see strength levels.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {big4.map((entry) => (
              <div
                key={entry.key}
                className="rounded-lg border p-3 text-center"
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {entry.label}
                </div>
                {entry.rm1 ? (
                  <>
                    <div className="text-lg font-bold">
                      {entry.rm1.weight} lbs
                    </div>
                    {entry.level && (
                      <Badge
                        className={cn(
                          "mt-1 text-[10px] capitalize",
                          getStrengthLevelColor(entry.level)
                        )}
                      >
                        {entry.level}
                      </Badge>
                    )}
                    {!entry.level && bodyweight && (
                      <span className="text-[10px] text-muted-foreground">
                        No single tested
                      </span>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not tested
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exercise Selector + Rep Maxes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exercise Rep Maxes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedExercise || ""}
            onValueChange={(v) => setSelectedExercise(v || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an exercise" />
            </SelectTrigger>
            <SelectContent>
              {prs.map((pr) => (
                <SelectItem key={pr.exerciseId} value={pr.exerciseId}>
                  {pr.exerciseName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loadingDetail && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {repMaxDetail && !loadingDetail && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "1RM", data: repMaxDetail.rm1 },
                  { label: "3RM", data: repMaxDetail.rm3 },
                  { label: "5RM", data: repMaxDetail.rm5 },
                  { label: "Best Set", data: repMaxDetail.best },
                ].map(({ label, data }) => (
                  <div key={label} className="rounded-lg border p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{label}</div>
                    {data ? (
                      <>
                        <div className="text-lg font-bold">{data.weight} lbs</div>
                        <div className="text-xs text-muted-foreground">
                          {data.reps} rep{data.reps !== 1 ? "s" : ""}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">&mdash;</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Strength level for selected exercise */}
              {repMaxDetail.rm1 && bodyweight && (() => {
                const pr = prs.find((p) => p.exerciseId === selectedExercise);
                const level = pr
                  ? getStrengthLevel(repMaxDetail.rm1.weight, bodyweight, pr.exerciseName)
                  : null;
                return level ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Strength Level:</span>
                    <Badge className={cn("capitalize", getStrengthLevelColor(level))}>
                      {level}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({(repMaxDetail.rm1.weight / bodyweight).toFixed(2)}x BW)
                    </span>
                  </div>
                ) : null;
              })()}

              {/* 1RM Trend Chart */}
              {trendData.length > 1 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">1RM History</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(240 3.7% 25%)"
                          opacity={0.3}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                          stroke="hsl(240 5% 55%)"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          stroke="hsl(240 5% 55%)"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v: number) => `${v}`}
                        />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d as string), "MMM d, yyyy")}
                          formatter={(value) => [`${value} lbs`, "1RM"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="hsl(217 91% 60%)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(217 91% 60%)" }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {trendData.length === 0 && repMaxDetail.rm1 === null && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No singles (1 rep) logged for this exercise yet.
                </p>
              )}
            </>
          )}

          {!selectedExercise && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Select an exercise to see your rep maxes and 1RM history.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

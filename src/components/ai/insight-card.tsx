"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell, Apple, Moon, Sparkles } from "lucide-react";
import type { AIInsight } from "@/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Dumbbell,
  Apple,
  Moon,
};

export function InsightCards() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/ai/insights")
      .then((r) => (r.ok ? r.json() : { insights: [] }))
      .then((data) => setInsights(data.insights || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || insights.length === 0) return null;

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="size-3" /> AI Insights
        </p>
        {insights.map((insight) => {
          const Icon = ICON_MAP[insight.icon] || Dumbbell;
          return (
            <div key={insight.id} className="flex items-start gap-2 text-sm">
              <Icon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span>{insight.text}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

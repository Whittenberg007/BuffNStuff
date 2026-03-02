"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Loader2 } from "lucide-react";
import type { WorkoutSet } from "@/types";

interface PostWorkoutSummaryProps {
  sessionId: string;
  totalSets: number;
  totalVolume: number;
  exerciseCount: number;
  elapsedSeconds: number;
  sets: WorkoutSet[];
}

export function PostWorkoutSummary({
  totalSets,
  totalVolume,
  exerciseCount,
  elapsedSeconds,
  sets,
}: PostWorkoutSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prCount = sets.filter((s) => s.is_pr).length;
    const durationMin = Math.round(elapsedSeconds / 60);

    const prompt = `Give a brief, encouraging 2-3 sentence post-workout summary. Stats: ${totalSets} sets across ${exerciseCount} exercises, ${totalVolume.toLocaleString()} lbs total volume, ${durationMin} minutes, ${prCount} new PR${prCount !== 1 ? "s" : ""}. Keep it motivational and specific to their numbers.`;

    fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        mode: "chat",
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const reader = r.body?.getReader();
        if (!reader) throw new Error();
        const decoder = new TextDecoder();
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setSummary(text.trim());
        }
      })
      .catch(() => {
        setSummary(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loading && !summary) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="py-3">
        <div className="flex items-start gap-2">
          <Bot className="size-4 mt-0.5 shrink-0 text-primary" />
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Generating summary...
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{summary}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

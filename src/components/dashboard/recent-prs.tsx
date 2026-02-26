"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentPRs } from "@/lib/database/stats";

interface PR {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
}

export function RecentPRs() {
  const [prs, setPrs] = useState<PR[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getRecentPRs(7);
        setPrs(data);
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
            <Trophy className="size-4 text-yellow-500" />
            Recent PRs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
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
          <Trophy className="size-4 text-yellow-500" />
          Recent PRs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {prs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No PRs this week -- time to push it!
          </p>
        ) : (
          <div className="space-y-3">
            {prs.map((pr, i) => (
              <div
                key={`${pr.exerciseName}-${pr.date}-${i}`}
                className="flex items-center justify-between text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pr.exerciseName}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {pr.weight} lbs x {pr.reps} reps
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(pr.date), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

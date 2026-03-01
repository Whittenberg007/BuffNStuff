"use client";

import { useEffect, useState } from "react";
import { Flame, Snowflake } from "lucide-react";
import { getFastingStreak } from "@/lib/database/fasting";

export function FastingStreak() {
  const [streak, setStreak] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const s = await getFastingStreak();
        setStreak(s);
      } catch {
        setStreak(0);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return <div className="h-6 w-24 animate-pulse rounded bg-muted" />;
  }

  const count = streak ?? 0;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      {count > 0 ? (
        <Flame className="size-4 text-orange-500" />
      ) : (
        <Snowflake className="size-4 text-blue-400" />
      )}
      <span className="font-medium tabular-nums">{count}</span>
      <span className="text-muted-foreground">day fast streak</span>
    </div>
  );
}

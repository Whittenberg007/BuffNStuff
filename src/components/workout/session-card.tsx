"use client";

import { Calendar, Clock, Dumbbell, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";
import type { WorkoutSession } from "@/types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "In progress";
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const diffMs = end - start;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

interface SessionCardProps {
  session: WorkoutSession;
  /** Total sets in this session */
  totalSets?: number;
  /** Total volume (weight * reps) */
  totalVolume?: number;
}

export function SessionCard({
  session,
  totalSets = 0,
  totalVolume = 0,
}: SessionCardProps) {
  const date = new Date(session.started_at);
  const dateStr = format(date, "MMM d, yyyy");
  const relativeStr = formatDistanceToNow(date, { addSuffix: true });
  const duration = formatDuration(session.started_at, session.ended_at);

  return (
    <Card className="py-4">
      <CardContent className="pt-0 pb-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Calendar className="size-3.5 text-muted-foreground" />
              {dateStr}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {relativeStr}
            </p>
          </div>
          {session.split_type && (
            <Badge variant="secondary" className="text-[10px]">
              {capitalize(session.split_type)}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {duration}
          </span>
          {totalSets > 0 && (
            <span className="flex items-center gap-1">
              <Dumbbell className="size-3" />
              {totalSets} sets
            </span>
          )}
          {totalVolume > 0 && (
            <span className="flex items-center gap-1">
              <Flame className="size-3" />
              {totalVolume.toLocaleString()} lbs
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

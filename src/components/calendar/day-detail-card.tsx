"use client";

import Link from "next/link";
import { Clock, Dumbbell, Flame, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSplitColor } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { CalendarSession } from "@/lib/database/workouts";
import type { ProjectedProgramDay } from "@/lib/calendar";

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function SessionCard({ session }: { session: CalendarSession }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span
              className={cn("size-3 rounded-full", getSplitColor(session.split_type))}
            />
            {session.split_type
              ? session.split_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : "Workout"}
          </CardTitle>
          {session.split_type && (
            <Badge variant="secondary" className="text-xs">
              {session.split_type.replace("_", " ").toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(session.started_at, session.ended_at)}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3" />
            {session.totalSets} sets
          </span>
          <span className="flex items-center gap-1">
            <Flame className="size-3" />
            {session.totalVolume.toLocaleString()} lbs
          </span>
          {session.prCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-500">
              <Trophy className="size-3" />
              {session.prCount} PR{session.prCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {session.exercises.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {session.exercises.map((name) => (
              <Badge key={name} variant="outline" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        )}
        {session.notes && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            {session.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduledDayCard({
  scheduled,
  programName,
}: {
  scheduled: ProjectedProgramDay;
  programName: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="size-4 text-muted-foreground" />
            {scheduled.day.label}
          </CardTitle>
          {scheduled.isDeload && (
            <Badge variant="secondary" className="text-xs">
              Deload
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {programName} — {scheduled.weekLabel}
        </p>
      </CardHeader>
      <CardContent>
        {scheduled.day.exercises.length > 0 && (
          <div className="space-y-1 mb-3">
            {scheduled.day.exercises.map((ex, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span>{ex.exercise_name}</span>
                <span className="text-xs text-muted-foreground">
                  {ex.sets} x {ex.reps}
                  {ex.rpe_target ? ` @RPE ${ex.rpe_target}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/workout">
          <Button className="w-full" size="sm">
            Start This Workout
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

interface DayDetailCardProps {
  sessions: CalendarSession[];
  scheduled: ProjectedProgramDay | null;
  programName: string;
}

export function DayDetailCard({
  sessions,
  scheduled,
  programName,
}: DayDetailCardProps) {
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
      {scheduled && scheduled.status !== "completed" && (
        <ScheduledDayCard scheduled={scheduled} programName={programName} />
      )}
      {sessions.length === 0 && !scheduled && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <Dumbbell className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No workout this day</p>
            <Link href="/workout" className="mt-3">
              <Button variant="outline" size="sm">
                Start Workout
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

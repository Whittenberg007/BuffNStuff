"use client";

import { Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Challenge, ChallengeType, ChallengeStatus } from "@/types";

const TYPE_BADGE_COLORS: Record<ChallengeType, string> = {
  total_volume: "bg-blue-600/20 text-blue-400",
  total_workouts: "bg-green-600/20 text-green-400",
  streak: "bg-orange-600/20 text-orange-400",
  total_sets: "bg-purple-600/20 text-purple-400",
  total_reps: "bg-pink-600/20 text-pink-400",
};

const TYPE_LABELS: Record<ChallengeType, string> = {
  total_volume: "Volume",
  total_workouts: "Workouts",
  streak: "Streak",
  total_sets: "Sets",
  total_reps: "Reps",
};

const STATUS_BADGE_COLORS: Record<ChallengeStatus, string> = {
  upcoming: "bg-yellow-600/20 text-yellow-400",
  active: "bg-green-600/20 text-green-400",
  completed: "bg-zinc-600/20 text-zinc-400",
};

const STATUS_LABELS: Record<ChallengeStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
};

interface ChallengeCardProps {
  challenge: Challenge;
  onView: () => void;
}

export function ChallengeCard({ challenge, onView }: ChallengeCardProps) {
  const startFormatted = format(parseISO(challenge.start_date), "MMM d");
  const endFormatted = format(parseISO(challenge.end_date), "MMM d");

  return (
    <Card
      className="py-4 cursor-pointer transition-colors hover:bg-zinc-900/50"
      onClick={onView}
    >
      <CardContent className="px-4 space-y-3">
        {/* Title and badges */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">
            {challenge.title}
          </h3>
          <Badge className={`${STATUS_BADGE_COLORS[challenge.status]} text-[10px] shrink-0 border-0`}>
            {STATUS_LABELS[challenge.status]}
          </Badge>
        </div>

        {/* Type badge and date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${TYPE_BADGE_COLORS[challenge.challenge_type]} text-[10px] border-0`}>
            {TYPE_LABELS[challenge.challenge_type]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {startFormatted} &mdash; {endFormatted}
          </span>
        </div>

        {/* Description */}
        {challenge.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {challenge.description}
          </p>
        )}

        {/* Footer: participants, score, creator */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {challenge.participant_count ?? 0} participant
              {(challenge.participant_count ?? 0) !== 1 ? "s" : ""}
            </span>
            {challenge.creator && (
              <span>
                by {challenge.creator.display_name || challenge.creator.username}
              </span>
            )}
          </div>
          {challenge.my_score !== undefined && (
            <span className="font-medium text-zinc-100">
              Score: {challenge.my_score.toLocaleString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

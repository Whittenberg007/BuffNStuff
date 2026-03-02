"use client";

import { Trophy, Medal, Award } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChallengeParticipant, ChallengeType } from "@/types";

const RANK_ICONS = [
  { icon: Trophy, color: "text-yellow-400" },
  { icon: Medal, color: "text-zinc-300" },
  { icon: Award, color: "text-amber-600" },
];

function formatScore(score: number, challengeType: ChallengeType): string {
  switch (challengeType) {
    case "total_volume":
      return `${score.toLocaleString()} lbs`;
    case "total_workouts":
      return `${score.toLocaleString()} workout${score !== 1 ? "s" : ""}`;
    case "streak":
      return `${score.toLocaleString()} day${score !== 1 ? "s" : ""}`;
    case "total_sets":
      return `${score.toLocaleString()} set${score !== 1 ? "s" : ""}`;
    case "total_reps":
      return `${score.toLocaleString()} reps`;
    default:
      return score.toLocaleString();
  }
}

function getInitials(participant: ChallengeParticipant): string {
  if (participant.profile?.display_name) {
    return participant.profile.display_name.slice(0, 2).toUpperCase();
  }
  if (participant.profile?.username) {
    return participant.profile.username.slice(0, 2).toUpperCase();
  }
  return "??";
}

function getDisplayName(participant: ChallengeParticipant): string {
  return (
    participant.profile?.display_name ||
    participant.profile?.username ||
    "Unknown"
  );
}

interface LeaderboardProps {
  participants: ChallengeParticipant[];
  challengeType: ChallengeType;
  currentUserId?: string;
}

export function Leaderboard({
  participants,
  challengeType,
  currentUserId,
}: LeaderboardProps) {
  // Sort by score descending (should already be sorted, but ensure)
  const sorted = [...participants].sort(
    (a, b) => b.current_score - a.current_score
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No participants yet. Be the first to join!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((participant, index) => {
        const rank = index + 1;
        const isCurrentUser = currentUserId === participant.user_id;
        const rankIcon = RANK_ICONS[index];

        return (
          <div
            key={participant.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
              isCurrentUser ? "bg-zinc-800" : ""
            }`}
          >
            {/* Rank */}
            <div className="flex items-center justify-center w-7 shrink-0">
              {rankIcon ? (
                <rankIcon.icon className={`size-5 ${rankIcon.color}`} />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  {rank}
                </span>
              )}
            </div>

            {/* Avatar */}
            <Avatar className="size-8 shrink-0">
              {participant.profile?.avatar_url && (
                <AvatarImage
                  src={participant.profile.avatar_url}
                  alt={getDisplayName(participant)}
                />
              )}
              <AvatarFallback className="text-xs">
                {getInitials(participant)}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <span className="flex-1 text-sm font-medium truncate">
              {getDisplayName(participant)}
              {isCurrentUser && (
                <span className="text-muted-foreground font-normal ml-1">
                  (you)
                </span>
              )}
            </span>

            {/* Score */}
            <span className="text-sm font-semibold text-zinc-100 shrink-0">
              {formatScore(participant.current_score, challengeType)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

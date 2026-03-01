"use client";

import { Trophy, Medal, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserProfile } from "@/types";

const RANK_ICONS = [
  { icon: Trophy, color: "text-yellow-400" },
  { icon: Medal, color: "text-zinc-300" },
  { icon: Award, color: "text-amber-600" },
];

interface LeaderboardEntry {
  profile?: UserProfile;
  score: number;
}

interface LeaderboardCardProps {
  title: string;
  icon: React.ReactNode;
  entries: LeaderboardEntry[];
  formatScore: (score: number) => string;
}

function getInitials(profile?: UserProfile): string {
  if (profile?.display_name) {
    return profile.display_name.slice(0, 2).toUpperCase();
  }
  if (profile?.username) {
    return profile.username.slice(0, 2).toUpperCase();
  }
  return "??";
}

function getDisplayName(profile?: UserProfile): string {
  return profile?.display_name || profile?.username || "Unknown";
}

export function LeaderboardCard({
  title,
  icon,
  entries,
  formatScore,
}: LeaderboardCardProps) {
  const topFive = entries.slice(0, 5);
  const hasMore = entries.length > 5;

  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-2">
        {topFive.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No entries yet
          </p>
        ) : (
          <div className="space-y-1">
            {topFive.map((entry, index) => {
              const rank = index + 1;
              const rankIcon = RANK_ICONS[index];

              return (
                <div
                  key={entry.profile?.id ?? index}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center w-6 shrink-0">
                    {rankIcon ? (
                      <rankIcon.icon className={`size-4 ${rankIcon.color}`} />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar className="size-6 shrink-0">
                    {entry.profile?.avatar_url && (
                      <AvatarImage
                        src={entry.profile.avatar_url}
                        alt={getDisplayName(entry.profile)}
                      />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(entry.profile)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name */}
                  <span className="flex-1 text-xs font-medium truncate">
                    {getDisplayName(entry.profile)}
                  </span>

                  {/* Score */}
                  <span className="text-xs font-semibold text-zinc-100 shrink-0">
                    {formatScore(entry.score)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <p className="text-xs text-muted-foreground text-center mt-2 cursor-pointer hover:text-zinc-300 transition-colors">
            View All ({entries.length})
          </p>
        )}
      </CardContent>
    </Card>
  );
}

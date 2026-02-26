"use client";

import { useEffect, useState } from "react";
import {
  Flame,
  Trophy,
  Crown,
  Medal,
  Target,
  Zap,
  TrendingUp,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getUserBadges } from "@/lib/training/badges";
import { BADGE_DEFINITIONS } from "@/lib/training/badges";
import type { UserBadge } from "@/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame,
  Trophy,
  Crown,
  Medal,
  Target,
  Zap,
  TrendingUp,
};

const ICON_COLORS: Record<string, string> = {
  Flame: "text-orange-500",
  Trophy: "text-yellow-500",
  Crown: "text-purple-500",
  Medal: "text-blue-500",
  Target: "text-green-500",
  Zap: "text-cyan-500",
  TrendingUp: "text-emerald-500",
};

const BG_COLORS: Record<string, string> = {
  Flame: "bg-orange-500/10",
  Trophy: "bg-yellow-500/10",
  Crown: "bg-purple-500/10",
  Medal: "bg-blue-500/10",
  Target: "bg-green-500/10",
  Zap: "bg-cyan-500/10",
  TrendingUp: "bg-emerald-500/10",
};

export function BadgesDisplay() {
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const badges = await getUserBadges();
        setEarnedBadges(badges);
      } catch {
        // User may not be authenticated yet
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <Card className="py-4">
        <CardContent className="px-4">
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const earnedTypes = new Set(earnedBadges.map((b) => b.badge_type));

  // Determine which badges were earned recently (within last 24 hours)
  const recentTypes = new Set(
    earnedBadges
      .filter((b) => {
        const earnedAt = new Date(b.earned_at);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return earnedAt > dayAgo;
      })
      .map((b) => b.badge_type)
  );

  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <h3 className="text-sm font-semibold mb-3">Badges</h3>
        <div className="grid grid-cols-5 gap-2">
          {BADGE_DEFINITIONS.map((badge) => {
            const isEarned = earnedTypes.has(badge.type);
            const isRecent = recentTypes.has(badge.type);
            const IconComponent = ICON_MAP[badge.icon];
            const iconColor = ICON_COLORS[badge.icon] || "text-primary";
            const bgColor = BG_COLORS[badge.icon] || "bg-primary/10";

            return (
              <div
                key={badge.type}
                className="flex flex-col items-center gap-1 group"
                title={isEarned ? `${badge.name}: ${badge.description}` : badge.description}
              >
                <div
                  className={`relative flex size-10 items-center justify-center rounded-full transition-all ${
                    isEarned
                      ? `${bgColor} ${isRecent ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-background shadow-[0_0_8px_rgba(251,191,36,0.4)]" : ""}`
                      : "bg-muted"
                  }`}
                >
                  {isEarned && IconComponent ? (
                    <IconComponent className={`size-5 ${iconColor}`} />
                  ) : (
                    <Lock className="size-4 text-muted-foreground/50" />
                  )}
                </div>
                <span
                  className={`text-[10px] text-center leading-tight line-clamp-2 ${
                    isEarned ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  {badge.name}
                </span>
              </div>
            );
          })}
        </div>

        {earnedBadges.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Complete workouts to earn badges!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

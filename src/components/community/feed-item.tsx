"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReactionBar } from "./reaction-bar";
import { formatDistanceToNow } from "date-fns";
import {
  Dumbbell,
  Trophy,
  Flame,
  Award,
  Scale,
} from "lucide-react";
import type { ActivityFeedItem, FeedEventType } from "@/types";
import Link from "next/link";

interface FeedItemProps {
  item: ActivityFeedItem;
  currentUserId: string;
  onReactionChange: () => void;
}

function getEventIcon(type: FeedEventType) {
  switch (type) {
    case "workout_completed":
      return <Dumbbell className="size-4 text-blue-500" />;
    case "pr_hit":
      return <Trophy className="size-4 text-yellow-500" />;
    case "streak_milestone":
      return <Flame className="size-4 text-orange-500" />;
    case "badge_earned":
      return <Award className="size-4 text-purple-500" />;
    case "weight_milestone":
      return <Scale className="size-4 text-green-500" />;
  }
}

function getEventText(item: ActivityFeedItem): string {
  const name = item.profile?.display_name || item.profile?.username || "Someone";
  const d = item.event_data as Record<string, string | number | undefined>;

  switch (item.event_type) {
    case "workout_completed":
      return `${name} finished ${d.split_type || "a workout"} — ${d.total_sets} sets, ${d.total_volume} lbs volume`;
    case "pr_hit":
      return `${name} hit a PR! ${d.exercise_name}: ${d.weight} ${d.unit || "lbs"} × ${d.reps}`;
    case "streak_milestone":
      return `${name} reached a ${d.streak_count}-day workout streak`;
    case "badge_earned":
      return `${name} earned ${d.badge_label}`;
    case "weight_milestone":
      return `${name} hit a weight goal!`;
    default:
      return `${name} did something awesome`;
  }
}

export function FeedItem({ item, currentUserId, onReactionChange }: FeedItemProps) {
  const initials = (item.profile?.display_name || item.profile?.username || "?")
    .slice(0, 2)
    .toUpperCase();

  const timeAgo = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
  });

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Link href={`/community/user?id=${item.profile?.id}`}>
            <Avatar className="size-10">
              {item.profile?.avatar_url && (
                <AvatarImage
                  src={item.profile.avatar_url}
                  alt={item.profile.username}
                />
              )}
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {getEventIcon(item.event_type)}
              <p className="text-sm">{getEventText(item)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>

            <div className="mt-2">
              <ReactionBar
                activityId={item.id}
                reactions={item.reactions || []}
                currentUserId={currentUserId}
                onReactionChange={onReactionChange}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import {
  Clock,
  UserPlus,
  UserCheck,
  Heart,
  Swords,
  Crown,
  Trophy,
  Award,
  Flame,
  Target,
  X,
  BellOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import type { AppNotification, NotificationType } from "@/types";

interface NotificationListProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const ICON_MAP: Record<
  NotificationType,
  { icon: React.ElementType; className: string }
> = {
  workout_reminder: { icon: Clock, className: "text-blue-400" },
  follow_request: { icon: UserPlus, className: "text-green-400" },
  follow_accepted: { icon: UserCheck, className: "text-green-400" },
  reaction_received: { icon: Heart, className: "text-pink-400" },
  challenge_invite: { icon: Swords, className: "text-orange-400" },
  challenge_won: { icon: Crown, className: "text-yellow-400" },
  pr_hit: { icon: Trophy, className: "text-yellow-400" },
  badge_earned: { icon: Award, className: "text-purple-400" },
  streak_milestone: { icon: Flame, className: "text-orange-400" },
  goal_completed: { icon: Target, className: "text-green-400" },
};

export function NotificationList({
  notifications,
  onMarkRead,
  onDelete,
}: NotificationListProps) {
  const router = useRouter();

  function handleClick(notification: AppNotification) {
    onMarkRead(notification.id);
    if (notification.data?.link) {
      router.push(notification.data.link);
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BellOff className="size-10 mb-3 opacity-50" />
        <p className="text-sm">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notification) => {
        const { icon: Icon, className: iconClassName } =
          ICON_MAP[notification.type] ?? {
            icon: Clock,
            className: "text-muted-foreground",
          };

        return (
          <div
            key={notification.id}
            className={`relative flex items-start gap-3 rounded-lg p-3 transition-colors cursor-pointer ${
              notification.is_read
                ? "opacity-60"
                : "bg-zinc-900/50 border-l-2 border-primary"
            }`}
            onClick={() => handleClick(notification)}
          >
            <div className="mt-0.5 shrink-0">
              <Icon className={`size-5 ${iconClassName}`} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{notification.title}</p>
              <p className="text-sm text-muted-foreground">
                {notification.body}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 size-7"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

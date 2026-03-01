"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { addReaction, removeReaction } from "@/lib/database/feed";
import { isNative } from "@/lib/capacitor/platform";
import type { Reaction } from "@/types";

const EMOJIS = ["💪", "🔥", "🎉", "👏", "🏆"] as const;

interface ReactionBarProps {
  activityId: string;
  reactions: Reaction[];
  currentUserId: string;
  onReactionChange: () => void;
}

export function ReactionBar({
  activityId,
  reactions,
  currentUserId,
  onReactionChange,
}: ReactionBarProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myReaction = reactions.find((r) => r.user_id === currentUserId);

  // Count per emoji
  const emojiCounts = new Map<string, number>();
  for (const r of reactions) {
    emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) || 0) + 1);
  }

  async function handleTap(emoji: string) {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (myReaction?.emoji === emoji) {
        await removeReaction(activityId);
      } else {
        await addReaction(activityId, emoji);
      }

      if (isNative()) {
        try {
          const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
          await Haptics.impact({ style: ImpactStyle.Light });
        } catch {
          // Haptics not available
        }
      }

      onReactionChange();
    } catch {
      // Silently fail
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {EMOJIS.map((emoji) => {
        const count = emojiCounts.get(emoji) || 0;
        const isSelected = myReaction?.emoji === emoji;

        return (
          <Button
            key={emoji}
            variant={isSelected ? "secondary" : "ghost"}
            size="sm"
            className={`h-7 px-2 text-xs gap-1 ${
              isSelected ? "ring-1 ring-primary" : ""
            }`}
            onClick={() => handleTap(emoji)}
            disabled={isSubmitting}
          >
            <span>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </Button>
        );
      })}
    </div>
  );
}

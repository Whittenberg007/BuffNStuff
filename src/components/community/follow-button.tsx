"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, UserCheck, Clock } from "lucide-react";
import { followUser, unfollowUser, getFollowStatus } from "@/lib/database/follows";
import { toast } from "sonner";

interface FollowButtonProps {
  targetProfileId: string;
  onFollowChange?: () => void;
}

export function FollowButton({
  targetProfileId,
  onFollowChange,
}: FollowButtonProps) {
  const [status, setStatus] = useState<
    "none" | "pending" | "accepted" | "rejected" | "loading"
  >("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getFollowStatus(targetProfileId).then(setStatus);
  }, [targetProfileId]);

  async function handleFollow() {
    setIsSubmitting(true);
    try {
      await followUser(targetProfileId);
      const newStatus = await getFollowStatus(targetProfileId);
      setStatus(newStatus);
      toast.success(
        newStatus === "accepted" ? "Following!" : "Follow request sent!"
      );
      onFollowChange?.();
    } catch {
      toast.error("Failed to follow user");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnfollow() {
    setIsSubmitting(true);
    try {
      await unfollowUser(targetProfileId);
      setStatus("none");
      toast.success("Unfollowed");
      onFollowChange?.();
    } catch {
      toast.error("Failed to unfollow user");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  if (status === "accepted") {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="gap-1"
        onClick={handleUnfollow}
        disabled={isSubmitting}
      >
        <UserCheck className="size-4" />
        Following
      </Button>
    );
  }

  if (status === "pending") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={handleUnfollow}
        disabled={isSubmitting}
      >
        <Clock className="size-4" />
        Pending
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className="gap-1"
      onClick={handleFollow}
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <UserPlus className="size-4" />
      )}
      Follow
    </Button>
  );
}

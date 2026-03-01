"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  getChallenge,
  getChallengeLeaderboard,
  joinChallenge,
  leaveChallenge,
  hasJoinedChallenge,
} from "@/lib/database/challenges";
import { Leaderboard } from "@/components/challenges/leaderboard";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { Challenge, ChallengeParticipant, ChallengeStatus, ChallengeType } from "@/types";

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

function ViewChallengeContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [joined, setJoined] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const [c, lb, j] = await Promise.all([
        getChallenge(id),
        getChallengeLeaderboard(id),
        hasJoinedChallenge(id),
      ]);
      setChallenge(c);
      setParticipants(lb);
      setJoined(j);
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleJoinLeave() {
    if (!id) return;
    setIsJoining(true);
    try {
      if (joined) {
        await leaveChallenge(id);
      } else {
        await joinChallenge(id);
      }
      await loadData();
    } catch {
      // Silently handle
    } finally {
      setIsJoining(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="text-center py-8">
          <Loader2 className="size-5 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/community/challenges">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Challenge Not Found</h1>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          This challenge could not be found.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/community/challenges">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold truncate flex-1">
          {challenge.title}
        </h1>
      </div>

      {/* Challenge details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className={`${STATUS_BADGE_COLORS[challenge.status]} text-xs border-0`}
          >
            {STATUS_LABELS[challenge.status]}
          </Badge>
          <Badge className="bg-zinc-800 text-zinc-300 text-xs border-0">
            {TYPE_LABELS[challenge.challenge_type]}
          </Badge>
        </div>

        {challenge.description && (
          <p className="text-sm text-muted-foreground">
            {challenge.description}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {format(parseISO(challenge.start_date), "MMM d, yyyy")} &mdash;{" "}
          {format(parseISO(challenge.end_date), "MMM d, yyyy")}
        </p>

        {challenge.creator && (
          <p className="text-xs text-muted-foreground">
            Created by{" "}
            {challenge.creator.display_name || challenge.creator.username}
          </p>
        )}
      </div>

      {/* Join / Leave button */}
      {challenge.status !== "completed" && (
        <Button
          variant={joined ? "outline" : "default"}
          onClick={handleJoinLeave}
          disabled={isJoining}
          className="w-full"
        >
          {isJoining ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : null}
          {joined ? "Leave Challenge" : "Join Challenge"}
        </Button>
      )}

      {/* Leaderboard */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <Leaderboard
          participants={participants}
          challengeType={challenge.challenge_type}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}

export default function ViewChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ViewChallengeContent />
    </Suspense>
  );
}

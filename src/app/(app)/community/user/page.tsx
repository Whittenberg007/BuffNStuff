"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProfileCard } from "@/components/community/profile-card";
import { FollowButton } from "@/components/community/follow-button";
import { getProfileById, getProfileStats } from "@/lib/database/profiles";
import { getFollowerCount, getFollowingCount } from "@/lib/database/follows";
import Link from "next/link";
import type { UserProfile } from "@/types";

function ViewUserContent() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get("id");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    currentStreak: 0,
    badgeCount: 0,
  });
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    try {
      const p = await getProfileById(profileId);
      setProfile(p);

      if (p) {
        const [s, followers, following] = await Promise.all([
          getProfileStats(p.user_id),
          getFollowerCount(p.id),
          getFollowingCount(p.id),
        ]);
        setStats(s);
        setFollowerCount(followers);
        setFollowingCount(following);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="text-center py-8">
          <Loader2 className="size-5 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/community">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">User Not Found</h1>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          This user profile could not be found.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/community">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold truncate flex-1">
          {profile.display_name || profile.username}
        </h1>
        <FollowButton
          targetProfileId={profile.id}
          onFollowChange={loadUser}
        />
      </div>

      <ProfileCard
        profile={profile}
        stats={stats}
        followerCount={followerCount}
        followingCount={followingCount}
      />
    </div>
  );
}

export default function ViewUserPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
          <div className="text-center py-8">
            <Loader2 className="size-5 animate-spin mx-auto" />
          </div>
        </div>
      }
    >
      <ViewUserContent />
    </Suspense>
  );
}

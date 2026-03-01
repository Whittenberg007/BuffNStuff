"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { ProfileCard } from "@/components/community/profile-card";
import { ProfileForm } from "@/components/community/profile-form";
import { getMyProfile, getProfileStats } from "@/lib/database/profiles";
import { getFollowerCount, getFollowingCount } from "@/lib/database/follows";
import Link from "next/link";
import type { UserProfile } from "@/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    currentStreak: 0,
    badgeCount: 0,
  });
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getMyProfile();
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
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function handleProfileSaved(updated: UserProfile) {
    setProfile(updated);
    setIsEditing(false);
    loadProfile();
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="text-center py-8">
          <Loader2 className="size-5 animate-spin mx-auto" />
        </div>
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
        <h1 className="text-2xl font-bold">
          {profile ? "My Profile" : "Create Profile"}
        </h1>
        {profile && !isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>

      {!profile || isEditing ? (
        <ProfileForm
          existingProfile={profile}
          onSaved={handleProfileSaved}
        />
      ) : (
        <ProfileCard
          profile={profile}
          stats={stats}
          followerCount={followerCount}
          followingCount={followingCount}
          isOwnProfile
        />
      )}
    </div>
  );
}

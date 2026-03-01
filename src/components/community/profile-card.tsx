"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Share2, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isNative } from "@/lib/capacitor/platform";
import type { UserProfile } from "@/types";

interface ProfileCardProps {
  profile: UserProfile;
  stats: {
    totalWorkouts: number;
    currentStreak: number;
    badgeCount: number;
  };
  followerCount: number;
  followingCount: number;
  isOwnProfile?: boolean;
}

export function ProfileCard({
  profile,
  stats,
  followerCount,
  followingCount,
  isOwnProfile,
}: ProfileCardProps) {
  const initials = (profile.display_name || profile.username)
    .slice(0, 2)
    .toUpperCase();

  async function handleShareFriendCode() {
    const text = `Add me on BuffNStuff! My friend code: ${profile.friend_code}`;

    if (isNative()) {
      try {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title: "BuffNStuff Friend Code", text });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(text);
    toast.success("Friend code copied to clipboard!");
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-16">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={profile.username} />
            )}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold truncate">
                {profile.display_name || profile.username}
              </h2>
              {profile.is_public ? (
                <Globe className="size-3.5 text-muted-foreground" />
              ) : (
                <Lock className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && (
              <p className="text-sm mt-1">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          <div>
            <p className="text-lg font-bold">{stats.totalWorkouts}</p>
            <p className="text-xs text-muted-foreground">Workouts</p>
          </div>
          <div>
            <p className="text-lg font-bold">{stats.currentStreak}</p>
            <p className="text-xs text-muted-foreground">Streak</p>
          </div>
          <div>
            <p className="text-lg font-bold">{followerCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div>
            <p className="text-lg font-bold">{followingCount}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </div>
        </div>

        {/* Badge count */}
        {stats.badgeCount > 0 && (
          <div className="mt-3">
            <Badge variant="secondary">{stats.badgeCount} badges earned</Badge>
          </div>
        )}

        {/* Friend code (own profile only) */}
        {isOwnProfile && (
          <div className="mt-4 flex items-center gap-2 p-2 rounded-md bg-muted">
            <code className="text-sm font-mono flex-1">
              {profile.friend_code}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleShareFriendCode}
            >
              {isNative() ? (
                <Share2 className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

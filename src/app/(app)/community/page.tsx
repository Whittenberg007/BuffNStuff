"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserCircle, Search, Bell } from "lucide-react";
import { ActivityFeed } from "@/components/community/activity-feed";
import { getMyProfile } from "@/lib/database/profiles";
import { getPendingRequestCount } from "@/lib/database/follows";
import Link from "next/link";
import type { UserProfile } from "@/types";

export default function CommunityPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, count] = await Promise.all([
          getMyProfile(),
          getPendingRequestCount(),
        ]);
        setProfile(p);
        setPendingCount(count);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="text-center py-8 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  // No profile yet — prompt to create one
  if (!profile) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="text-sm text-muted-foreground">
            Connect with your gym buddies
          </p>
        </div>
        <div className="text-center py-12 space-y-4">
          <UserCircle className="size-16 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">Set up your profile to get started</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a community profile to follow friends and share your
              progress.
            </p>
          </div>
          <Link href="/community/profile">
            <Button>Create Profile</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="text-sm text-muted-foreground">
            See what your friends are up to
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/community/requests">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full size-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/community/find">
            <Button variant="ghost" size="icon">
              <Search className="size-5" />
            </Button>
          </Link>
          <Link href="/community/profile">
            <Button variant="ghost" size="icon">
              <UserCircle className="size-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Feed */}
      <ActivityFeed />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2 } from "lucide-react";
import {
  getProfileByUsername,
  getProfileByFriendCode,
} from "@/lib/database/profiles";
import { FollowButton } from "./follow-button";
import Link from "next/link";
import type { UserProfile } from "@/types";

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<UserProfile | null | undefined>(
    undefined
  );
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setResult(undefined);

    try {
      let profile: UserProfile | null = null;

      // Check if it looks like a friend code (BUFF-XXXX format)
      if (/^BUFF-[A-Z0-9]{4}$/i.test(trimmed)) {
        profile = await getProfileByFriendCode(trimmed);
      } else {
        profile = await getProfileByUsername(trimmed);
      }

      setResult(profile);
    } catch {
      setResult(null);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Username or friend code (BUFF-XXXX)"
          className="flex-1"
        />
        <Button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </Button>
      </form>

      {result === null && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No user found. Try a different username or friend code.
        </p>
      )}

      {result && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Link href={`/community/user?id=${result.id}`}>
                <Avatar className="size-10">
                  {result.avatar_url && (
                    <AvatarImage
                      src={result.avatar_url}
                      alt={result.username}
                    />
                  )}
                  <AvatarFallback>
                    {(result.display_name || result.username)
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/community/user?id=${result.id}`}>
                  <p className="font-medium truncate">
                    {result.display_name || result.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    @{result.username}
                  </p>
                </Link>
              </div>
              <FollowButton targetProfileId={result.id} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

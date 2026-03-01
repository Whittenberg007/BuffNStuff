"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { FeedItem } from "./feed-item";
import { getFeed } from "@/lib/database/feed";
import { createClient } from "@/lib/supabase/client";
import type { ActivityFeedItem } from "@/types";

const PAGE_SIZE = 20;

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");

  const loadFeed = useCallback(async (reset = false) => {
    if (reset) setIsLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const offset = reset ? 0 : items.length;
      const newItems = await getFeed(PAGE_SIZE, offset);

      if (reset) {
        setItems(newItems);
      } else {
        setItems((prev) => [...prev, ...newItems]);
      }
      setHasMore(newItems.length === PAGE_SIZE);
    } catch {
      // Silently handle errors
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [items.length]);

  useEffect(() => {
    loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRefresh() {
    loadFeed(true);
  }

  function handleLoadMore() {
    setIsLoadingMore(true);
    loadFeed(false);
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mx-auto mb-2" />
        Loading feed...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={handleRefresh}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No activity yet. Follow some friends to see their workouts here!
        </div>
      ) : (
        <>
          {items.map((item) => (
            <FeedItem
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              onReactionChange={() => loadFeed(true)}
            />
          ))}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              Load More
            </Button>
          )}
        </>
      )}
    </div>
  );
}

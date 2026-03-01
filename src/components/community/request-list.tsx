"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import {
  getPendingRequests,
  acceptFollowRequest,
  rejectFollowRequest,
} from "@/lib/database/follows";
import { toast } from "sonner";
import Link from "next/link";
import type { Follow, UserProfile } from "@/types";

export function RequestList() {
  const [requests, setRequests] = useState<
    (Follow & { follower: UserProfile })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const data = await getPendingRequests();
      setRequests(data);
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleAccept(followId: string) {
    setProcessingId(followId);
    try {
      await acceptFollowRequest(followId);
      toast.success("Follow request accepted!");
      await loadRequests();
    } catch {
      toast.error("Failed to accept request");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(followId: string) {
    setProcessingId(followId);
    try {
      await rejectFollowRequest(followId);
      toast.success("Follow request rejected");
      await loadRequests();
    } catch {
      toast.error("Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mx-auto mb-2" />
        Loading requests...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No pending follow requests.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <Card key={req.id}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Link href={`/community/user?id=${req.follower.id}`}>
                <Avatar className="size-10">
                  {req.follower.avatar_url && (
                    <AvatarImage
                      src={req.follower.avatar_url}
                      alt={req.follower.username}
                    />
                  )}
                  <AvatarFallback>
                    {(req.follower.display_name || req.follower.username)
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {req.follower.display_name || req.follower.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{req.follower.username}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="default"
                  className="size-8"
                  onClick={() => handleAccept(req.id)}
                  disabled={processingId === req.id}
                >
                  {processingId === req.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => handleReject(req.id)}
                  disabled={processingId === req.id}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

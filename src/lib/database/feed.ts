import { createClient } from "@/lib/supabase/client";
import type { ActivityFeedItem, FeedEventType, Reaction } from "@/types";

export async function createFeedEvent(
  eventType: FeedEventType,
  eventData: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Only create events if user has a profile (opt-in)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return;

  await supabase.from("activity_feed").insert({
    user_id: user.id,
    event_type: eventType,
    event_data: eventData,
  });
}

export async function getFeed(
  limit: number = 20,
  offset: number = 0
): Promise<ActivityFeedItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Get my profile ID
  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!myProfile) return [];

  // Get IDs of users I follow (accepted only)
  const { data: following } = await supabase
    .from("follows")
    .select("following_id, following:user_profiles!follows_following_id_fkey(user_id)")
    .eq("follower_id", myProfile.id)
    .eq("status", "accepted");

  if (!following?.length) return [];

  const followedUserIds = following
    .map((f) => (f.following as unknown as { user_id: string })?.user_id)
    .filter(Boolean);

  if (!followedUserIds.length) return [];

  // Fetch feed items from followed users
  const { data: items, error } = await supabase
    .from("activity_feed")
    .select("*")
    .in("user_id", followedUserIds)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  if (!items?.length) return [];

  // Fetch profiles for these items
  const userIds = [...new Set(items.map((i) => i.user_id))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("*")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  );

  // Fetch reactions for these items
  const itemIds = items.map((i) => i.id);
  const { data: reactions } = await supabase
    .from("reactions")
    .select("*")
    .in("activity_id", itemIds);

  const reactionMap = new Map<string, Reaction[]>();
  for (const r of reactions || []) {
    if (!reactionMap.has(r.activity_id)) reactionMap.set(r.activity_id, []);
    reactionMap.get(r.activity_id)!.push(r as Reaction);
  }

  return items.map((item) => ({
    ...item,
    profile: profileMap.get(item.user_id) || undefined,
    reactions: reactionMap.get(item.id) || [],
  })) as ActivityFeedItem[];
}

export async function addReaction(
  activityId: string,
  emoji: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("reactions").upsert(
    {
      activity_id: activityId,
      user_id: user.id,
      emoji,
    },
    { onConflict: "activity_id,user_id" }
  );

  if (error) throw error;
}

export async function removeReaction(activityId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("reactions")
    .delete()
    .eq("activity_id", activityId)
    .eq("user_id", user.id);

  if (error) throw error;
}

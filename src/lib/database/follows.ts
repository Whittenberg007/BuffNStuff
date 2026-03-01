import { createClient } from "@/lib/supabase/client";
import type { Follow, UserProfile } from "@/types";

export async function getMyProfileId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return data?.id || null;
}

export async function followUser(targetProfileId: string): Promise<Follow> {
  const supabase = createClient();
  const myProfileId = await getMyProfileId();
  if (!myProfileId) throw new Error("Profile not set up");

  // Check if target is public
  const { data: targetProfile } = await supabase
    .from("user_profiles")
    .select("is_public")
    .eq("id", targetProfileId)
    .single();

  const status = targetProfile?.is_public ? "accepted" : "pending";

  const { data, error } = await supabase
    .from("follows")
    .insert({
      follower_id: myProfileId,
      following_id: targetProfileId,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Follow;
}

export async function unfollowUser(targetProfileId: string): Promise<void> {
  const supabase = createClient();
  const myProfileId = await getMyProfileId();
  if (!myProfileId) throw new Error("Profile not set up");

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", myProfileId)
    .eq("following_id", targetProfileId);

  if (error) throw error;
}

export async function acceptFollowRequest(followId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("id", followId);

  if (error) throw error;
}

export async function rejectFollowRequest(followId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("follows")
    .update({ status: "rejected" })
    .eq("id", followId);

  if (error) throw error;
}

export async function getFollowStatus(
  targetProfileId: string
): Promise<"none" | "pending" | "accepted" | "rejected"> {
  const supabase = createClient();
  const myProfileId = await getMyProfileId();
  if (!myProfileId) return "none";

  const { data } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", myProfileId)
    .eq("following_id", targetProfileId)
    .single();

  return (data?.status as Follow["status"]) || "none";
}

export async function getPendingRequests(): Promise<
  (Follow & { follower: UserProfile })[]
> {
  const supabase = createClient();
  const myProfileId = await getMyProfileId();
  if (!myProfileId) return [];

  const { data, error } = await supabase
    .from("follows")
    .select("*, follower:user_profiles!follows_follower_id_fkey(*)")
    .eq("following_id", myProfileId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as (Follow & { follower: UserProfile })[];
}

export async function getPendingRequestCount(): Promise<number> {
  const supabase = createClient();
  const myProfileId = await getMyProfileId();
  if (!myProfileId) return 0;

  const { count, error } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", myProfileId)
    .eq("status", "pending");

  if (error) return 0;
  return count || 0;
}

export async function getFollowerCount(profileId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", profileId)
    .eq("status", "accepted");

  return count || 0;
}

export async function getFollowingCount(profileId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", profileId)
    .eq("status", "accepted");

  return count || 0;
}

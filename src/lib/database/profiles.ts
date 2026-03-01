import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";

function generateFriendCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BUFF-${code}`;
}

export async function getMyProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as UserProfile;
}

export async function createProfile(input: {
  username: string;
  display_name?: string;
  bio?: string;
  is_public?: boolean;
}): Promise<UserProfile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      user_id: user.id,
      username: input.username.toLowerCase().trim(),
      display_name: input.display_name || null,
      bio: input.bio || null,
      is_public: input.is_public ?? false,
      friend_code: generateFriendCode(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function updateProfile(
  profileId: string,
  updates: Partial<Pick<UserProfile, "display_name" | "bio" | "avatar_url" | "is_public">>
): Promise<UserProfile> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", profileId)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("username", username.toLowerCase().trim())
    .single();

  return !data;
}

export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("username", username.toLowerCase().trim())
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as UserProfile;
}

export async function getProfileByFriendCode(code: string): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("friend_code", code.toUpperCase().trim())
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as UserProfile;
}

export async function getProfileById(profileId: string): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as UserProfile;
}

export async function getProfileStats(userId: string): Promise<{
  totalWorkouts: number;
  currentStreak: number;
  badgeCount: number;
}> {
  const supabase = createClient();

  const [workoutsRes, badgesRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("ended_at", "is", null),
    supabase
      .from("user_badges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  // Import getCurrentStreak dynamically to avoid circular deps
  const { getCurrentStreak } = await import("@/lib/database/stats");
  const currentStreak = await getCurrentStreak();

  return {
    totalWorkouts: workoutsRes.count || 0,
    currentStreak,
    badgeCount: badgesRes.count || 0,
  };
}

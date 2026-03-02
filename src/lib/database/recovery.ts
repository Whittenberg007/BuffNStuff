import { createClient } from "@/lib/supabase/client";
import { subDays, format } from "date-fns";
import type { ReadinessCheckin } from "@/types";

// Save or update a readiness check-in for today
export async function saveReadinessCheckin(params: {
  sessionId?: string;
  sleepQuality: number | null;
  soreness: number | null;
  energy: number | null;
}): Promise<ReadinessCheckin> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = format(new Date(), "yyyy-MM-dd");

  // Upsert: check if one already exists for today
  const { data: existing } = await supabase
    .from("readiness_checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("readiness_checkins")
      .update({
        session_id: params.sessionId || null,
        sleep_quality: params.sleepQuality,
        soreness: params.soreness,
        energy: params.energy,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ReadinessCheckin;
  }

  const { data, error } = await supabase
    .from("readiness_checkins")
    .insert({
      user_id: user.id,
      session_id: params.sessionId || null,
      date: today,
      sleep_quality: params.sleepQuality,
      soreness: params.soreness,
      energy: params.energy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ReadinessCheckin;
}

// Get recent readiness check-ins
export async function getRecentCheckins(
  days: number = 30
): Promise<ReadinessCheckin[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const since = format(subDays(new Date(), days), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("readiness_checkins")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", since)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as ReadinessCheckin[];
}

// Get today's check-in (if any)
export async function getTodayCheckin(): Promise<ReadinessCheckin | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("readiness_checkins")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  return (data as ReadinessCheckin) || null;
}

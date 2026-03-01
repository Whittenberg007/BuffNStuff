import { createClient } from "@/lib/supabase/client";
import { subDays, format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import type { UserBadge } from "@/types";

export interface BadgeDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    type: "iron_streak_3",
    name: "Iron Streak (3)",
    description: "3-day workout streak",
    icon: "Flame",
  },
  {
    type: "iron_streak_7",
    name: "Iron Streak (7)",
    description: "7-day workout streak",
    icon: "Flame",
  },
  {
    type: "iron_streak_14",
    name: "Iron Streak (14)",
    description: "14-day workout streak",
    icon: "Flame",
  },
  {
    type: "iron_streak_30",
    name: "Iron Streak (30)",
    description: "30-day workout streak",
    icon: "Flame",
  },
  {
    type: "pr_hunter",
    name: "PR Hunter",
    description: "Hit a new personal record",
    icon: "Trophy",
  },
  {
    type: "volume_king",
    name: "Volume King",
    description: "New weekly volume record",
    icon: "Crown",
  },
  {
    type: "consistency_crown",
    name: "Consistency Crown",
    description: "4+ workouts/week for a full month",
    icon: "Medal",
  },
  {
    type: "protein_perfect",
    name: "Protein Perfect",
    description: "Hit protein target 7 days straight",
    icon: "Target",
  },
  {
    type: "century_club",
    name: "Century Club",
    description: "Complete a 100-rep set",
    icon: "Zap",
  },
  {
    type: "plateau_breaker",
    name: "Plateau Breaker",
    description: "Break through a flagged plateau",
    icon: "TrendingUp",
  },
];

// Get user's earned badges
export async function getUserBadges(): Promise<UserBadge[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", user.id)
    .order("earned_at", { ascending: false });

  if (error) throw error;
  return data as UserBadge[];
}

// Award a badge to a user (internal helper)
async function awardBadge(
  userId: string,
  badgeType: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createClient();
  await supabase.from("user_badges").insert({
    user_id: userId,
    badge_type: badgeType,
    earned_at: new Date().toISOString(),
    context,
  });

  // Create feed event for badge earned
  try {
    const badge = BADGE_DEFINITIONS.find((b) => b.type === badgeType);
    const { createFeedEvent } = await import("@/lib/database/feed");
    await createFeedEvent("badge_earned", {
      badge_type: badgeType,
      badge_label: badge?.name || badgeType,
    });
  } catch {
    // Feed event should never block badge award
  }
}

// Check and award badges — returns newly earned badge types
export async function evaluateBadges(userId: string): Promise<string[]> {
  const supabase = createClient();
  const newlyEarned: string[] = [];

  // Fetch already-earned badge types
  const { data: existing } = await supabase
    .from("user_badges")
    .select("badge_type")
    .eq("user_id", userId);

  const earnedSet = new Set((existing || []).map((b) => b.badge_type));

  // --- Streak badges ---
  const streak = await computeStreak(userId);
  const streakThresholds = [
    { threshold: 3, type: "iron_streak_3" },
    { threshold: 7, type: "iron_streak_7" },
    { threshold: 14, type: "iron_streak_14" },
    { threshold: 30, type: "iron_streak_30" },
  ];

  for (const { threshold, type } of streakThresholds) {
    if (streak >= threshold && !earnedSet.has(type)) {
      await awardBadge(userId, type, { streak });
      newlyEarned.push(type);
      earnedSet.add(type);
    }
  }

  // Create feed event for streak milestones (even if badge already earned)
  try {
    const STREAK_MILESTONES = [7, 14, 30, 60, 90];
    if (STREAK_MILESTONES.includes(streak)) {
      const { createFeedEvent } = await import("@/lib/database/feed");
      await createFeedEvent("streak_milestone", {
        streak_count: streak,
      });
    }
  } catch {
    // Feed event should never block badge evaluation
  }

  // --- PR Hunter: check if any PRs were logged today ---
  if (!earnedSet.has("pr_hunter")) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: prSets } = await supabase
      .from("workout_sets")
      .select("id, session:workout_sessions!inner(user_id)")
      .eq("is_pr", true)
      .eq("workout_sessions.user_id", userId)
      .gte("logged_at", todayStart.toISOString())
      .limit(1);

    if (prSets && prSets.length > 0) {
      await awardBadge(userId, "pr_hunter", {
        date: format(new Date(), "yyyy-MM-dd"),
      });
      newlyEarned.push("pr_hunter");
      earnedSet.add("pr_hunter");
    }
  }

  // --- Century Club: any set with 100+ reps ---
  if (!earnedSet.has("century_club")) {
    const { data: centurySets } = await supabase
      .from("workout_sets")
      .select("id, session:workout_sessions!inner(user_id)")
      .eq("workout_sessions.user_id", userId)
      .gte("reps", 100)
      .limit(1);

    if (centurySets && centurySets.length > 0) {
      await awardBadge(userId, "century_club");
      newlyEarned.push("century_club");
      earnedSet.add("century_club");
    }
  }

  // --- Volume King: check if this week's total volume is a new record ---
  if (!earnedSet.has("volume_king")) {
    const isVolumeRecord = await checkWeeklyVolumeRecord(userId);
    if (isVolumeRecord) {
      await awardBadge(userId, "volume_king", {
        week: format(new Date(), "yyyy-'W'ww"),
      });
      newlyEarned.push("volume_king");
      earnedSet.add("volume_king");
    }
  }

  // --- Consistency Crown: 4+ workouts/week for 4 consecutive weeks ---
  if (!earnedSet.has("consistency_crown")) {
    const isConsistent = await checkMonthlyConsistency(userId);
    if (isConsistent) {
      await awardBadge(userId, "consistency_crown");
      newlyEarned.push("consistency_crown");
      earnedSet.add("consistency_crown");
    }
  }

  return newlyEarned;
}

// Compute the current workout streak for a user
async function computeStreak(userId: string): Promise<number> {
  const supabase = createClient();
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(90);

  if (!sessions?.length) return 0;

  const workoutDays = new Set(
    sessions.map((s) => format(new Date(s.started_at), "yyyy-MM-dd"))
  );

  let streak = 0;
  let checkDate = new Date();

  if (!workoutDays.has(format(checkDate, "yyyy-MM-dd"))) {
    checkDate = subDays(checkDate, 1);
  }

  while (workoutDays.has(format(checkDate, "yyyy-MM-dd"))) {
    streak++;
    checkDate = subDays(checkDate, 1);
  }

  return streak;
}

// Check if current week's volume is a new all-time record
async function checkWeeklyVolumeRecord(userId: string): Promise<boolean> {
  const supabase = createClient();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Get this week's sessions
  const { data: currentSessions } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .gte("started_at", weekStart.toISOString())
    .lte("started_at", weekEnd.toISOString())
    .not("ended_at", "is", null);

  if (!currentSessions?.length) return false;

  const currentIds = currentSessions.map((s) => s.id);
  const { data: currentSets } = await supabase
    .from("workout_sets")
    .select("weight, reps")
    .in("session_id", currentIds);

  const currentVolume =
    currentSets?.reduce((sum, s) => sum + s.weight * s.reps, 0) || 0;

  if (currentVolume === 0) return false;

  // Compare against previous weeks (up to 52 weeks back)
  for (let w = 1; w <= 52; w++) {
    const prevStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const prevEnd = endOfWeek(subWeeks(now, w), { weekStartsOn: 1 });

    const { data: prevSessions } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .gte("started_at", prevStart.toISOString())
      .lte("started_at", prevEnd.toISOString())
      .not("ended_at", "is", null);

    if (!prevSessions?.length) continue;

    const prevIds = prevSessions.map((s) => s.id);
    const { data: prevSets } = await supabase
      .from("workout_sets")
      .select("weight, reps")
      .in("session_id", prevIds);

    const prevVolume =
      prevSets?.reduce((sum, s) => sum + s.weight * s.reps, 0) || 0;

    if (prevVolume >= currentVolume) return false;
  }

  return true;
}

// Check if user has had 4+ workouts per week for the last 4 weeks
async function checkMonthlyConsistency(userId: string): Promise<boolean> {
  const supabase = createClient();
  const now = new Date();

  for (let w = 0; w < 4; w++) {
    const wStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const wEnd = endOfWeek(subWeeks(now, w), { weekStartsOn: 1 });

    const { data: sessions } = await supabase
      .from("workout_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .gte("started_at", wStart.toISOString())
      .lte("started_at", wEnd.toISOString())
      .not("ended_at", "is", null);

    if (!sessions?.length) return false;

    // Count unique training days in this week
    const uniqueDays = new Set(
      sessions.map((s) => format(new Date(s.started_at), "yyyy-MM-dd"))
    );

    if (uniqueDays.size < 4) return false;
  }

  return true;
}

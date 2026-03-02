import { createClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { Challenge, ChallengeParticipant } from "@/types";

// Create a challenge
export async function createChallenge(params: {
  title: string;
  description?: string;
  challenge_type: Challenge["challenge_type"];
  start_date: string;
  end_date: string;
}): Promise<Challenge> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get user's profile ID
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) throw new Error("Profile required to create challenges");

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      creator_id: profile.id,
      title: params.title,
      description: params.description || null,
      challenge_type: params.challenge_type,
      start_date: params.start_date,
      end_date: params.end_date,
      status: new Date(params.start_date) <= new Date() ? "active" : "upcoming",
    })
    .select()
    .single();
  if (error) throw error;

  // Auto-join the creator
  await supabase.from("challenge_participants").insert({
    challenge_id: data.id,
    user_id: user.id,
  });

  try {
    const { createFeedEvent } = await import("@/lib/database/feed");
    await createFeedEvent("challenge_created", {
      challenge_title: params.title,
      challenge_type: params.challenge_type,
      end_date: params.end_date,
    });
  } catch {
    /* feed should never block */
  }

  return data as Challenge;
}

// Get challenges visible to user (own + friends')
export async function getChallenges(
  filter: "active" | "upcoming" | "completed" | "all" = "all"
): Promise<Challenge[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("challenges")
    .select("*, creator:user_profiles!challenges_creator_id_fkey(*)")
    .order("created_at", { ascending: false });

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Attach participant count and user's score
  const challenges = data as Challenge[];
  for (const c of challenges) {
    const { count } = await supabase
      .from("challenge_participants")
      .select("*", { count: "exact", head: true })
      .eq("challenge_id", c.id);
    c.participant_count = count || 0;

    const { data: myPart } = await supabase
      .from("challenge_participants")
      .select("current_score")
      .eq("challenge_id", c.id)
      .eq("user_id", user.id)
      .single();
    c.my_score = myPart?.current_score || undefined;
  }

  return challenges;
}

// Get a single challenge with participants
export async function getChallenge(
  challengeId: string
): Promise<Challenge | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*, creator:user_profiles!challenges_creator_id_fkey(*)")
    .eq("id", challengeId)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as Challenge;
}

// Get challenge leaderboard (participants with scores)
export async function getChallengeLeaderboard(
  challengeId: string
): Promise<ChallengeParticipant[]> {
  const supabase = createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("challenge_type, start_date, end_date")
    .eq("id", challengeId)
    .single();
  if (!challenge) return [];

  const { data: participants, error } = await supabase
    .from("challenge_participants")
    .select("*")
    .eq("challenge_id", challengeId);
  if (error) throw error;
  if (!participants?.length) return [];

  // Compute scores for each participant
  const scored: ChallengeParticipant[] = [];
  for (const p of participants) {
    const score = await computeParticipantScore(
      p.user_id,
      challenge.challenge_type,
      challenge.start_date,
      challenge.end_date
    );

    // Fetch profile for display
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", p.user_id)
      .single();

    scored.push({
      ...p,
      current_score: score,
      profile: profile || undefined,
    } as ChallengeParticipant);
  }

  return scored.sort((a, b) => b.current_score - a.current_score);
}

// Join a challenge
export async function joinChallenge(challengeId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("challenge_participants").insert({
    challenge_id: challengeId,
    user_id: user.id,
  });
  if (error) throw error;

  // Notify challenge creator
  try {
    const { data: challenge } = await supabase
      .from("challenges")
      .select(
        "creator_id, title, creator:user_profiles!challenges_creator_id_fkey(user_id)"
      )
      .eq("id", challengeId)
      .single();
    if (challenge) {
      const creatorUserId = (
        challenge.creator as unknown as { user_id: string }
      )?.user_id;
      if (creatorUserId && creatorUserId !== user.id) {
        const { createNotification } = await import(
          "@/lib/database/notifications"
        );
        await createNotification({
          userId: creatorUserId,
          type: "challenge_invite",
          title: "New challenger!",
          body: `Someone joined your challenge "${challenge.title}"`,
          data: { link: `/community/challenges/view?id=${challengeId}` },
        });
      }
    }
  } catch {
    /* notification should never block */
  }
}

// Leave a challenge
export async function leaveChallenge(challengeId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id);
  if (error) throw error;
}

// Check if user has joined a challenge
export async function hasJoinedChallenge(
  challengeId: string
): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id)
    .single();
  return !!data;
}

// Compute score for a participant based on challenge type
async function computeParticipantScore(
  userId: string,
  type: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = createClient();

  // Get sessions in date range
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", userId)
    .not("ended_at", "is", null)
    .gte("started_at", startDate)
    .lte("started_at", endDate);

  if (!sessions?.length) return 0;

  if (type === "total_workouts") return sessions.length;

  if (type === "streak") {
    const days = [
      ...new Set(sessions.map((s) => s.started_at.split("T")[0])),
    ].sort();
    let maxStreak = 1,
      current = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) {
        current++;
        maxStreak = Math.max(maxStreak, current);
      } else {
        current = 1;
      }
    }
    return maxStreak;
  }

  // Need sets data for volume/sets/reps
  const sessionIds = sessions.map((s) => s.id);
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("weight, reps")
    .in("session_id", sessionIds);
  if (!sets?.length) return 0;

  switch (type) {
    case "total_volume":
      return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    case "total_sets":
      return sets.length;
    case "total_reps":
      return sets.reduce((sum, s) => sum + s.reps, 0);
    default:
      return 0;
  }
}

// Persistent leaderboards (computed from existing data, scoped to friends)
export async function getFriendLeaderboard(
  metric: "weekly_volume" | "current_streak" | "monthly_prs" | "monthly_workouts"
): Promise<{ profile: ChallengeParticipant["profile"]; score: number }[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's profile
  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!myProfile) return [];

  // Get accepted follows (both directions)
  const { data: following } = await supabase
    .from("follows")
    .select(
      "following_id, following:user_profiles!follows_following_id_fkey(*)"
    )
    .eq("follower_id", myProfile.id)
    .eq("status", "accepted");

  const friendProfiles = (following || []).map(
    (f) =>
      f.following as unknown as {
        id: string;
        user_id: string;
        username: string;
        display_name: string | null;
      }
  );

  // Include self
  const { data: selfProfile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  const allProfiles = selfProfile
    ? [selfProfile, ...friendProfiles]
    : friendProfiles;

  const results: {
    profile: ChallengeParticipant["profile"];
    score: number;
  }[] = [];

  for (const p of allProfiles) {
    const userId = (p as { user_id: string }).user_id;
    let score = 0;

    const now = new Date();
    if (metric === "weekly_volume") {
      const wStart = startOfWeek(now, { weekStartsOn: 1 });
      const wEnd = endOfWeek(now, { weekStartsOn: 1 });
      const { data: sess } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .gte("started_at", wStart.toISOString())
        .lte("started_at", wEnd.toISOString());
      if (sess?.length) {
        const ids = sess.map((s) => s.id);
        const { data: sets } = await supabase
          .from("workout_sets")
          .select("weight, reps")
          .in("session_id", ids);
        score = (sets || []).reduce((sum, s) => sum + s.weight * s.reps, 0);
      }
    } else if (metric === "monthly_workouts") {
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      const { count } = await supabase
        .from("workout_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .gte("started_at", mStart.toISOString())
        .lte("started_at", mEnd.toISOString());
      score = count || 0;
    } else if (metric === "monthly_prs") {
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      const { count } = await supabase
        .from("workout_sets")
        .select("*, session:workout_sessions!inner(user_id)", {
          count: "exact",
          head: true,
        })
        .eq("is_pr", true)
        .eq("workout_sessions.user_id", userId)
        .gte("logged_at", mStart.toISOString())
        .lte("logged_at", mEnd.toISOString());
      score = count || 0;
    } else if (metric === "current_streak") {
      // Import computeStreak pattern from badges
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("started_at")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(90);
      if (sessions?.length) {
        const { format, subDays } = await import("date-fns");
        const workoutDays = new Set(
          sessions.map((s) => format(new Date(s.started_at), "yyyy-MM-dd"))
        );
        let streak = 0;
        let checkDate = new Date();
        if (!workoutDays.has(format(checkDate, "yyyy-MM-dd")))
          checkDate = subDays(checkDate, 1);
        while (workoutDays.has(format(checkDate, "yyyy-MM-dd"))) {
          streak++;
          checkDate = subDays(checkDate, 1);
        }
        score = streak;
      }
    }

    results.push({
      profile: p as ChallengeParticipant["profile"],
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

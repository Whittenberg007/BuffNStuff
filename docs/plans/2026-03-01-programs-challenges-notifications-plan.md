# Phase 15: Programs, Challenges & Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add science-based structured training programs, social challenges with leaderboards, and a smart notification system to BuffNStuff.

**Architecture:** Three independent feature domains (programs, challenges, notifications) sharing the existing Supabase + Next.js client-component architecture. Programs reference existing workout templates. Challenges compute scores from existing workout data. Notifications hook into existing feed event patterns via dynamic imports in try/catch blocks.

**Tech Stack:** Next.js 16, Supabase (client-side), TypeScript, shadcn/ui, lucide-react, date-fns, @capacitor/local-notifications (existing)

**Design Doc:** `docs/plans/2026-03-01-programs-challenges-notifications-design.md`

---

## Task 1: Add Phase 15 Types to database.ts

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add new types after the existing Social & Community section (after line 288)**

Append these types at the end of the file:

```typescript
// --- Programs, Challenges & Notifications ---

export type ProgramGoal = "strength" | "hypertrophy" | "endurance" | "recomp" | "general";
export type ProgramDifficulty = "beginner" | "intermediate" | "advanced";
export type PeriodizationType = "linear" | "dup" | "block" | "conjugate";
export type ProgressionType = "linear_weight" | "linear_reps" | "percentage" | "rpe" | "wave" | "volume_ramp";
export type EnrollmentStatus = "active" | "completed" | "abandoned";
export type ChallengeType = "total_volume" | "total_workouts" | "streak" | "total_sets" | "total_reps";
export type ChallengeStatus = "upcoming" | "active" | "completed";
export type NotificationType =
  | "workout_reminder"
  | "follow_request"
  | "follow_accepted"
  | "reaction_received"
  | "challenge_invite"
  | "challenge_won"
  | "pr_hit"
  | "badge_earned"
  | "streak_milestone"
  | "goal_completed";

export interface TrainingProgram {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  duration_weeks: number;
  difficulty: ProgramDifficulty;
  goal: ProgramGoal;
  days_per_week: number;
  periodization: PeriodizationType;
  schedule: ProgramSchedule;
  progression_rules: ProgressionRules;
  deload_config: DeloadConfig;
  is_prebuilt: boolean;
  created_at: string;
}

export interface ProgramSchedule {
  weeks: ProgramWeek[];
  repeat_from_week?: number;
}

export interface ProgramWeek {
  week_number: number;
  label: string;
  is_deload?: boolean;
  days: ProgramDay[];
}

export interface ProgramDay {
  day_of_week: number;
  template_id: string | null;
  label: string;
  exercises: ProgramExercise[];
  overrides?: {
    sets_multiplier?: number;
    rpe_target?: number;
  };
}

export interface ProgramExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: number | string;
  rpe_target?: number;
  rest_seconds?: number;
  notes?: string;
}

export interface ProgressionRules {
  type: ProgressionType;
  compound_increment_lbs?: number;
  isolation_increment_lbs?: number;
  percentage_increase?: number;
  failure_protocol?: string;
  rpe_target?: number;
}

export interface DeloadConfig {
  every_n_weeks: number;
  volume_reduction: number;
  intensity_reduction: number;
}

export interface ProgramEnrollment {
  id: string;
  user_id: string;
  program_id: string;
  started_at: string;
  current_week: number;
  current_day_index: number;
  status: EnrollmentStatus;
  progress_log: Record<string, unknown>;
  completed_at: string | null;
  program?: TrainingProgram;
}

export interface Challenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
  created_at: string;
  creator?: UserProfile;
  participant_count?: number;
  my_score?: number;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  current_score: number;
  joined_at: string;
  profile?: UserProfile;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  workout_reminders: boolean;
  social_notifications: boolean;
  achievement_alerts: boolean;
  reminder_time: string;
  reminder_days: number[];
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { link?: string; metadata?: Record<string, unknown> };
  is_read: boolean;
  created_at: string;
}
```

**Step 2: Extend FeedEventType**

Change the existing `FeedEventType` union (around line 244) to add 4 new event types:

```typescript
export type FeedEventType =
  | "workout_completed"
  | "pr_hit"
  | "streak_milestone"
  | "badge_earned"
  | "weight_milestone"
  | "challenge_created"
  | "challenge_won"
  | "program_started"
  | "program_completed";
```

**Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add Phase 15 types for programs, challenges, and notifications"
```

---

## Task 2: Create Programs Database Layer

**Files:**
- Create: `src/lib/database/programs.ts`

**Step 1: Create the programs CRUD module**

```typescript
import { createClient } from "@/lib/supabase/client";
import type { TrainingProgram, ProgramEnrollment } from "@/types";

// Get all pre-built programs
export async function getPrebuiltPrograms(): Promise<TrainingProgram[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .eq("is_prebuilt", true)
    .order("name");
  if (error) throw error;
  return data as TrainingProgram[];
}

// Get user's custom programs
export async function getUserPrograms(): Promise<TrainingProgram[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_prebuilt", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as TrainingProgram[];
}

// Get a single program by ID
export async function getProgram(programId: string): Promise<TrainingProgram | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .eq("id", programId)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as TrainingProgram;
}

// Create a custom program
export async function createProgram(
  program: Omit<TrainingProgram, "id" | "user_id" | "is_prebuilt" | "created_at">
): Promise<TrainingProgram> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("training_programs")
    .insert({
      ...program,
      user_id: user.id,
      is_prebuilt: false,
    })
    .select()
    .single();
  if (error) throw error;

  try {
    const { createFeedEvent } = await import("@/lib/database/feed");
    await createFeedEvent("program_started", {
      program_name: program.name,
      duration_weeks: program.duration_weeks,
      goal: program.goal,
    });
  } catch { /* feed should never block */ }

  return data as TrainingProgram;
}

// Delete a custom program
export async function deleteProgram(programId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("training_programs")
    .delete()
    .eq("id", programId);
  if (error) throw error;
}

// Enroll in a program
export async function enrollInProgram(programId: string): Promise<ProgramEnrollment> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Abandon any currently active enrollment
  await supabase
    .from("program_enrollments")
    .update({ status: "abandoned" })
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data, error } = await supabase
    .from("program_enrollments")
    .insert({
      user_id: user.id,
      program_id: programId,
      current_week: 1,
      current_day_index: 0,
      status: "active",
      progress_log: {},
    })
    .select("*, program:training_programs(*)")
    .single();
  if (error) throw error;

  try {
    const program = (data as ProgramEnrollment).program;
    const { createFeedEvent } = await import("@/lib/database/feed");
    await createFeedEvent("program_started", {
      program_name: program?.name || "a program",
      duration_weeks: program?.duration_weeks || 0,
      goal: program?.goal || "general",
    });
  } catch { /* feed should never block */ }

  return data as ProgramEnrollment;
}

// Get active enrollment
export async function getActiveEnrollment(): Promise<ProgramEnrollment | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("program_enrollments")
    .select("*, program:training_programs(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data as ProgramEnrollment;
}

// Get enrollment history
export async function getEnrollmentHistory(): Promise<ProgramEnrollment[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("program_enrollments")
    .select("*, program:training_programs(*)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data as ProgramEnrollment[];
}

// Advance to next day/week in program
export async function advanceProgram(enrollmentId: string): Promise<ProgramEnrollment> {
  const supabase = createClient();

  const { data: enrollment, error: fetchErr } = await supabase
    .from("program_enrollments")
    .select("*, program:training_programs(*)")
    .eq("id", enrollmentId)
    .single();
  if (fetchErr) throw fetchErr;

  const e = enrollment as ProgramEnrollment;
  const program = e.program!;
  const totalWeeks = program.schedule.weeks.length;
  const currentWeekData = program.schedule.weeks.find(
    (w) => w.week_number === e.current_week
  );
  const totalDaysInWeek = currentWeekData?.days.length || 0;

  let nextDay = e.current_day_index + 1;
  let nextWeek = e.current_week;
  let status: "active" | "completed" = "active";

  if (nextDay >= totalDaysInWeek) {
    nextDay = 0;
    nextWeek = e.current_week + 1;

    if (nextWeek > totalWeeks) {
      if (program.schedule.repeat_from_week) {
        nextWeek = program.schedule.repeat_from_week;
      } else {
        status = "completed";
        nextWeek = totalWeeks;
      }
    }
  }

  const progressLog = { ...e.progress_log };
  const weekKey = `week_${e.current_week}`;
  if (!progressLog[weekKey]) progressLog[weekKey] = {};
  (progressLog[weekKey] as Record<string, boolean>)[`day_${e.current_day_index}`] = true;

  const updates: Record<string, unknown> = {
    current_week: nextWeek,
    current_day_index: nextDay,
    status,
    progress_log: progressLog,
  };
  if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("program_enrollments")
    .update(updates)
    .eq("id", enrollmentId)
    .select("*, program:training_programs(*)")
    .single();
  if (error) throw error;

  if (status === "completed") {
    try {
      const { createFeedEvent } = await import("@/lib/database/feed");
      await createFeedEvent("program_completed", {
        program_name: program.name,
        duration_weeks: program.duration_weeks,
      });
    } catch { /* feed should never block */ }
  }

  return data as ProgramEnrollment;
}

// Abandon a program
export async function abandonProgram(enrollmentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("program_enrollments")
    .update({ status: "abandoned" })
    .eq("id", enrollmentId);
  if (error) throw error;
}
```

**Step 2: Commit**

```bash
git add src/lib/database/programs.ts
git commit -m "feat: add programs database layer with CRUD and enrollment"
```

---

## Task 3: Create Pre-Built Program Seed Data

**Files:**
- Create: `src/lib/training/program-library.ts`

**Step 1: Create the pre-built program definitions**

This file contains all 14 science-based program templates as static data. Each program includes its full schedule, progression rules, and deload configuration. Programs reference exercise names (not IDs) since they'll be matched at enrollment time.

Create the file with the 14 programs from the design doc: Starting Strength, GZCLP, 5/3/1 BBB, nSuns, Conjugate, PPL Classic, PHUL, PHAT, RP Mesocycle, GVT, Bro Split, Full Body 3x, Upper/Lower. Each program must include:
- `name`, `description`, `duration_weeks`, `difficulty`, `goal`, `days_per_week`, `periodization`
- `schedule` with week definitions and day exercises
- `progression_rules` with the appropriate type
- `deload_config`

The file should export a `PREBUILT_PROGRAMS` array of type `Omit<TrainingProgram, "id" | "user_id" | "created_at">[]` with `is_prebuilt: true`.

Also export a `seedPrebuiltPrograms()` function that:
1. Checks if programs already exist in the DB
2. If not, inserts them with `user_id: null` and `is_prebuilt: true`

**Step 2: Commit**

```bash
git add src/lib/training/program-library.ts
git commit -m "feat: add 14 science-based pre-built program definitions"
```

---

## Task 4: Create Challenges Database Layer

**Files:**
- Create: `src/lib/database/challenges.ts`

**Step 1: Create the challenges CRUD module**

```typescript
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
  const { data: { user } } = await supabase.auth.getUser();
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
  } catch { /* feed should never block */ }

  return data as Challenge;
}

// Get challenges visible to user (own + friends')
export async function getChallenges(filter: "active" | "upcoming" | "completed" | "all" = "all"): Promise<Challenge[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
export async function getChallenge(challengeId: string): Promise<Challenge | null> {
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
export async function getChallengeLeaderboard(challengeId: string): Promise<ChallengeParticipant[]> {
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

    scored.push({ ...p, current_score: score, profile: profile || undefined } as ChallengeParticipant);
  }

  return scored.sort((a, b) => b.current_score - a.current_score);
}

// Join a challenge
export async function joinChallenge(challengeId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
      .select("creator_id, title, creator:user_profiles!challenges_creator_id_fkey(user_id)")
      .eq("id", challengeId)
      .single();
    if (challenge) {
      const creatorUserId = (challenge.creator as unknown as { user_id: string })?.user_id;
      if (creatorUserId && creatorUserId !== user.id) {
        const { createNotification } = await import("@/lib/database/notifications");
        await createNotification({
          userId: creatorUserId,
          type: "challenge_invite",
          title: "New challenger!",
          body: `Someone joined your challenge "${challenge.title}"`,
          data: { link: `/community/challenges/view?id=${challengeId}` },
        });
      }
    }
  } catch { /* notification should never block */ }
}

// Leave a challenge
export async function leaveChallenge(challengeId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id);
  if (error) throw error;
}

// Check if user has joined a challenge
export async function hasJoinedChallenge(challengeId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    const days = [...new Set(sessions.map(s => s.started_at.split("T")[0]))].sort();
    let maxStreak = 1, current = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) { current++; maxStreak = Math.max(maxStreak, current); }
      else { current = 1; }
    }
    return maxStreak;
  }

  // Need sets data for volume/sets/reps
  const sessionIds = sessions.map(s => s.id);
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("weight, reps")
    .in("session_id", sessionIds);
  if (!sets?.length) return 0;

  switch (type) {
    case "total_volume": return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    case "total_sets": return sets.length;
    case "total_reps": return sets.reduce((sum, s) => sum + s.reps, 0);
    default: return 0;
  }
}

// Persistent leaderboards (computed from existing data, scoped to friends)
export async function getFriendLeaderboard(metric: "weekly_volume" | "current_streak" | "monthly_prs" | "monthly_workouts"): Promise<{ profile: ChallengeParticipant["profile"]; score: number }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    .select("following_id, following:user_profiles!follows_following_id_fkey(*)")
    .eq("follower_id", myProfile.id)
    .eq("status", "accepted");

  const friendProfiles = (following || []).map(f => f.following as unknown as { id: string; user_id: string; username: string; display_name: string | null });

  // Include self
  const { data: selfProfile } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).single();
  const allProfiles = selfProfile ? [selfProfile, ...friendProfiles] : friendProfiles;

  const results: { profile: ChallengeParticipant["profile"]; score: number }[] = [];

  for (const p of allProfiles) {
    const userId = (p as { user_id: string }).user_id;
    let score = 0;

    const now = new Date();
    if (metric === "weekly_volume") {
      const wStart = startOfWeek(now, { weekStartsOn: 1 });
      const wEnd = endOfWeek(now, { weekStartsOn: 1 });
      const { data: sess } = await supabase.from("workout_sessions").select("id").eq("user_id", userId).not("ended_at", "is", null).gte("started_at", wStart.toISOString()).lte("started_at", wEnd.toISOString());
      if (sess?.length) {
        const ids = sess.map(s => s.id);
        const { data: sets } = await supabase.from("workout_sets").select("weight, reps").in("session_id", ids);
        score = (sets || []).reduce((sum, s) => sum + s.weight * s.reps, 0);
      }
    } else if (metric === "monthly_workouts") {
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      const { count } = await supabase.from("workout_sessions").select("*", { count: "exact", head: true }).eq("user_id", userId).not("ended_at", "is", null).gte("started_at", mStart.toISOString()).lte("started_at", mEnd.toISOString());
      score = count || 0;
    } else if (metric === "monthly_prs") {
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      const { count } = await supabase.from("workout_sets").select("*, session:workout_sessions!inner(user_id)", { count: "exact", head: true }).eq("is_pr", true).eq("workout_sessions.user_id", userId).gte("logged_at", mStart.toISOString()).lte("logged_at", mEnd.toISOString());
      score = count || 0;
    } else if (metric === "current_streak") {
      // Import computeStreak pattern from badges
      const { data: sessions } = await supabase.from("workout_sessions").select("started_at").eq("user_id", userId).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(90);
      if (sessions?.length) {
        const { format, subDays } = await import("date-fns");
        const workoutDays = new Set(sessions.map(s => format(new Date(s.started_at), "yyyy-MM-dd")));
        let streak = 0;
        let checkDate = new Date();
        if (!workoutDays.has(format(checkDate, "yyyy-MM-dd"))) checkDate = subDays(checkDate, 1);
        while (workoutDays.has(format(checkDate, "yyyy-MM-dd"))) { streak++; checkDate = subDays(checkDate, 1); }
        score = streak;
      }
    }

    results.push({ profile: p as ChallengeParticipant["profile"], score });
  }

  return results.sort((a, b) => b.score - a.score);
}
```

**Step 2: Commit**

```bash
git add src/lib/database/challenges.ts
git commit -m "feat: add challenges database layer with scoring and leaderboards"
```

---

## Task 5: Create Notifications Database Layer

**Files:**
- Create: `src/lib/database/notifications.ts`

**Step 1: Create the notifications module**

```typescript
import { createClient } from "@/lib/supabase/client";
import type { AppNotification, NotificationPreferences, NotificationType } from "@/types";

// Get notification preferences (create defaults if missing)
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (data) return data as NotificationPreferences;

  if (error?.code === "PGRST116") {
    const { data: newPrefs, error: insertErr } = await supabase
      .from("notification_preferences")
      .insert({
        user_id: user.id,
        workout_reminders: true,
        social_notifications: true,
        achievement_alerts: true,
        reminder_time: "09:00",
        reminder_days: [1, 3, 5],
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    return newPrefs as NotificationPreferences;
  }

  if (error) throw error;
  throw new Error("Unexpected state");
}

// Update notification preferences
export async function updateNotificationPreferences(
  updates: Partial<Pick<NotificationPreferences, "workout_reminders" | "social_notifications" | "achievement_alerts" | "reminder_time" | "reminder_days">>
): Promise<NotificationPreferences> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notification_preferences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data as NotificationPreferences;
}

// Create a notification (used by hooks)
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: { link?: string; metadata?: Record<string, unknown> };
}): Promise<void> {
  const supabase = createClient();

  // Check user's preferences before creating
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("social_notifications, achievement_alerts")
    .eq("user_id", params.userId)
    .single();

  if (prefs) {
    const socialTypes: NotificationType[] = ["follow_request", "follow_accepted", "reaction_received", "challenge_invite"];
    const achievementTypes: NotificationType[] = ["pr_hit", "badge_earned", "streak_milestone", "goal_completed", "challenge_won"];

    if (socialTypes.includes(params.type) && !prefs.social_notifications) return;
    if (achievementTypes.includes(params.type) && !prefs.achievement_alerts) return;
  }

  await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data || {},
  });
}

// Get notifications for current user
export async function getNotifications(limit = 50, offset = 0): Promise<AppNotification[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data as AppNotification[];
}

// Get unread count
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) return 0;
  return count || 0;
}

// Mark notification as read
export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) throw error;
}

// Mark all as read
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw error;
}

// Delete a notification
export async function deleteNotification(notificationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);
  if (error) throw error;
}

// Schedule local workout reminders (Capacitor only)
export async function scheduleWorkoutReminders(
  reminderTime: string,
  reminderDays: number[]
): Promise<void> {
  const { isNative } = await import("@/lib/capacitor/platform");
  if (!isNative()) return;

  const { cancelAllLocalNotifications, scheduleLocalNotification } = await import("@/lib/capacitor/notifications");
  await cancelAllLocalNotifications();

  const [hours, minutes] = reminderTime.split(":").map(Number);
  const now = new Date();

  for (const day of reminderDays) {
    const scheduleDate = new Date(now);
    const daysUntil = (day - now.getDay() + 7) % 7 || 7;
    scheduleDate.setDate(now.getDate() + daysUntil);
    scheduleDate.setHours(hours, minutes, 0, 0);

    await scheduleLocalNotification({
      title: "Time to train!",
      body: "Your scheduled workout is waiting. Let's get after it!",
      id: 1000 + day,
      scheduleAt: scheduleDate,
    });
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/database/notifications.ts
git commit -m "feat: add notifications database layer with preferences and local scheduling"
```

---

## Task 6: Create Program Components (program-card, program-browser, week-view)

**Files:**
- Create: `src/components/programs/program-card.tsx`
- Create: `src/components/programs/program-browser.tsx`
- Create: `src/components/programs/week-view.tsx`

**Step 1: Create program-card.tsx**

A card component that displays a program summary. Props: `program: TrainingProgram`, `onSelect?: () => void`, `enrolled?: boolean`. Shows name, goal badge, difficulty, days/week, duration, periodization type. Uses `Card`, `CardContent` from shadcn/ui. Uses `Dumbbell`, `Target`, `Calendar`, `Clock` from lucide-react.

**Step 2: Create program-browser.tsx**

A filterable list of programs. Props: `programs: TrainingProgram[]`, `onSelect: (program: TrainingProgram) => void`. Filter dropdowns for goal (strength/hypertrophy/etc), difficulty, days_per_week. Maps filtered programs to `ProgramCard` components.

**Step 3: Create week-view.tsx**

Displays the current week of an active enrollment. Props: `enrollment: ProgramEnrollment`, `onDayComplete: () => void`. Shows days as cards with exercise lists. Highlights current day. Shows deload indicator when applicable.

**Step 4: Commit**

```bash
git add src/components/programs/
git commit -m "feat: add program card, browser, and week view components"
```

---

## Task 7: Create Program Builder Wizard

**Files:**
- Create: `src/components/programs/program-builder.tsx`
- Create: `src/components/programs/progression-config.tsx`

**Step 1: Create progression-config.tsx**

A form component for configuring progression rules. Props: `value: ProgressionRules`, `onChange: (rules: ProgressionRules) => void`. Dropdown for progression type, conditional fields based on type (increment values, percentage, RPE target, failure protocol).

**Step 2: Create program-builder.tsx**

Multi-step wizard for creating custom programs. Steps:
1. Basics (name, goal, difficulty, days/week, duration)
2. Schedule (assign exercises per day per week)
3. Progression (use ProgressionConfig)
4. Deload (every N weeks, volume reduction)
5. Review & Create

Uses `useState` for step tracking and form data. Calls `createProgram()` on submit.

**Step 3: Commit**

```bash
git add src/components/programs/
git commit -m "feat: add program builder wizard and progression config"
```

---

## Task 8: Create Challenge Components

**Files:**
- Create: `src/components/challenges/challenge-card.tsx`
- Create: `src/components/challenges/challenge-form.tsx`
- Create: `src/components/challenges/leaderboard.tsx`
- Create: `src/components/challenges/leaderboard-card.tsx`

**Step 1: Create challenge-card.tsx**

Props: `challenge: Challenge`, `onView: () => void`. Shows title, type badge, date range, participant count, user's score if joined. Status indicator (upcoming/active/completed).

**Step 2: Create challenge-form.tsx**

Props: `onCreated: (challenge: Challenge) => void`. Form fields: title (max 80), description (max 280), challenge_type dropdown, start_date, end_date. Validates end > start and max 90 days.

**Step 3: Create leaderboard.tsx**

Props: `participants: ChallengeParticipant[]`, `challengeType: ChallengeType`. Ranked list with position numbers, avatars, names, scores. Highlights current user. Formats scores based on type (lbs for volume, count for others).

**Step 4: Create leaderboard-card.tsx**

Props: `title: string`, `metric: string`, `entries: { profile, score }[]`. Compact card showing a persistent leaderboard with top 5. Used on the leaderboards page.

**Step 5: Commit**

```bash
git add src/components/challenges/
git commit -m "feat: add challenge card, form, leaderboard components"
```

---

## Task 9: Create Notification Components

**Files:**
- Create: `src/components/notifications/notification-bell.tsx`
- Create: `src/components/notifications/notification-list.tsx`
- Create: `src/components/notifications/notification-preferences.tsx`

**Step 1: Create notification-bell.tsx**

A bell icon with unread count badge. Props: none (fetches its own count). Uses `getUnreadNotificationCount()` on mount and polls every 30 seconds. Renders a `Link` to `/notifications`. Shows red dot with count when unread > 0.

**Step 2: Create notification-list.tsx**

Props: `notifications: AppNotification[]`, `onMarkRead: (id: string) => void`, `onDelete: (id: string) => void`. Lists notifications with icon per type, title, body, relative time. Unread items have a subtle highlight. Tap marks as read and navigates to `data.link` if present.

**Step 3: Create notification-preferences.tsx**

Props: `preferences: NotificationPreferences`, `onUpdated: (prefs: NotificationPreferences) => void`. Toggle switches for workout_reminders, social_notifications, achievement_alerts. Time picker for reminder_time. Day-of-week checkboxes for reminder_days. Calls `updateNotificationPreferences()` and `scheduleWorkoutReminders()` on change.

**Step 4: Commit**

```bash
git add src/components/notifications/
git commit -m "feat: add notification bell, list, and preferences components"
```

---

## Task 10: Create Program Pages

**Files:**
- Create: `src/app/(app)/programs/page.tsx`
- Create: `src/app/(app)/programs/browse/page.tsx`
- Create: `src/app/(app)/programs/new/page.tsx`
- Create: `src/app/(app)/programs/active/page.tsx`

**Step 1: Create programs/page.tsx (My Programs hub)**

Shows active enrollment at top (if any), list of user's custom programs, and a "Browse Programs" link. Loads data via `getActiveEnrollment()`, `getUserPrograms()`.

**Step 2: Create programs/browse/page.tsx**

Displays pre-built program library using `ProgramBrowser` component. Loads via `getPrebuiltPrograms()`. Clicking a program shows detail with "Start Program" button that calls `enrollInProgram()`.

**Step 3: Create programs/new/page.tsx**

Renders the `ProgramBuilder` wizard component. On success, navigates to `/programs`.

**Step 4: Create programs/active/page.tsx**

Shows the active program's `WeekView`. Loads via `getActiveEnrollment()`. "Complete Day" button calls `advanceProgram()`. "Abandon Program" button with confirmation. Redirects to `/programs` if no active enrollment.

**Step 5: Commit**

```bash
git add src/app/(app)/programs/
git commit -m "feat: add program pages (hub, browse, new, active)"
```

---

## Task 11: Create Challenge Pages

**Files:**
- Create: `src/app/(app)/community/challenges/page.tsx`
- Create: `src/app/(app)/community/challenges/new/page.tsx`
- Create: `src/app/(app)/community/challenges/view/page.tsx`
- Create: `src/app/(app)/community/leaderboards/page.tsx`

**Step 1: Create challenges/page.tsx**

Lists active + upcoming challenges. Tabs for "Active", "Upcoming", "Completed". "Create Challenge" button links to /new. Uses `getChallenges()` with filter.

**Step 2: Create challenges/new/page.tsx**

Renders `ChallengeForm`. On success, navigates to the challenge view page.

**Step 3: Create challenges/view/page.tsx**

Uses `useSearchParams()` with Suspense boundary (same pattern as community/user/page.tsx). Loads challenge via `getChallenge(id)` and leaderboard via `getChallengeLeaderboard(id)`. Shows join/leave button, leaderboard, challenge details.

**Step 4: Create leaderboards/page.tsx**

Shows 4 persistent leaderboard cards (weekly volume, current streak, monthly PRs, monthly workouts). Loads each via `getFriendLeaderboard()`.

**Step 5: Commit**

```bash
git add src/app/(app)/community/challenges/ src/app/(app)/community/leaderboards/
git commit -m "feat: add challenge and leaderboard pages"
```

---

## Task 12: Create Notifications Page

**Files:**
- Create: `src/app/(app)/notifications/page.tsx`

**Step 1: Create the notifications inbox page**

Loads notifications via `getNotifications()`. "Mark all read" button at top. Uses `NotificationList` component. Empty state when no notifications.

**Step 2: Commit**

```bash
git add src/app/(app)/notifications/
git commit -m "feat: add notifications inbox page"
```

---

## Task 13: Add Notification Bell to App Layout

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

**Step 1: Add NotificationBell to the app shell**

Add an import for `NotificationBell` and render it in a fixed position at the top-right of the main content area (or as a floating element). The bell should appear on all pages.

Update `app-shell.tsx`:

```typescript
import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <SidebarNav />
      <main className="relative flex-1 overflow-auto pb-20 md:pb-0">
        <div className="absolute top-4 right-4 z-40">
          <NotificationBell />
        </div>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: add notification bell to app shell header"
```

---

## Task 14: Add Notification Settings to Settings Page

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add NotificationPreferences component to the settings page**

Import and render `NotificationPreferences` between `HealthSyncSettings` and `TDEECalculator`.

**Step 2: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat: add notification preferences to settings page"
```

---

## Task 15: Add Program Link to Dashboard

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Step 1: Add an ActiveProgramCard component**

Create a small inline component or import that shows the current active program enrollment on the dashboard. If enrolled, show program name, current week/day, and a "Continue" link to `/programs/active`. If not enrolled, show a "Start a Program" link to `/programs/browse`.

Add it between `TodayWorkout` and `WeeklySummary` in the dashboard.

**Step 2: Commit**

```bash
git add src/app/(app)/page.tsx
git commit -m "feat: add active program card to dashboard"
```

---

## Task 16: Add Challenge/Leaderboard Links to Community Page

**Files:**
- Modify: `src/app/(app)/community/page.tsx`

**Step 1: Add navigation links**

Add "Challenges" and "Leaderboards" links to the community page header area (alongside the existing requests/find/profile buttons). Use `Swords` and `Trophy` icons from lucide-react.

**Step 2: Commit**

```bash
git add src/app/(app)/community/page.tsx
git commit -m "feat: add challenge and leaderboard links to community page"
```

---

## Task 17: Update Feed Item for New Event Types

**Files:**
- Modify: `src/components/community/feed-item.tsx`

**Step 1: Add new event type cases**

Add cases to `getEventIcon()` and `getEventText()` for the 4 new feed event types:
- `challenge_created` → Swords icon, orange-500, "{name} created a challenge: {title}"
- `challenge_won` → Crown icon, yellow-500, "{name} won the challenge: {title}"
- `program_started` → BookOpen icon, blue-500, "{name} started {program_name} ({goal})"
- `program_completed` → GraduationCap icon, green-500, "{name} completed {program_name}!"

**Step 2: Commit**

```bash
git add src/components/community/feed-item.tsx
git commit -m "feat: add feed item support for challenge and program events"
```

---

## Task 18: Add Notification Hooks to Existing Functions

**Files:**
- Modify: `src/lib/database/follows.ts` (acceptFollowRequest)
- Modify: `src/lib/training/badges.ts` (awardBadge)

**Step 1: Add notification in acceptFollowRequest**

After updating follow status to "accepted", create a notification for the requester:

```typescript
try {
  const { createNotification } = await import("@/lib/database/notifications");
  await createNotification({
    userId: /* the follower's auth user_id */,
    type: "follow_accepted",
    title: "Follow request accepted!",
    body: "You can now see their activity.",
    data: { link: "/community" },
  });
} catch { /* notification should never block */ }
```

**Step 2: Add notification in awardBadge**

After inserting badge and creating feed event, also create a notification:

```typescript
try {
  const { createNotification } = await import("@/lib/database/notifications");
  await createNotification({
    userId: userId,
    type: "badge_earned",
    title: "Badge earned!",
    body: `You earned: ${badge?.name || badgeType}`,
    data: { link: "/progress" },
  });
} catch { /* notification should never block */ }
```

**Step 3: Commit**

```bash
git add src/lib/database/follows.ts src/lib/training/badges.ts
git commit -m "feat: add notification hooks to follow accept and badge award"
```

---

## Task 19: Lint and Build Verification

**Step 1: Run lint**

```bash
npx next lint --quiet
```

Fix any errors in new files only.

**Step 2: Run builds**

```bash
npm run build
npm run build:cap
```

Both should pass. Fix any issues.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and build issues for Phase 15"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|------------|--------------|
| 1 | Types in database.ts | None |
| 2 | Programs database layer | Task 1 |
| 3 | Pre-built program seed data | Task 1 |
| 4 | Challenges database layer | Task 1 |
| 5 | Notifications database layer | Task 1 |
| 6 | Program components (card, browser, week-view) | Task 2 |
| 7 | Program builder wizard | Task 2 |
| 8 | Challenge components | Task 4 |
| 9 | Notification components | Task 5 |
| 10 | Program pages | Tasks 6, 7 |
| 11 | Challenge pages | Task 8 |
| 12 | Notifications page | Task 9 |
| 13 | Notification bell in app shell | Task 9 |
| 14 | Notification settings | Task 9 |
| 15 | Dashboard program link | Task 2 |
| 16 | Community challenge/leaderboard links | Task 4 |
| 17 | Feed item new event types | Task 1 |
| 18 | Notification hooks in existing functions | Task 5 |
| 19 | Lint + build verification | All |

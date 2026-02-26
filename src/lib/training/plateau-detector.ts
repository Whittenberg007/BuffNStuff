import { createClient } from "@/lib/supabase/client";
import { VOLUME_LANDMARKS, getVolumeStatus } from "@/lib/training/pairing-guidance";
import { findReplacement } from "@/lib/training/rotation-engine";
import type { Exercise, MuscleGroup } from "@/types";

export type PlateauType = "plateau" | "regression";

export interface Intervention {
  type: "deload" | "rep_range" | "exercise_swap" | "technique" | "volume";
  title: string;
  description: string;
  replacementExercise?: Exercise | null;
}

export interface PlateauResult {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  plateauType: PlateauType;
  sessionCount: number;
  lastWeight: number;
  lastReps: number;
  interventions: Intervention[];
}

interface SessionBest {
  sessionId: string;
  startedAt: string;
  weight: number;
  reps: number;
}

/**
 * Detect plateaus across all exercises used in the last 3 sessions.
 * For each exercise, compares the best set (highest weight x reps) across sessions.
 * - If weight AND reps are identical for 2+ consecutive sessions -> plateau
 * - If weight AND reps have decreased for 2+ sessions -> regression
 */
export async function detectPlateaus(): Promise<PlateauResult[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Get the last 3 completed sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", user.id)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(3);

  if (sessionsError || !sessions?.length || sessions.length < 2) return [];

  const sessionIds = sessions.map((s) => s.id);

  // Get all working sets from these sessions with exercise info
  const { data: sets, error: setsError } = await supabase
    .from("workout_sets")
    .select(
      "session_id, exercise_id, weight, reps, set_type, exercise:exercises(name, primary_muscle_group, equipment_type)"
    )
    .in("session_id", sessionIds)
    .eq("set_type", "working");

  if (setsError || !sets?.length) return [];

  // Group sets by exercise_id, then find best set per session
  const exerciseSessionMap = new Map<
    string,
    {
      exerciseName: string;
      muscleGroup: MuscleGroup;
      sessions: Map<string, SessionBest>;
    }
  >();

  for (const set of sets) {
    const exerciseData = Array.isArray(set.exercise)
      ? set.exercise[0]
      : set.exercise;
    if (!exerciseData) continue;

    const ex = exerciseData as {
      name: string;
      primary_muscle_group: MuscleGroup;
      equipment_type: string;
    };

    if (!exerciseSessionMap.has(set.exercise_id)) {
      exerciseSessionMap.set(set.exercise_id, {
        exerciseName: ex.name,
        muscleGroup: ex.primary_muscle_group,
        sessions: new Map(),
      });
    }

    const entry = exerciseSessionMap.get(set.exercise_id)!;
    const session = sessions.find((s) => s.id === set.session_id);
    if (!session) continue;

    const existing = entry.sessions.get(set.session_id);
    const volume = set.weight * set.reps;
    const existingVolume = existing ? existing.weight * existing.reps : 0;

    if (!existing || volume > existingVolume) {
      entry.sessions.set(set.session_id, {
        sessionId: set.session_id,
        startedAt: session.started_at,
        weight: set.weight,
        reps: set.reps,
      });
    }
  }

  const plateaus: PlateauResult[] = [];

  // Analyze each exercise for plateau/regression patterns
  for (const [exerciseId, data] of exerciseSessionMap) {
    // Need at least 2 sessions to detect a pattern
    if (data.sessions.size < 2) continue;

    // Sort sessions by date (most recent first)
    const sortedSessions = Array.from(data.sessions.values()).sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    const plateauType = detectPattern(sortedSessions);
    if (!plateauType) continue;

    const interventions = await getInterventions(
      exerciseId,
      plateauType,
      data.muscleGroup
    );

    plateaus.push({
      exerciseId,
      exerciseName: data.exerciseName,
      muscleGroup: data.muscleGroup,
      plateauType,
      sessionCount: sortedSessions.length,
      lastWeight: sortedSessions[0].weight,
      lastReps: sortedSessions[0].reps,
      interventions,
    });
  }

  return plateaus;
}

/**
 * Detect if session data shows a plateau or regression pattern.
 */
function detectPattern(sessions: SessionBest[]): PlateauType | null {
  if (sessions.length < 2) return null;

  // Check for plateau: identical weight AND reps for 2+ consecutive sessions
  let identicalCount = 1;
  for (let i = 1; i < sessions.length; i++) {
    if (
      sessions[i].weight === sessions[0].weight &&
      sessions[i].reps === sessions[0].reps
    ) {
      identicalCount++;
    } else {
      break;
    }
  }
  if (identicalCount >= 2) return "plateau";

  // Check for regression: decreasing weight AND reps for 2+ sessions
  let decreasingCount = 1;
  for (let i = 1; i < sessions.length; i++) {
    if (
      sessions[i - 1].weight <= sessions[i].weight &&
      sessions[i - 1].reps <= sessions[i].reps &&
      (sessions[i - 1].weight < sessions[i].weight ||
        sessions[i - 1].reps < sessions[i].reps)
    ) {
      decreasingCount++;
    } else {
      break;
    }
  }
  if (decreasingCount >= 2) return "regression";

  return null;
}

/**
 * Get intervention suggestions for a detected plateau or regression.
 */
export async function getInterventions(
  exerciseId: string,
  plateauType: PlateauType,
  muscleGroup?: MuscleGroup
): Promise<Intervention[]> {
  const interventions: Intervention[] = [];

  // 1. Deload recommendation
  interventions.push({
    type: "deload",
    title: "Take a deload week",
    description:
      plateauType === "regression"
        ? "Your performance is declining -- reduce volume by 50% for 1 week to allow full recovery. This is the most evidence-based approach for regression."
        : "Reduce volume by 50% for 1 week. Strategic deloads allow accumulated fatigue to dissipate while maintaining adaptations.",
  });

  // 2. Rep range change
  interventions.push({
    type: "rep_range",
    title: "Switch rep range",
    description:
      "Switch from 8-10 reps to 12-15 reps for 2 weeks. Changing the rep range alters the stimulus and can break through stagnation by targeting different muscle fiber recruitment patterns.",
  });

  // 3. Exercise swap (use rotation engine)
  const replacement = await findReplacement(exerciseId, muscleGroup);
  interventions.push({
    type: "exercise_swap",
    title: "Swap exercise variation",
    description: replacement
      ? `Try switching to ${replacement.name}. A new movement variation provides a novel stimulus while still targeting the same muscle group.`
      : "Try a different variation of this exercise. Changing equipment type or grip can provide a new stimulus.",
    replacementExercise: replacement,
  });

  // 4. Technique change
  interventions.push({
    type: "technique",
    title: "Modify technique",
    description:
      "Try a different grip width, stance, or slow down the eccentric to 3 seconds. Tempo manipulation and grip changes can create new mechanical tension without changing the exercise.",
  });

  // 5. Volume check using VOLUME_LANDMARKS
  if (muscleGroup) {
    const volumeIntervention = getVolumeIntervention(muscleGroup);
    interventions.push(volumeIntervention);
  } else {
    interventions.push({
      type: "volume",
      title: "Check weekly volume",
      description:
        "Review your weekly set count for this muscle group. You may need to increase volume to drive adaptation, or decrease it if you're exceeding your recovery capacity.",
    });
  }

  return interventions;
}

/**
 * Generate a volume-based intervention using VOLUME_LANDMARKS data.
 */
function getVolumeIntervention(muscleGroup: MuscleGroup): Intervention {
  const landmarks = VOLUME_LANDMARKS[muscleGroup];

  return {
    type: "volume",
    title: "Adjust weekly volume",
    description:
      `Check your weekly sets for ${muscleGroup}. ` +
      `Science-based targets: MEV is ${landmarks.mev} sets, ` +
      `optimal range (MAV) is ${landmarks.mav_min}-${landmarks.mav_max} sets, ` +
      `and MRV is ${landmarks.mrv} sets. ` +
      `If you're below MEV, increase volume. If approaching MRV, consider a deload.`,
  };
}

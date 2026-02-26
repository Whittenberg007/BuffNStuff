import type { MuscleGroup } from "@/types";

// Recovery times in hours
export const RECOVERY_TIMES: Record<
  MuscleGroup,
  { min: number; max: number; optimal_frequency: string }
> = {
  chest: { min: 72, max: 120, optimal_frequency: "2x/week" },
  back: { min: 48, max: 72, optimal_frequency: "2-3x/week" },
  shoulders: { min: 48, max: 72, optimal_frequency: "2-3x/week" },
  biceps: { min: 72, max: 120, optimal_frequency: "2-3x/week" },
  triceps: { min: 72, max: 120, optimal_frequency: "2-3x/week" },
  quads: { min: 24, max: 48, optimal_frequency: "2-3x/week" },
  hamstrings: { min: 48, max: 72, optimal_frequency: "2-3x/week" },
  glutes: { min: 48, max: 72, optimal_frequency: "2-3x/week" },
  calves: { min: 24, max: 48, optimal_frequency: "3-4x/week" },
  core: { min: 24, max: 48, optimal_frequency: "3-5x/week" },
  forearms: { min: 24, max: 48, optimal_frequency: "3-4x/week" },
};

// Volume landmarks (sets per week) from Dr. Mike Israetel
export const VOLUME_LANDMARKS: Record<
  MuscleGroup,
  { mv: number; mev: number; mav_min: number; mav_max: number; mrv: number }
> = {
  chest: { mv: 6, mev: 8, mav_min: 12, mav_max: 20, mrv: 22 },
  back: { mv: 6, mev: 8, mav_min: 14, mav_max: 22, mrv: 25 },
  shoulders: { mv: 4, mev: 6, mav_min: 12, mav_max: 20, mrv: 22 },
  biceps: { mv: 4, mev: 6, mav_min: 10, mav_max: 16, mrv: 20 },
  triceps: { mv: 4, mev: 6, mav_min: 10, mav_max: 16, mrv: 18 },
  quads: { mv: 6, mev: 8, mav_min: 12, mav_max: 18, mrv: 20 },
  hamstrings: { mv: 4, mev: 6, mav_min: 10, mav_max: 16, mrv: 18 },
  glutes: { mv: 4, mev: 6, mav_min: 10, mav_max: 16, mrv: 18 },
  calves: { mv: 6, mev: 8, mav_min: 12, mav_max: 16, mrv: 20 },
  core: { mv: 0, mev: 0, mav_min: 6, mav_max: 12, mrv: 16 },
  forearms: { mv: 2, mev: 4, mav_min: 6, mav_max: 10, mrv: 14 },
};

// Antagonist superset pairings
export const ANTAGONIST_PAIRS: Array<{
  muscles: [MuscleGroup, MuscleGroup];
  benefit: string;
}> = [
  {
    muscles: ["chest", "back"],
    benefit: "36% time savings, enhanced force output",
  },
  {
    muscles: ["biceps", "triceps"],
    benefit: "Classic arm pairing, reciprocal inhibition",
  },
  {
    muscles: ["quads", "hamstrings"],
    benefit: "Full leg development, knee stability",
  },
  {
    muscles: ["shoulders", "back"],
    benefit: "Shoulder balance, injury prevention",
  },
];

// Split type pairings
export const SPLIT_PAIRINGS: Record<string, MuscleGroup[]> = {
  push: ["chest", "shoulders", "triceps"],
  pull: ["back", "biceps", "forearms"],
  legs: ["quads", "hamstrings", "glutes", "calves"],
  upper: ["chest", "back", "shoulders", "biceps", "triceps"],
  lower: ["quads", "hamstrings", "glutes", "calves"],
  full_body: [
    "chest",
    "back",
    "shoulders",
    "quads",
    "hamstrings",
    "biceps",
    "triceps",
  ],
};

// Get pairing tips for selected muscles
export function getPairingTips(selectedMuscles: MuscleGroup[]): string[] {
  const tips: string[] = [];

  // Check antagonist pairs
  for (const pair of ANTAGONIST_PAIRS) {
    if (
      selectedMuscles.includes(pair.muscles[0]) &&
      selectedMuscles.includes(pair.muscles[1])
    ) {
      tips.push(
        `Great pairing: ${pair.muscles[0]} + ${pair.muscles[1]} -- ${pair.benefit}`
      );
    }
  }

  // Check for overlapping push muscles
  const pushMuscles = selectedMuscles.filter((m) =>
    SPLIT_PAIRINGS.push.includes(m)
  );
  if (pushMuscles.length >= 2) {
    tips.push(
      `Push muscles together (${pushMuscles.join(", ")}) -- efficient since they share pressing movements`
    );
  }

  // Check for overlapping pull muscles
  const pullMuscles = selectedMuscles.filter((m) =>
    SPLIT_PAIRINGS.pull.includes(m)
  );
  if (pullMuscles.length >= 2) {
    tips.push(
      `Pull muscles together (${pullMuscles.join(", ")}) -- efficient since they share rowing movements`
    );
  }

  return tips;
}

// Get volume status for a muscle group
export function getVolumeStatus(
  muscleGroup: MuscleGroup,
  weeklySetCount: number
): {
  status: "below_mev" | "mev" | "mav" | "approaching_mrv" | "over_mrv";
  message: string;
  color: string;
} {
  const vl = VOLUME_LANDMARKS[muscleGroup];

  if (weeklySetCount < vl.mev) {
    return {
      status: "below_mev",
      message: `${weeklySetCount} sets -- below minimum effective volume (${vl.mev})`,
      color: "text-blue-400",
    };
  } else if (weeklySetCount < vl.mav_min) {
    return {
      status: "mev",
      message: `${weeklySetCount} sets -- at minimum effective volume`,
      color: "text-green-400",
    };
  } else if (weeklySetCount <= vl.mav_max) {
    return {
      status: "mav",
      message: `${weeklySetCount} sets -- in optimal range (${vl.mav_min}-${vl.mav_max})`,
      color: "text-green-400",
    };
  } else if (weeklySetCount <= vl.mrv) {
    return {
      status: "approaching_mrv",
      message: `${weeklySetCount} sets -- approaching max recoverable volume (${vl.mrv})`,
      color: "text-yellow-400",
    };
  } else {
    return {
      status: "over_mrv",
      message: `${weeklySetCount} sets -- OVER max recoverable volume (${vl.mrv})! Consider a deload`,
      color: "text-red-400",
    };
  }
}

import { isNative } from "@/lib/capacitor/platform";

const LBS_TO_KG = 0.453592;

/**
 * Check whether health sync is available on the current platform.
 * Returns true only on native iOS/Android devices where the
 * @capgo/capacitor-health plugin can talk to HealthKit / Health Connect.
 */
export async function isHealthSyncAvailable(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { Health } = await import("@capgo/capacitor-health");
    const { available } = await Health.isAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Request read/write permissions for calories, weight, and steps.
 * Returns an object describing which data types were authorized.
 * Silently resolves to null on web or when the user denies.
 */
export async function requestHealthPermissions() {
  if (!isNative()) return null;

  try {
    const { Health } = await import("@capgo/capacitor-health");
    const status = await Health.requestAuthorization({
      read: ["calories", "weight", "steps"],
      write: ["calories", "weight"],
    });
    return status;
  } catch (err) {
    console.warn("[health-sync] Permission request failed:", err);
    return null;
  }
}

/**
 * Push a completed workout to HealthKit / Health Connect.
 *
 * The @capgo/capacitor-health plugin does not expose a `saveWorkout()`
 * method, so we write the estimated calories burned as a `calories` sample
 * spanning the workout duration.
 */
export async function syncWorkoutToHealth(workout: {
  startedAt: string;
  endedAt: string;
  caloriesBurned?: number;
}): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { Health } = await import("@capgo/capacitor-health");

    // Only sync when we have calorie data to write
    const calories = workout.caloriesBurned;
    if (!calories || calories <= 0) return false;

    await Health.saveSample({
      dataType: "calories",
      value: calories,
      unit: "kilocalorie",
      startDate: new Date(workout.startedAt).toISOString(),
      endDate: new Date(workout.endedAt).toISOString(),
      metadata: { source: "BuffNStuff" },
    });

    return true;
  } catch (err) {
    console.warn("[health-sync] Workout sync failed:", err);
    return false;
  }
}

/**
 * Push a weight entry to HealthKit / Health Connect.
 *
 * The app stores weight in lbs (US default), so we convert to kilograms
 * because the health APIs use the `kilogram` unit.
 *
 * @param weight  Object with `date` (ISO date string) and `weightLbs` in pounds.
 */
export async function syncWeightToHealth(weight: {
  date: string;
  weightLbs: number;
}): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { Health } = await import("@capgo/capacitor-health");

    const weightKg = weight.weightLbs * LBS_TO_KG;
    const isoDate = new Date(weight.date).toISOString();

    await Health.saveSample({
      dataType: "weight",
      value: weightKg,
      unit: "kilogram",
      startDate: isoDate,
      endDate: isoDate,
      metadata: { source: "BuffNStuff" },
    });

    return true;
  } catch (err) {
    console.warn("[health-sync] Weight sync failed:", err);
    return false;
  }
}

/**
 * Push a nutrition entry's calories to HealthKit / Health Connect.
 *
 * @param entry  Object with `date` (ISO date string) and `calories`.
 */
export async function syncNutritionToHealth(entry: {
  date: string;
  calories: number;
}): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { Health } = await import("@capgo/capacitor-health");

    if (!entry.calories || entry.calories <= 0) return false;

    const isoDate = new Date(entry.date).toISOString();

    await Health.saveSample({
      dataType: "calories",
      value: entry.calories,
      unit: "kilocalorie",
      startDate: isoDate,
      endDate: isoDate,
      metadata: { source: "BuffNStuff", type: "nutrition" },
    });

    return true;
  } catch (err) {
    console.warn("[health-sync] Nutrition sync failed:", err);
    return false;
  }
}

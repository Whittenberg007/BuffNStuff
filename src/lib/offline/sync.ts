import { db, type PendingSet, type PendingSession } from "./db";
import { createClient } from "@/lib/supabase/client";

/** Save a workout set to IndexedDB for offline persistence. */
export async function savePendingSet(set: PendingSet): Promise<void> {
  await db.pendingSets.put(set);
}

/** Save a workout session to IndexedDB for offline persistence. */
export async function savePendingSession(
  session: PendingSession
): Promise<void> {
  await db.pendingSessions.put(session);
}

/** Return the count of unsynced items (sessions + sets). */
export async function getPendingSyncCount(): Promise<number> {
  const [sessions, sets] = await Promise.all([
    db.pendingSessions.where("synced").equals(0).count(),
    db.pendingSets.where("synced").equals(0).count(),
  ]);
  return sessions + sets;
}

/**
 * Push all unsynced data to Supabase and mark as synced.
 * Sessions are synced first, then sets (foreign key dependency).
 */
export async function syncPendingData(): Promise<{
  syncedSessions: number;
  syncedSets: number;
  errors: string[];
}> {
  const supabase = createClient();
  const errors: string[] = [];
  let syncedSessions = 0;
  let syncedSets = 0;

  // Sync pending sessions first
  const unsyncedSessions = await db.pendingSessions
    .where("synced")
    .equals(0)
    .toArray();

  for (const session of unsyncedSessions) {
    const { error } = await supabase.from("workout_sessions").upsert({
      id: session.id,
      template_id: session.template_id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      split_type: session.split_type,
      training_style: session.training_style,
    });

    if (error) {
      errors.push(`Session ${session.id}: ${error.message}`);
    } else {
      await db.pendingSessions.update(session.id, { synced: true });
      syncedSessions++;
    }
  }

  // Sync pending sets
  const unsyncedSets = await db.pendingSets
    .where("synced")
    .equals(0)
    .toArray();

  for (const set of unsyncedSets) {
    const { error } = await supabase.from("workout_sets").upsert({
      id: set.id,
      session_id: set.session_id,
      exercise_id: set.exercise_id,
      set_number: set.set_number,
      weight: set.weight,
      reps: set.reps,
      set_type: set.set_type,
      rpe_rir: set.rpe_rir,
      logged_at: set.logged_at,
    });

    if (error) {
      errors.push(`Set ${set.id}: ${error.message}`);
    } else {
      await db.pendingSets.update(set.id, { synced: true });
      syncedSets++;
    }
  }

  return { syncedSessions, syncedSets, errors };
}

/** Register an event listener that auto-syncs when the browser comes online. */
export function registerOnlineSync(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => {
    syncPendingData().catch(() => {
      // Sync failed silently — will retry next time online
    });
  });
}

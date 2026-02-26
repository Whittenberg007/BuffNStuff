import Dexie, { type EntityTable } from "dexie";

interface PendingSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  set_type: string;
  rpe_rir: number | null;
  logged_at: string;
  synced: boolean;
}

interface PendingSession {
  id: string;
  template_id: string | null;
  started_at: string;
  ended_at: string | null;
  split_type: string | null;
  training_style: string | null;
  synced: boolean;
}

const db = new Dexie("BuffNStuffOffline") as Dexie & {
  pendingSets: EntityTable<PendingSet, "id">;
  pendingSessions: EntityTable<PendingSession, "id">;
};

db.version(1).stores({
  pendingSets: "id, session_id, synced",
  pendingSessions: "id, synced",
});

export { db };
export type { PendingSet, PendingSession };

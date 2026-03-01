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

interface FoodSearchCache {
  query: string;
  results: string; // JSON stringified array of search results
  cached_at: number; // timestamp ms
}

interface BarcodeCache {
  barcode: string;
  product: string; // JSON stringified product data
  cached_at: number;
}

interface PendingFastingLog {
  id: string;
  date: string;
  eating_start: string | null;
  eating_end: string | null;
  target_fast_hours: number;
  achieved_fast_hours: number | null;
  hit_target: boolean | null;
  notes: string | null;
  synced: boolean;
}

interface PendingMealPlan {
  id: string;
  name: string;
  description: string | null;
  eating_window_start: string | null;
  eating_window_end: string | null;
  synced: boolean;
}

interface PendingMealPlanItem {
  id: string;
  plan_id: string;
  meal_name: string;
  target_time: string | null;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  serving_size: string | null;
  sort_order: number;
  synced: boolean;
}

const db = new Dexie("BuffNStuffOffline") as Dexie & {
  pendingSets: EntityTable<PendingSet, "id">;
  pendingSessions: EntityTable<PendingSession, "id">;
  foodSearchCache: EntityTable<FoodSearchCache, "query">;
  barcodeCache: EntityTable<BarcodeCache, "barcode">;
  pendingFastingLogs: EntityTable<PendingFastingLog, "id">;
  pendingMealPlans: EntityTable<PendingMealPlan, "id">;
  pendingMealPlanItems: EntityTable<PendingMealPlanItem, "id">;
};

db.version(1).stores({
  pendingSets: "id, session_id, synced",
  pendingSessions: "id, synced",
});

db.version(2).stores({
  pendingSets: "id, session_id, synced",
  pendingSessions: "id, synced",
  foodSearchCache: "query, cached_at",
  barcodeCache: "barcode, cached_at",
  pendingFastingLogs: "id, date, synced",
  pendingMealPlans: "id, synced",
  pendingMealPlanItems: "id, plan_id, synced",
});

export { db };
export type { PendingSet, PendingSession, FoodSearchCache, BarcodeCache, PendingFastingLog, PendingMealPlan, PendingMealPlanItem };

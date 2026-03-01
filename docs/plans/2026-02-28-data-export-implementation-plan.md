# Phase 13: Data Export & Integrations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CSV/JSON/PDF data export, Apple Health/Health Connect sync, shareable progress image cards, and full backup/restore to the BuffNStuff fitness app.

**Architecture:** Four feature modules that integrate into the existing Settings and sharing surfaces. Export utilities live in `src/lib/export/`, sharing utilities in `src/lib/sharing/`. Cross-platform file handling uses a shared helper that branches on `isNative()` — Blob download on web, `@capacitor/filesystem` + `@capacitor/share` on native. Health sync hooks into existing database save functions.

**Tech Stack:** `papaparse` v5.5.3 (CSV), `@react-pdf/renderer` v4.3.2 (PDF), `@capgo/capacitor-health` v8.2.16 (HealthKit/Health Connect), `@zumer/snapdom` v2.0.2 (DOM-to-image), `@capacitor/share` + `@capacitor/filesystem` (native file ops)

---

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install all production dependencies**

Run:
```bash
npm install papaparse @react-pdf/renderer @capgo/capacitor-health @zumer/snapdom @capacitor/share @capacitor/filesystem
```

**Step 2: Install dev dependency for papaparse types**

Run:
```bash
npm install -D @types/papaparse
```

**Step 3: Sync native projects**

Run:
```bash
npm run build:cap && npx cap sync
```

Expected: Build succeeds and new plugins sync to Android/iOS.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install export, health sync, and sharing dependencies"
```

---

### Task 2: Create cross-platform file download/share utility

**Files:**
- Create: `src/lib/export/file-utils.ts`

**Step 1: Create the utility**

This module provides a cross-platform way to download or share a file. On web, it triggers a browser download. On native, it writes to the cache directory and opens the native share sheet.

```typescript
import { isNative } from "@/lib/capacitor/platform";

/** Download a file on web, or write + share on native */
export async function downloadOrShare(options: {
  filename: string;
  data: string;
  mimeType: string;
}): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    const result = await Filesystem.writeFile({
      path: options.filename,
      data: btoa(unescape(encodeURIComponent(options.data))),
      directory: Directory.Cache,
    });

    await Share.share({
      title: options.filename,
      url: result.uri,
    });
  } else {
    const blob = new Blob([options.data], { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = options.filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

/** Share a Blob (used for PDF and images) */
export async function downloadOrShareBlob(options: {
  filename: string;
  blob: Blob;
}): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    const arrayBuffer = await options.blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const result = await Filesystem.writeFile({
      path: options.filename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: options.filename,
      url: result.uri,
    });
  } else {
    const url = URL.createObjectURL(options.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = options.filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/export/file-utils.ts
git commit -m "feat: add cross-platform file download and share utility"
```

---

### Task 3: Create CSV export module

**Files:**
- Create: `src/lib/export/csv-export.ts`

**Step 1: Create the CSV export module**

This module fetches data from Supabase by type and date range, flattens it to rows, and generates CSV via papaparse.

```typescript
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { downloadOrShare } from "./file-utils";

type ExportDataType = "workouts" | "nutrition" | "weight" | "fasting" | "goals";

async function getAuthUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function fetchWorkoutRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at, split_type")
    .eq("user_id", userId)
    .gte("started_at", `${startDate}T00:00:00`)
    .lte("started_at", `${endDate}T23:59:59`)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true });

  if (!sessions?.length) return [];

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("session_id, exercise_id, set_number, weight, reps, set_type, rpe_rir, is_pr, exercise:exercises(name)")
    .in("session_id", sessions.map((s) => s.id))
    .order("logged_at", { ascending: true });

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  return (sets || []).map((set) => {
    const session = sessionMap.get(set.session_id);
    return {
      date: session?.started_at?.split("T")[0] || "",
      split_type: session?.split_type || "",
      exercise: (set.exercise as { name: string } | null)?.name || "",
      set_number: set.set_number,
      weight: set.weight,
      reps: set.reps,
      set_type: set.set_type,
      rpe: set.rpe_rir ?? "",
      is_pr: set.is_pr ? "Yes" : "No",
    };
  });
}

async function fetchNutritionRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("nutrition_entries")
    .select("date, meal_name, food_item, calories, protein_g, carbs_g, fats_g")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return data || [];
}

async function fetchWeightRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("weight_entries")
    .select("date, weight")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return data || [];
}

async function fetchFastingRows(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("fasting_log")
    .select("date, eating_start, eating_end, target_fast_hours, achieved_fast_hours, hit_target")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return data || [];
}

async function fetchGoalRows(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("goals")
    .select("title, type, target_value, current_value, status, target_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function exportCSV(
  dataType: ExportDataType,
  startDate: string,
  endDate: string
): Promise<void> {
  const userId = await getAuthUserId();

  let rows: Record<string, unknown>[];
  switch (dataType) {
    case "workouts":
      rows = await fetchWorkoutRows(userId, startDate, endDate);
      break;
    case "nutrition":
      rows = await fetchNutritionRows(userId, startDate, endDate);
      break;
    case "weight":
      rows = await fetchWeightRows(userId, startDate, endDate);
      break;
    case "fasting":
      rows = await fetchFastingRows(userId, startDate, endDate);
      break;
    case "goals":
      rows = await fetchGoalRows(userId);
      break;
    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }

  if (rows.length === 0) throw new Error("No data found for the selected range");

  const csv = Papa.unparse(rows);
  const filename = `buffnstuff-${dataType}-${startDate}-to-${endDate}.csv`;

  await downloadOrShare({ filename, data: csv, mimeType: "text/csv;charset=utf-8;" });
}

export type { ExportDataType };
```

**Step 2: Commit**

```bash
git add src/lib/export/csv-export.ts
git commit -m "feat: add CSV export with per-type data fetching and cross-platform download"
```

---

### Task 4: Create JSON export and backup/restore module

**Files:**
- Create: `src/lib/export/json-export.ts`

**Step 1: Create the JSON export module**

This module handles both selective JSON export (by data type and date range) and full backup/restore of all user data.

```typescript
import { createClient } from "@/lib/supabase/client";
import { downloadOrShare } from "./file-utils";

const BACKUP_SCHEMA_VERSION = 1;

interface BackupData {
  schema_version: number;
  exported_at: string;
  exercises: unknown[];
  workout_templates: unknown[];
  template_exercises: unknown[];
  workout_sessions: unknown[];
  workout_sets: unknown[];
  nutrition_entries: unknown[];
  nutrition_favorites: unknown[];
  meal_plans: unknown[];
  meal_plan_items: unknown[];
  weight_entries: unknown[];
  goals: unknown[];
  user_badges: unknown[];
  fasting_settings: unknown[];
  fasting_log: unknown[];
  user_settings: unknown[];
}

async function getAuthUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function fetchTable(table: string, userId: string, filters?: { dateField?: string; startDate?: string; endDate?: string }) {
  const supabase = createClient();
  let query = supabase.from(table).select("*").eq("user_id", userId);

  if (filters?.dateField && filters.startDate && filters.endDate) {
    query = query.gte(filters.dateField, filters.startDate).lte(filters.dateField, filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Export a single data type as JSON */
export async function exportJSON(
  dataType: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const userId = await getAuthUserId();

  const dateFilters: Record<string, { table: string; dateField: string }> = {
    workouts: { table: "workout_sessions", dateField: "started_at" },
    nutrition: { table: "nutrition_entries", dateField: "date" },
    weight: { table: "weight_entries", dateField: "date" },
    fasting: { table: "fasting_log", dateField: "date" },
  };

  let data: unknown[];
  const filter = dateFilters[dataType];

  if (filter) {
    data = await fetchTable(filter.table, userId, {
      dateField: filter.dateField,
      startDate: dataType === "workouts" ? `${startDate}T00:00:00` : startDate,
      endDate: dataType === "workouts" ? `${endDate}T23:59:59` : endDate,
    });
  } else if (dataType === "goals") {
    data = await fetchTable("goals", userId);
  } else {
    throw new Error(`Unknown data type: ${dataType}`);
  }

  if (data.length === 0) throw new Error("No data found for the selected range");

  const json = JSON.stringify(data, null, 2);
  const filename = `buffnstuff-${dataType}-${startDate}-to-${endDate}.json`;

  await downloadOrShare({ filename, data: json, mimeType: "application/json" });
}

/** Create a full backup of all user data */
export async function createFullBackup(): Promise<void> {
  const userId = await getAuthUserId();
  const supabase = createClient();

  // Fetch custom exercises (user-created only)
  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId);

  // Fetch all other user-scoped tables
  const [
    templates, templateExercises, sessions, sets,
    nutritionEntries, favorites, mealPlans, mealPlanItems,
    weightEntries, goals, badges,
    fastingSettings, fastingLog, userSettings,
  ] = await Promise.all([
    fetchTable("workout_templates", userId),
    // Template exercises need to be fetched via templates
    (async () => {
      const tmpls = await fetchTable("workout_templates", userId);
      if (!tmpls.length) return [];
      const { data } = await supabase
        .from("template_exercises")
        .select("*")
        .in("template_id", tmpls.map((t: { id: string }) => t.id));
      return data || [];
    })(),
    fetchTable("workout_sessions", userId),
    (async () => {
      const sess = await fetchTable("workout_sessions", userId);
      if (!sess.length) return [];
      const { data } = await supabase
        .from("workout_sets")
        .select("*")
        .in("session_id", sess.map((s: { id: string }) => s.id));
      return data || [];
    })(),
    fetchTable("nutrition_entries", userId),
    fetchTable("nutrition_favorites", userId),
    fetchTable("meal_plans", userId),
    (async () => {
      const plans = await fetchTable("meal_plans", userId);
      if (!plans.length) return [];
      const { data } = await supabase
        .from("meal_plan_items")
        .select("*")
        .in("plan_id", plans.map((p: { id: string }) => p.id));
      return data || [];
    })(),
    fetchTable("weight_entries", userId),
    fetchTable("goals", userId),
    fetchTable("user_badges", userId),
    (async () => {
      const { data } = await supabase.from("fasting_settings").select("*").eq("user_id", userId);
      return data || [];
    })(),
    fetchTable("fasting_log", userId),
    (async () => {
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId);
      return data || [];
    })(),
  ]);

  const backup: BackupData = {
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    exercises: exercises || [],
    workout_templates: templates,
    template_exercises: templateExercises,
    workout_sessions: sessions,
    workout_sets: sets,
    nutrition_entries: nutritionEntries,
    nutrition_favorites: favorites,
    meal_plans: mealPlans,
    meal_plan_items: mealPlanItems,
    weight_entries: weightEntries,
    goals,
    user_badges: badges,
    fasting_settings: fastingSettings,
    fasting_log: fastingLog,
    user_settings: userSettings,
  };

  const date = new Date().toISOString().split("T")[0];
  const json = JSON.stringify(backup, null, 2);
  const filename = `buffnstuff-backup-${date}.json`;

  await downloadOrShare({ filename, data: json, mimeType: "application/json" });
}

/** Restore from a backup JSON file. Returns a summary of what was restored. */
export async function restoreFromBackup(
  jsonString: string
): Promise<{ restored: Record<string, number>; skipped: Record<string, number> }> {
  const backup = JSON.parse(jsonString) as BackupData;

  if (!backup.schema_version || backup.schema_version > BACKUP_SCHEMA_VERSION) {
    throw new Error("Unsupported backup version");
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const restored: Record<string, number> = {};
  const skipped: Record<string, number> = {};

  async function upsertRows(table: string, rows: unknown[]) {
    if (!rows.length) return;
    let restoredCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      // Override user_id to current user
      if ("user_id" in record) record.user_id = user!.id;

      const { error } = await supabase.from(table).upsert(record, { onConflict: "id", ignoreDuplicates: true });
      if (error) {
        skippedCount++;
      } else {
        restoredCount++;
      }
    }

    restored[table] = restoredCount;
    if (skippedCount > 0) skipped[table] = skippedCount;
  }

  // Restore in dependency order
  await upsertRows("exercises", backup.exercises);
  await upsertRows("workout_templates", backup.workout_templates);
  await upsertRows("template_exercises", backup.template_exercises);
  await upsertRows("workout_sessions", backup.workout_sessions);
  await upsertRows("workout_sets", backup.workout_sets);
  await upsertRows("nutrition_entries", backup.nutrition_entries);
  await upsertRows("nutrition_favorites", backup.nutrition_favorites);
  await upsertRows("meal_plans", backup.meal_plans);
  await upsertRows("meal_plan_items", backup.meal_plan_items);
  await upsertRows("weight_entries", backup.weight_entries);
  await upsertRows("goals", backup.goals);
  await upsertRows("user_badges", backup.user_badges);
  await upsertRows("fasting_log", backup.fasting_log);

  return { restored, skipped };
}

export { BACKUP_SCHEMA_VERSION };
export type { BackupData };
```

**Step 2: Commit**

```bash
git add src/lib/export/json-export.ts
git commit -m "feat: add JSON export, full backup, and restore from backup"
```

---

### Task 5: Create PDF report component

**Files:**
- Create: `src/lib/export/pdf-report.tsx`

**Step 1: Create the PDF report**

This is a React PDF document using `@react-pdf/renderer`. It renders a multi-page progress report for a given date range.

```tsx
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  coverPage: { padding: 40, fontFamily: "Helvetica", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#888", marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8, marginTop: 16 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#333", paddingVertical: 4, marginBottom: 2 },
  cell: { flex: 1, fontSize: 9 },
  headerCell: { flex: 1, fontSize: 9, fontWeight: "bold" },
  statBox: { padding: 8, marginBottom: 8, backgroundColor: "#f5f5f5", borderRadius: 4 },
  statLabel: { fontSize: 8, color: "#888" },
  statValue: { fontSize: 18, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: "#aaa", textAlign: "center" },
});

export interface ReportData {
  userName: string;
  startDate: string;
  endDate: string;
  summary: {
    workoutsCompleted: number;
    totalVolume: number;
    totalSets: number;
    avgDailyCalories: number;
    weightChange: string;
    prsHit: number;
  };
  workoutLog: { date: string; split: string; exercise: string; topSet: string }[];
  nutritionAvg: { calories: number; protein: number; carbs: number; fats: number };
  nutritionTargets: { calories: number; protein: number; carbs: number; fats: number };
  weightData: { date: string; weight: number }[];
  fastingAdherence: { percentage: number; streak: number; protocol: string };
  goals: { title: string; type: string; progress: number; status: string }[];
}

export function ProgressReport({ data }: { data: ReportData }) {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.title}>BuffNStuff</Text>
        <Text style={styles.subtitle}>Progress Report</Text>
        <Text style={{ fontSize: 12, marginTop: 16 }}>
          {data.startDate} — {data.endDate}
        </Text>
        {data.userName && (
          <Text style={{ fontSize: 12, marginTop: 8, color: "#666" }}>{data.userName}</Text>
        )}
      </Page>

      {/* Summary + Workout Log */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { label: "Workouts", value: data.summary.workoutsCompleted.toString() },
            { label: "Total Volume", value: `${data.summary.totalVolume.toLocaleString()} lbs` },
            { label: "Total Sets", value: data.summary.totalSets.toString() },
            { label: "Avg Daily Cal", value: data.summary.avgDailyCalories.toString() },
            { label: "Weight Change", value: data.summary.weightChange },
            { label: "PRs Hit", value: data.summary.prsHit.toString() },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statBox, { width: "30%" }]}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Workout Log</Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerCell}>Date</Text>
          <Text style={styles.headerCell}>Split</Text>
          <Text style={styles.headerCell}>Exercise</Text>
          <Text style={styles.headerCell}>Top Set</Text>
        </View>
        {data.workoutLog.slice(0, 40).map((row, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.cell}>{row.date}</Text>
            <Text style={styles.cell}>{row.split}</Text>
            <Text style={styles.cell}>{row.exercise}</Text>
            <Text style={styles.cell}>{row.topSet}</Text>
          </View>
        ))}
        <Text style={styles.footer}>Generated by BuffNStuff</Text>
      </Page>

      {/* Nutrition + Weight + Fasting + Goals */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Nutrition Overview</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["Calories", "Protein (g)", "Carbs (g)", "Fats (g)"].map((label, i) => {
            const keys = ["calories", "protein", "carbs", "fats"] as const;
            const actual = data.nutritionAvg[keys[i]];
            const target = data.nutritionTargets[keys[i]];
            return (
              <View key={label} style={[styles.statBox, { width: "23%" }]}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{actual}</Text>
                <Text style={{ fontSize: 8, color: "#888" }}>Target: {target}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Weight Trend</Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerCell}>Date</Text>
          <Text style={styles.headerCell}>Weight</Text>
        </View>
        {data.weightData.slice(0, 30).map((row, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.cell}>{row.date}</Text>
            <Text style={styles.cell}>{row.weight}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Fasting Adherence</Text>
        <View style={styles.statBox}>
          <Text style={{ fontSize: 12 }}>
            Protocol: {data.fastingAdherence.protocol} | Adherence: {data.fastingAdherence.percentage}% | Streak: {data.fastingAdherence.streak} days
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Goals</Text>
        {data.goals.map((goal, i) => (
          <View key={i} style={{ marginBottom: 6 }}>
            <Text style={{ fontWeight: "bold", fontSize: 10 }}>
              {goal.title} ({goal.status})
            </Text>
            <Text style={{ fontSize: 9, color: "#666" }}>
              {goal.type} — {goal.progress}% complete
            </Text>
          </View>
        ))}
        <Text style={styles.footer}>Generated by BuffNStuff</Text>
      </Page>
    </Document>
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/export/pdf-report.tsx
git commit -m "feat: add PDF progress report component with multi-page layout"
```

---

### Task 6: Create PDF data fetcher and download trigger component

**Files:**
- Create: `src/components/export/pdf-preview.tsx`

**Step 1: Create the PDF download component**

This component fetches all the data needed for the PDF report, then renders a download link.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSettings } from "@/lib/database/settings";
import { getFastingSettings, getFastingStreak } from "@/lib/database/fasting";
import type { ReportData } from "@/lib/export/pdf-report";
import { downloadOrShareBlob } from "@/lib/export/file-utils";
import { toast } from "sonner";

interface PDFPreviewProps {
  startDate: string;
  endDate: string;
}

async function gatherReportData(startDate: string, endDate: string): Promise<ReportData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const settings = await getSettings();

  // Fetch workout sessions + sets
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at, split_type")
    .eq("user_id", user.id)
    .gte("started_at", `${startDate}T00:00:00`)
    .lte("started_at", `${endDate}T23:59:59`)
    .not("ended_at", "is", null);

  const sessionIds = sessions?.map((s) => s.id) || [];
  const { data: allSets } = sessionIds.length
    ? await supabase
        .from("workout_sets")
        .select("session_id, weight, reps, is_pr, exercise:exercises(name)")
        .in("session_id", sessionIds)
    : { data: [] };

  const totalVolume = (allSets || []).reduce((sum, s) => sum + s.weight * s.reps, 0);
  const prsHit = (allSets || []).filter((s) => s.is_pr).length;

  // Build workout log (top set per exercise per session)
  const workoutLog: ReportData["workoutLog"] = [];
  const sessionMap = new Map((sessions || []).map((s) => [s.id, s]));
  const grouped = new Map<string, typeof allSets>();
  for (const set of allSets || []) {
    const key = `${set.session_id}-${(set.exercise as { name: string } | null)?.name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(set);
  }
  for (const [key, sets] of grouped) {
    const best = sets.reduce((a, b) => (a.weight * a.reps > b.weight * b.reps ? a : b));
    const session = sessionMap.get(best.session_id);
    workoutLog.push({
      date: session?.started_at?.split("T")[0] || "",
      split: session?.split_type || "",
      exercise: (best.exercise as { name: string } | null)?.name || "",
      topSet: `${best.weight} × ${best.reps}`,
    });
  }

  // Fetch nutrition
  const { data: nutritionEntries } = await supabase
    .from("nutrition_entries")
    .select("date, calories, protein_g, carbs_g, fats_g")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate);

  const uniqueDays = new Set((nutritionEntries || []).map((e) => e.date));
  const dayCount = uniqueDays.size || 1;
  const totalCal = (nutritionEntries || []).reduce((s, e) => s + e.calories, 0);
  const totalPro = (nutritionEntries || []).reduce((s, e) => s + e.protein_g, 0);
  const totalCarb = (nutritionEntries || []).reduce((s, e) => s + e.carbs_g, 0);
  const totalFat = (nutritionEntries || []).reduce((s, e) => s + e.fats_g, 0);

  // Fetch weight
  const { data: weightEntries } = await supabase
    .from("weight_entries")
    .select("date, weight")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  const weightData = (weightEntries || []).map((w) => ({ date: w.date, weight: w.weight }));
  const weightChange =
    weightData.length >= 2
      ? `${(weightData[weightData.length - 1].weight - weightData[0].weight).toFixed(1)} lbs`
      : "N/A";

  // Fetch fasting
  const fastingSettings = await getFastingSettings();
  const { data: fastingLogs } = await supabase
    .from("fasting_log")
    .select("hit_target")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate);

  const fastingTotal = fastingLogs?.length || 0;
  const fastingHit = fastingLogs?.filter((l) => l.hit_target).length || 0;
  const fastingStreak = await getFastingStreak();

  // Fetch goals
  const { data: goals } = await supabase
    .from("goals")
    .select("title, type, target_value, current_value, status")
    .eq("user_id", user.id);

  return {
    userName: settings?.display_name || "",
    startDate,
    endDate,
    summary: {
      workoutsCompleted: sessions?.length || 0,
      totalVolume,
      totalSets: allSets?.length || 0,
      avgDailyCalories: Math.round(totalCal / dayCount),
      weightChange,
      prsHit,
    },
    workoutLog,
    nutritionAvg: {
      calories: Math.round(totalCal / dayCount),
      protein: Math.round(totalPro / dayCount),
      carbs: Math.round(totalCarb / dayCount),
      fats: Math.round(totalFat / dayCount),
    },
    nutritionTargets: {
      calories: settings?.daily_calorie_target || 2500,
      protein: settings?.protein_target_g || 180,
      carbs: settings?.carbs_target_g || 280,
      fats: settings?.fats_target_g || 80,
    },
    weightData,
    fastingAdherence: {
      percentage: fastingTotal > 0 ? Math.round((fastingHit / fastingTotal) * 100) : 0,
      streak: fastingStreak,
      protocol: fastingSettings?.protocol || "Not configured",
    },
    goals: (goals || []).map((g) => ({
      title: g.title,
      type: g.type,
      progress: g.target_value ? Math.round((g.current_value / g.target_value) * 100) : 0,
      status: g.status,
    })),
  };
}

export function PDFDownloadButton({ startDate, endDate }: PDFPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const data = await gatherReportData(startDate, endDate);

      // Dynamic import to avoid SSR issues with @react-pdf/renderer
      const { pdf } = await import("@react-pdf/renderer");
      const { ProgressReport } = await import("@/lib/export/pdf-report");

      const blob = await pdf(<ProgressReport data={data} />).toBlob();
      const filename = `buffnstuff-report-${startDate}-to-${endDate}.pdf`;

      await downloadOrShareBlob({ filename, blob });
      toast.success("PDF report downloaded!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button onClick={handleDownload} disabled={isGenerating} className="gap-2">
      {isGenerating ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      {isGenerating ? "Generating..." : "Download PDF Report"}
    </Button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/export/pdf-preview.tsx
git commit -m "feat: add PDF download button with report data gathering"
```

---

### Task 7: Build export panel component and export page

**Files:**
- Create: `src/components/export/export-panel.tsx`
- Create: `src/app/(app)/settings/export/page.tsx`

**Step 1: Create the export panel**

```tsx
"use client";

import { useState } from "react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { FileSpreadsheet, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportCSV, type ExportDataType } from "@/lib/export/csv-export";
import { exportJSON } from "@/lib/export/json-export";
import { PDFDownloadButton } from "./pdf-preview";
import { toast } from "sonner";

type ExportFormat = "csv" | "json" | "pdf";
type DatePreset = "this_week" | "last_7" | "this_month" | "last_30" | "custom";

const DATA_TYPES: { value: ExportDataType; label: string }[] = [
  { value: "workouts", label: "Workouts" },
  { value: "nutrition", label: "Nutrition" },
  { value: "weight", label: "Weight" },
  { value: "fasting", label: "Fasting Log" },
  { value: "goals", label: "Goals" },
];

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  switch (preset) {
    case "this_week":
      return { start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"), end: today };
    case "last_7":
      return { start: format(subDays(new Date(), 6), "yyyy-MM-dd"), end: today };
    case "this_month":
      return { start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: today };
    case "last_30":
      return { start: format(subDays(new Date(), 29), "yyyy-MM-dd"), end: today };
    default:
      return { start: today, end: today };
  }
}

export function ExportPanel() {
  const [dataType, setDataType] = useState<ExportDataType>("workouts");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { start, end } =
    datePreset === "custom"
      ? { start: customStart, end: customEnd }
      : getDateRange(datePreset);

  async function handleExport() {
    if (!start || !end) {
      toast.error("Please select a date range");
      return;
    }
    setIsExporting(true);
    try {
      if (exportFormat === "csv") {
        await exportCSV(dataType, start, end);
        toast.success("CSV exported!");
      } else if (exportFormat === "json") {
        await exportJSON(dataType, start, end);
        toast.success("JSON exported!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Data</CardTitle>
        <CardDescription>Download your fitness data in CSV, JSON, or PDF format</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={dataType} onValueChange={(v) => setDataType(v as ExportDataType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="pdf">PDF Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_7">Last 7 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_30">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {datePreset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        {exportFormat === "pdf" ? (
          <PDFDownloadButton startDate={start} endDate={end} />
        ) : (
          <Button onClick={handleExport} disabled={isExporting} className="w-full gap-2">
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : exportFormat === "csv" ? (
              <FileSpreadsheet className="size-4" />
            ) : (
              <FileJson className="size-4" />
            )}
            {isExporting ? "Exporting..." : `Export ${exportFormat.toUpperCase()}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create the export page**

```tsx
"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ExportPanel } from "@/components/export/export-panel";
import { BackupRestore } from "@/components/export/backup-restore";

export default function ExportPage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Data Export</h1>
          <p className="text-sm text-muted-foreground">Export, backup, and restore your data</p>
        </div>
      </div>

      <ExportPanel />
      <BackupRestore />
    </div>
  );
}
```

Note: `BackupRestore` is created in the next task. The page will have a TypeScript error until Task 8 is complete — that's expected.

**Step 3: Commit**

```bash
git add src/components/export/export-panel.tsx "src/app/(app)/settings/export/page.tsx"
git commit -m "feat: add export panel with data type, date range, and format selection"
```

---

### Task 8: Build backup and restore component

**Files:**
- Create: `src/components/export/backup-restore.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useRef, useState } from "react";
import { Download, Upload, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createFullBackup, restoreFromBackup } from "@/lib/export/json-export";
import { toast } from "sonner";

export function BackupRestore() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    setIsBackingUp(true);
    try {
      await createFullBackup();
      toast.success("Full backup created!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreSummary(null);
    try {
      const text = await file.text();
      const { restored, skipped } = await restoreFromBackup(text);
      setRestoreSummary(restored);

      const totalRestored = Object.values(restored).reduce((a, b) => a + b, 0);
      const totalSkipped = Object.values(skipped).reduce((a, b) => a + b, 0);

      toast.success(
        `Restored ${totalRestored} records${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ""}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setIsRestoring(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Backup & Restore
        </CardTitle>
        <CardDescription>
          Create a full backup of all your data or restore from a previous backup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button onClick={handleBackup} disabled={isBackingUp} variant="outline" className="flex-1 gap-2">
            {isBackingUp ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {isBackingUp ? "Backing up..." : "Create Backup"}
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            variant="outline"
            className="flex-1 gap-2"
          >
            {isRestoring ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {isRestoring ? "Restoring..." : "Restore from File"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {restoreSummary && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-sm font-medium">Restore Complete</p>
            {Object.entries(restoreSummary)
              .filter(([, count]) => count > 0)
              .map(([table, count]) => (
                <p key={table} className="text-xs text-muted-foreground">
                  {table.replace(/_/g, " ")}: {count} records
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/export/backup-restore.tsx
git commit -m "feat: add backup and restore component with file upload"
```

---

### Task 9: Add export link to Settings page

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add a data export link card to the Settings page**

Add import at the top:
```typescript
import Link from "next/link";
import { Database } from "lucide-react";
```

Add a "Data" section AFTER `<FastingSettings />` and BEFORE `<TDEECalculator>`:
```tsx
      {/* Data Export & Backup */}
      <Link
        href="/settings/export"
        className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
      >
        <Database className="size-5 text-muted-foreground" />
        <div>
          <p className="font-medium">Data Export & Backup</p>
          <p className="text-sm text-muted-foreground">
            Export CSV/JSON/PDF, backup and restore your data
          </p>
        </div>
      </Link>
```

**Step 2: Commit**

```bash
git add "src/app/(app)/settings/page.tsx"
git commit -m "feat: add data export link to settings page"
```

---

### Task 10: Create health sync utility

**Files:**
- Create: `src/lib/export/health-sync.ts`

**Step 1: Create the health sync module**

This module pushes data to HealthKit (iOS) or Health Connect (Android) via `@capgo/capacitor-health`. It's a no-op on web.

```typescript
import { isNative } from "@/lib/capacitor/platform";

/** Check if health sync is available on this platform */
export function isHealthSyncAvailable(): boolean {
  return isNative();
}

/** Request health permissions. Returns true if granted. */
export async function requestHealthPermissions(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { CapacitorHealth } = await import("@capgo/capacitor-health");

    const result = await CapacitorHealth.requestAuthorization({
      read: ["weight", "workout"],
      write: ["weight", "workout"],
    });

    return result.granted ?? false;
  } catch {
    return false;
  }
}

/** Push a workout session to Health */
export async function syncWorkoutToHealth(workout: {
  startDate: string;
  endDate: string;
  calories?: number;
}): Promise<void> {
  if (!isNative()) return;

  try {
    const { CapacitorHealth } = await import("@capgo/capacitor-health");

    await CapacitorHealth.saveSample({
      sampleType: "workout",
      startDate: workout.startDate,
      endDate: workout.endDate,
      value: workout.calories?.toString() || "0",
      unit: "kcal",
    });
  } catch (err) {
    console.error("Failed to sync workout to Health:", err);
  }
}

/** Push a weight entry to Health */
export async function syncWeightToHealth(weight: {
  date: string;
  value: number;
  unit: "lbs" | "kg";
}): Promise<void> {
  if (!isNative()) return;

  try {
    const { CapacitorHealth } = await import("@capgo/capacitor-health");

    // Health Connect / HealthKit use kg
    const weightKg = weight.unit === "lbs" ? weight.value * 0.453592 : weight.value;

    await CapacitorHealth.saveSample({
      sampleType: "weight",
      startDate: weight.date,
      endDate: weight.date,
      value: weightKg.toString(),
      unit: "kg",
    });
  } catch (err) {
    console.error("Failed to sync weight to Health:", err);
  }
}

/** Push nutrition calories to Health */
export async function syncNutritionToHealth(entry: {
  date: string;
  calories: number;
}): Promise<void> {
  if (!isNative()) return;

  try {
    const { CapacitorHealth } = await import("@capgo/capacitor-health");

    await CapacitorHealth.saveSample({
      sampleType: "nutrition",
      startDate: entry.date,
      endDate: entry.date,
      value: entry.calories.toString(),
      unit: "kcal",
    });
  } catch (err) {
    console.error("Failed to sync nutrition to Health:", err);
  }
}
```

Note: The `@capgo/capacitor-health` API may vary slightly from what's shown here. The implementer should check the actual plugin types after install and adjust the method names/parameters if needed. The key pattern is dynamic import + `isNative()` guard + try/catch for graceful failure.

**Step 2: Commit**

```bash
git add src/lib/export/health-sync.ts
git commit -m "feat: add health sync utility for HealthKit and Health Connect"
```

---

### Task 11: Build health sync settings component

**Files:**
- Create: `src/components/settings/health-sync-settings.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  isHealthSyncAvailable,
  requestHealthPermissions,
} from "@/lib/export/health-sync";
import { toast } from "sonner";

export function HealthSyncSettings() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  if (!isHealthSyncAvailable()) return null;

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const granted = await requestHealthPermissions();
      if (granted) {
        setIsConnected(true);
        toast.success("Connected to Health!");
      } else {
        toast.error("Health permissions not granted");
      }
    } catch {
      toast.error("Failed to connect to Health");
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5" />
          Health Sync
        </CardTitle>
        <CardDescription>
          Sync workouts, weight, and nutrition to Apple Health or Health Connect
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isConnected
            ? "Connected — data will auto-sync when you log workouts, weight, or nutrition."
            : "Connect to push your fitness data to your device's health app."}
        </p>
        <Button
          onClick={handleConnect}
          disabled={isConnecting || isConnected}
          variant={isConnected ? "secondary" : "default"}
          className="gap-2"
        >
          {isConnecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Activity className="size-4" />
          )}
          {isConnected ? "Connected" : isConnecting ? "Connecting..." : "Connect to Health"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to Settings page**

Add import to `src/app/(app)/settings/page.tsx`:
```typescript
import { HealthSyncSettings } from "@/components/settings/health-sync-settings";
```

Add `<HealthSyncSettings />` AFTER the Data Export link and BEFORE `<TDEECalculator>`.

**Step 3: Commit**

```bash
git add src/components/settings/health-sync-settings.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat: add health sync settings with connect button (native only)"
```

---

### Task 12: Create shareable progress card templates

**Files:**
- Create: `src/components/sharing/pr-card.tsx`
- Create: `src/components/sharing/streak-card.tsx`
- Create: `src/components/sharing/summary-card.tsx`
- Create: `src/components/sharing/fasting-card.tsx`

**Step 1: Create PR card**

```tsx
interface PRCardProps {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  unit: string;
}

export function PRCard({ exercise, weight, reps, date, unit }: PRCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-green-900/40 to-zinc-900 border border-green-500/20 flex flex-col items-center justify-center p-16 relative">
        <p className="text-green-400 text-3xl font-medium tracking-wider uppercase mb-4">
          New Personal Record!
        </p>
        <p className="text-7xl font-bold mb-6">{exercise}</p>
        <p className="text-8xl font-black tabular-nums">
          {weight} {unit} × {reps}
        </p>
        <p className="text-2xl text-zinc-400 mt-8">{date}</p>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
```

**Step 2: Create streak card**

```tsx
interface StreakCardProps {
  streak: number;
  type: "workout" | "fasting";
}

export function StreakCard({ streak, type }: StreakCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-orange-900/40 to-zinc-900 border border-orange-500/20 flex flex-col items-center justify-center p-16 relative">
        <p className="text-9xl mb-4">🔥</p>
        <p className="text-[10rem] font-black tabular-nums leading-none">{streak}</p>
        <p className="text-4xl font-medium text-orange-300 mt-4">
          Day {type === "workout" ? "Workout" : "Fasting"} Streak
        </p>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
```

**Step 3: Create summary card**

```tsx
interface SummaryCardProps {
  workouts: number;
  totalVolume: number;
  avgCalories: number;
  weightChange: string;
  period: string;
}

export function SummaryCard({ workouts, totalVolume, avgCalories, weightChange, period }: SummaryCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-blue-900/40 to-zinc-900 border border-blue-500/20 flex flex-col items-center justify-center p-16 gap-8 relative">
        <p className="text-blue-400 text-3xl font-medium tracking-wider uppercase">
          {period}
        </p>
        <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
          {[
            { label: "Workouts", value: workouts.toString() },
            { label: "Volume", value: `${totalVolume.toLocaleString()} lbs` },
            { label: "Avg Calories", value: avgCalories.toString() },
            { label: "Weight", value: weightChange },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-6xl font-black tabular-nums">{stat.value}</p>
              <p className="text-xl text-zinc-400 mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
```

**Step 4: Create fasting card**

```tsx
interface FastingCardProps {
  protocol: string;
  streak: number;
  adherencePercent: number;
}

export function FastingCard({ protocol, streak, adherencePercent }: FastingCardProps) {
  return (
    <div
      id="share-card"
      className="flex flex-col items-center justify-center w-[1080px] h-[1080px] bg-zinc-950 text-white p-16"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="w-full h-full rounded-3xl bg-gradient-to-br from-purple-900/40 to-zinc-900 border border-purple-500/20 flex flex-col items-center justify-center p-16 relative">
        <p className="text-purple-400 text-3xl font-medium tracking-wider uppercase mb-6">
          Intermittent Fasting
        </p>
        <p className="text-8xl font-black mb-4">{protocol}</p>
        <div className="flex gap-16 mt-8">
          <div className="text-center">
            <p className="text-7xl font-black tabular-nums">{streak}</p>
            <p className="text-xl text-zinc-400 mt-2">Day Streak</p>
          </div>
          <div className="text-center">
            <p className="text-7xl font-black tabular-nums">{adherencePercent}%</p>
            <p className="text-xl text-zinc-400 mt-2">Adherence</p>
          </div>
        </div>
        <p className="absolute bottom-8 right-12 text-xl text-zinc-600 font-medium">BuffNStuff</p>
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/components/sharing/pr-card.tsx src/components/sharing/streak-card.tsx src/components/sharing/summary-card.tsx src/components/sharing/fasting-card.tsx
git commit -m "feat: add shareable progress card templates (PR, streak, summary, fasting)"
```

---

### Task 13: Create progress card capture and share utility

**Files:**
- Create: `src/lib/sharing/progress-cards.ts`

**Step 1: Create the capture + share utility**

```typescript
import { isNative } from "@/lib/capacitor/platform";

/** Capture an element to PNG and share/download it */
export async function captureAndShare(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const { snapdom } = await import("@zumer/snapdom");

  const dataUrl = await snapdom.toPng(element);

  // Convert data URL to blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: "BuffNStuff Progress",
      url: result.uri,
    });
  } else {
    // Web: trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/sharing/progress-cards.ts
git commit -m "feat: add progress card capture and share utility using snapdom"
```

---

### Task 14: Build share card preview page

**Files:**
- Create: `src/components/sharing/share-card-preview.tsx`
- Create: `src/app/(app)/share/page.tsx`

**Step 1: Create the card picker and preview component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRCard } from "./pr-card";
import { StreakCard } from "./streak-card";
import { SummaryCard } from "./summary-card";
import { FastingCard } from "./fasting-card";
import { captureAndShare } from "@/lib/sharing/progress-cards";
import { getCurrentStreak, getRecentPRs, getWeeklySummary } from "@/lib/database/stats";
import { getFastingStreak, getFastingSettings } from "@/lib/database/fasting";
import { getSettings } from "@/lib/database/settings";
import { toast } from "sonner";

type CardType = "pr" | "streak" | "summary" | "fasting";

export function ShareCardPreview() {
  const [cardType, setCardType] = useState<CardType>("streak");
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Data state
  const [prData, setPrData] = useState<{ exercise: string; weight: number; reps: number; date: string } | null>(null);
  const [streakData, setStreakData] = useState(0);
  const [summaryData, setSummaryData] = useState({ workouts: 0, totalVolume: 0, avgCalories: 0, weightChange: "N/A" });
  const [fastingData, setFastingData] = useState({ protocol: "16:8", streak: 0, adherence: 0 });
  const [unit, setUnit] = useState("lbs");

  useEffect(() => {
    async function load() {
      try {
        const [streak, prs, summary, fastingStreak, fastingSettings, settings] = await Promise.all([
          getCurrentStreak(),
          getRecentPRs(1),
          getWeeklySummary(),
          getFastingStreak(),
          getFastingSettings(),
          getSettings(),
        ]);

        setStreakData(streak);
        setUnit(settings?.unit_preference || "lbs");

        if (prs.length > 0) {
          const pr = prs[0];
          setPrData({
            exercise: (pr as { exercise_name?: string }).exercise_name || "Exercise",
            weight: (pr as { weight?: number }).weight || 0,
            reps: (pr as { reps?: number }).reps || 0,
            date: (pr as { date?: string }).date || new Date().toISOString().split("T")[0],
          });
        }

        setSummaryData({
          workouts: summary.daysThisWeek,
          totalVolume: summary.totalVolume,
          avgCalories: 0, // Would need nutrition data
          weightChange: "N/A",
        });

        setFastingData({
          protocol: fastingSettings?.protocol || "Not set",
          streak: fastingStreak,
          adherence: 0,
        });
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleShare() {
    const el = cardRef.current?.querySelector("#share-card") as HTMLElement | null;
    if (!el) return;

    setIsSharing(true);
    try {
      await captureAndShare(el, `buffnstuff-${cardType}-${Date.now()}.png`);
      toast.success("Card shared!");
    } catch (err) {
      console.error("Share failed:", err);
      toast.error("Failed to share card");
    } finally {
      setIsSharing(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="size-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select value={cardType} onValueChange={(v) => setCardType(v as CardType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="streak">Workout Streak</SelectItem>
            {prData && <SelectItem value="pr">Personal Record</SelectItem>}
            <SelectItem value="summary">Weekly Summary</SelectItem>
            <SelectItem value="fasting">Fasting Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Card preview (scaled down for display) */}
      <div ref={cardRef} className="overflow-hidden rounded-lg border" style={{ maxHeight: 400 }}>
        <div style={{ transform: "scale(0.35)", transformOrigin: "top left", width: 1080, height: 1080 }}>
          {cardType === "pr" && prData && (
            <PRCard exercise={prData.exercise} weight={prData.weight} reps={prData.reps} date={prData.date} unit={unit} />
          )}
          {cardType === "streak" && <StreakCard streak={streakData} type="workout" />}
          {cardType === "summary" && (
            <SummaryCard
              workouts={summaryData.workouts}
              totalVolume={summaryData.totalVolume}
              avgCalories={summaryData.avgCalories}
              weightChange={summaryData.weightChange}
              period="This Week"
            />
          )}
          {cardType === "fasting" && (
            <FastingCard protocol={fastingData.protocol} streak={fastingData.streak} adherencePercent={fastingData.adherence} />
          )}
        </div>
      </div>

      <Button onClick={handleShare} disabled={isSharing} className="w-full gap-2">
        {isSharing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        {isSharing ? "Sharing..." : "Share Card"}
      </Button>
    </div>
  );
}
```

**Step 2: Create the share page**

```tsx
"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ShareCardPreview } from "@/components/sharing/share-card-preview";

export default function SharePage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Share Progress</h1>
          <p className="text-sm text-muted-foreground">Create and share progress cards</p>
        </div>
      </div>

      <ShareCardPreview />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/sharing/share-card-preview.tsx "src/app/(app)/share/page.tsx"
git commit -m "feat: add share card preview page with card picker and capture"
```

---

### Task 15: Add share link to dashboard or navigation

**Files:**
- Modify: `src/app/(app)/nutrition/page.tsx` (or dashboard — add a share button)

**Step 1: Add a share button**

Add to the nutrition page (or dashboard) a small share button that links to `/share`. Add import:
```typescript
import { Share2 } from "lucide-react";
```

Add a link in the header area:
```tsx
<Link href="/share">
  <Button variant="outline" size="sm" className="gap-1">
    <Share2 className="size-3.5" />
    Share
  </Button>
</Link>
```

The exact placement depends on the current page layout. Add it near the existing "Plans" and "Save Day" buttons on the nutrition page, or in the dashboard header.

**Step 2: Commit**

```bash
git add "src/app/(app)/nutrition/page.tsx"
git commit -m "feat: add share progress button to nutrition page"
```

---

### Task 16: Final verification — lint and build targets

**Files:** None (verification only)

**Step 1: Run ESLint**

Run:
```bash
npm run lint
```

Expected: No NEW errors from Phase 13 files. Pre-existing errors from earlier phases are OK.

**Step 2: Run SSR build**

Run:
```bash
npm run build
```

Expected: Build succeeds with all new routes showing (`/settings/export`, `/share`).

**Step 3: Run Capacitor static export build**

Run:
```bash
npm run build:cap
```

Expected: Build succeeds with all new routes in the output.

**Step 4: Commit any fixes**

If lint or build issues are found, fix them and commit:
```bash
git add -A
git commit -m "fix: resolve lint and build issues for Phase 13"
```

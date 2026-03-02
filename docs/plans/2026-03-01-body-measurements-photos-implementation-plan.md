# Body Measurements & Progress Photos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add body composition tracking with tape measurements (10 body parts) and progress photos with side-by-side comparison to the BuffNStuff fitness app.

**Architecture:** New `/body` page with two tabs (Measurements, Photos). Two new Supabase tables (`body_measurements`, `progress_photos`) and a Supabase Storage bucket (`progress-photos`). Database layer follows the existing upsert pattern from `weight.ts`. Components follow the existing Card/Recharts patterns from the progress page. Photos use the existing Capacitor camera module on native and file input on web.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgREST + Storage), Recharts, date-fns, lucide-react, shadcn/ui, Capacitor camera

---

## Task 1: Add TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

**Context:** The types file contains all interfaces for the app (465 lines). New types go at the end, before the closing AI Coach section. Follow existing patterns: interfaces with string IDs, nullable fields, `created_at` timestamps.

**Step 1: Add new types to database.ts**

Add these after the `AIInsight` interface (line 465) at the end of the file:

```typescript
// --- Body Measurements & Progress Photos ---

export type PhotoPose = "front" | "side" | "back";

export type MeasurementField =
  | "neck" | "chest" | "waist" | "hips"
  | "left_bicep" | "right_bicep"
  | "left_thigh" | "right_thigh"
  | "left_calf" | "right_calf";

export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  neck: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  left_bicep: number | null;
  right_bicep: number | null;
  left_thigh: number | null;
  right_thigh: number | null;
  left_calf: number | null;
  right_calf: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  user_id: string;
  date: string;
  pose: PhotoPose;
  storage_path: string;
  created_at: string;
}
```

**Step 2: Verify the build still passes**

Run: `npx next lint`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(body): add BodyMeasurement, ProgressPhoto, and PhotoPose types"
```

---

## Task 2: Create Measurements Database Layer

**Files:**
- Create: `src/lib/database/measurements.ts`

**Context:** Follow the exact pattern from `src/lib/database/weight.ts`. Every function: creates Supabase client, gets authenticated user, queries `body_measurements` table. The upsert pattern checks for existing entry by `user_id` + `date`, then updates or inserts.

**Step 1: Create measurements.ts**

```typescript
import { createClient } from "@/lib/supabase/client";
import type { BodyMeasurement, MeasurementField } from "@/types";

export type MeasurementInput = Partial<Record<MeasurementField, number | null>> & {
  notes?: string | null;
};

export async function logMeasurements(
  date: string,
  input: MeasurementInput
): Promise<BodyMeasurement> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("body_measurements")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("body_measurements")
      .update(input)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as BodyMeasurement;
  }

  const { data, error } = await supabase
    .from("body_measurements")
    .insert({ user_id: user.id, date, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as BodyMeasurement;
}

export async function getMeasurementHistory(
  days: number = 90
): Promise<BodyMeasurement[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDateStr)
    .order("date", { ascending: true });

  if (error) throw error;
  return data as BodyMeasurement[];
}

export async function getLatestMeasurement(): Promise<BodyMeasurement | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as BodyMeasurement) || null;
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/database/measurements.ts
git commit -m "feat(body): add measurements database layer (log, history, latest)"
```

---

## Task 3: Create Photos Database Layer

**Files:**
- Create: `src/lib/database/photos.ts`

**Context:** This is the first feature using Supabase Storage. Key APIs: `supabase.storage.from("progress-photos").upload(path, file)` to upload, `.createSignedUrl(path, seconds)` to get a temporary URL, `.remove([path])` to delete. The DB row in `progress_photos` stores the `storage_path` (not the URL). Photo files come as either `File` objects (web file input) or base64 data URLs (Capacitor camera).

**Step 1: Create photos.ts**

```typescript
import { createClient } from "@/lib/supabase/client";
import type { ProgressPhoto, PhotoPose } from "@/types";

const BUCKET = "progress-photos";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadProgressPhoto(
  date: string,
  pose: PhotoPose,
  fileOrDataUrl: File | string
): Promise<ProgressPhoto> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const storagePath = `${user.id}/${date}_${pose}.jpg`;

  const fileToUpload =
    typeof fileOrDataUrl === "string"
      ? dataUrlToBlob(fileOrDataUrl)
      : fileOrDataUrl;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileToUpload, {
      upsert: true,
      contentType: "image/jpeg",
    });
  if (uploadError) throw uploadError;

  // Upsert the DB row (same date + pose = replace)
  const { data: existing } = await supabase
    .from("progress_photos")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("pose", pose)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("progress_photos")
      .update({ storage_path: storagePath })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ProgressPhoto;
  }

  const { data, error } = await supabase
    .from("progress_photos")
    .insert({
      user_id: user.id,
      date,
      pose,
      storage_path: storagePath,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProgressPhoto;
}

export async function getProgressPhotos(
  days: number = 365
): Promise<ProgressPhoto[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDateStr)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as ProgressPhoto[];
}

export async function getPhotoUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: photo, error: fetchError } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (fetchError) throw fetchError;

  if (photo) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  }

  const { error } = await supabase
    .from("progress_photos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/database/photos.ts
git commit -m "feat(body): add photos database layer with Supabase Storage"
```

---

## Task 4: Create Measurement Form Component

**Files:**
- Create: `src/components/body/measurement-form.tsx`

**Context:** Follow the pattern from `src/components/progress/weight-tracker.tsx`: Card with CardHeader/CardContent, Input fields, Button with submit handler, loading state. Group 10 fields into 3 sections (upper/core/lower). Show the most recent measurement value as placeholder text. Date defaults to today.

**Step 1: Create measurement-form.tsx**

```typescript
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Ruler, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logMeasurements, type MeasurementInput } from "@/lib/database/measurements";
import type { BodyMeasurement, MeasurementField } from "@/types";

interface MeasurementFormProps {
  latest: BodyMeasurement | null;
  onSaved: () => void;
}

const FIELD_GROUPS: { label: string; fields: { key: MeasurementField; label: string }[] }[] = [
  {
    label: "Upper Body",
    fields: [
      { key: "neck", label: "Neck" },
      { key: "chest", label: "Chest" },
      { key: "left_bicep", label: "L Bicep" },
      { key: "right_bicep", label: "R Bicep" },
    ],
  },
  {
    label: "Core",
    fields: [
      { key: "waist", label: "Waist" },
      { key: "hips", label: "Hips" },
    ],
  },
  {
    label: "Lower Body",
    fields: [
      { key: "left_thigh", label: "L Thigh" },
      { key: "right_thigh", label: "R Thigh" },
      { key: "left_calf", label: "L Calf" },
      { key: "right_calf", label: "R Calf" },
    ],
  },
];

export function MeasurementForm({ latest, onSaved }: MeasurementFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(field: MeasurementField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    const input: MeasurementInput = {};
    let hasValue = false;

    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const raw = values[f.key];
        if (raw) {
          const num = parseFloat(raw);
          if (!isNaN(num) && num > 0) {
            input[f.key] = num;
            hasValue = true;
          }
        }
      }
    }

    if (!hasValue) return;
    if (notes.trim()) input.notes = notes.trim();

    setIsSubmitting(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      await logMeasurements(today, input);
      setValues({});
      setNotes("");
      onSaved();
    } catch {
      // Silently handle
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ruler className="size-4" />
          Log Measurements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {FIELD_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground w-14 shrink-0">
                    {f.label}
                  </label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    placeholder={latest?.[f.key]?.toString() || "—"}
                    value={values[f.key] || ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-sm"
        />

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || Object.keys(values).length === 0}
          className="w-full"
          size="sm"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Save Measurements"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/body/measurement-form.tsx
git commit -m "feat(body): add measurement form component with grouped fields"
```

---

## Task 5: Create Measurement Summary Component

**Files:**
- Create: `src/components/body/measurement-summary.tsx`

**Context:** Shows latest measurements with deltas from previous entry. Follow the grid layout pattern from `WeightTracker` (grid-cols-3 with current/change values). Color deltas green/red based on whether decrease is desirable (waist decreasing = green, bicep growing = green).

**Step 1: Create measurement-summary.tsx**

```typescript
"use client";

import { TrendingDown, TrendingUp, Minus, Ruler } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BodyMeasurement, MeasurementField } from "@/types";

interface MeasurementSummaryProps {
  latest: BodyMeasurement | null;
  previous: BodyMeasurement | null;
}

// Fields where decrease is considered "good" (losing inches)
const DECREASE_IS_GOOD: MeasurementField[] = ["waist", "hips"];

const FIELD_LABELS: Record<MeasurementField, string> = {
  neck: "Neck",
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  left_bicep: "L Bicep",
  right_bicep: "R Bicep",
  left_thigh: "L Thigh",
  right_thigh: "R Thigh",
  left_calf: "L Calf",
  right_calf: "R Calf",
};

const ALL_FIELDS: MeasurementField[] = [
  "neck", "chest", "waist", "hips",
  "left_bicep", "right_bicep",
  "left_thigh", "right_thigh",
  "left_calf", "right_calf",
];

function DeltaDisplay({ field, current, prev }: { field: MeasurementField; current: number; prev: number | null }) {
  if (prev === null) return null;
  const delta = Math.round((current - prev) * 10) / 10;
  if (delta === 0) return <Minus className="size-3 text-muted-foreground inline" />;

  const isGood = DECREASE_IS_GOOD.includes(field) ? delta < 0 : delta > 0;

  return (
    <span className={isGood ? "text-emerald-400" : "text-red-400"}>
      {delta > 0 ? "+" : ""}{delta}
    </span>
  );
}

export function MeasurementSummary({ latest, previous }: MeasurementSummaryProps) {
  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ruler className="size-4" />
            Latest Measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No measurements logged yet. Use the form below to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const populated = ALL_FIELDS.filter((f) => latest[f] !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ruler className="size-4" />
            Latest Measurements
          </CardTitle>
          <span className="text-xs text-muted-foreground">{latest.date}</span>
        </div>
      </CardHeader>
      <CardContent>
        {populated.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No values recorded in latest entry.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {populated.map((field) => (
              <div key={field} className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase">
                  {FIELD_LABELS[field]}
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {latest[field]}
                </p>
                <p className="text-xs tabular-nums">
                  <DeltaDisplay
                    field={field}
                    current={latest[field]!}
                    prev={previous?.[field] ?? null}
                  />
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/body/measurement-summary.tsx
git commit -m "feat(body): add measurement summary card with delta indicators"
```

---

## Task 6: Create Measurement Chart Component

**Files:**
- Create: `src/components/body/measurement-chart.tsx`

**Context:** Follow the exact pattern from `src/components/progress/weight-chart.tsx`: Card with range selector buttons (30d/90d/1y), Recharts `LineChart` in a `ResponsiveContainer`, custom tooltip. This chart shows multiple body part lines with toggleable visibility.

**Step 1: Create measurement-chart.tsx**

```typescript
"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BodyMeasurement, MeasurementField } from "@/types";

interface MeasurementChartProps {
  data: BodyMeasurement[];
  selectedRange: number;
  onRangeChange: (days: number) => void;
}

const RANGE_OPTIONS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

const FIELD_CONFIG: { key: MeasurementField; label: string; color: string }[] = [
  { key: "neck", label: "Neck", color: "hsl(210 70% 55%)" },
  { key: "chest", label: "Chest", color: "hsl(142 70% 45%)" },
  { key: "waist", label: "Waist", color: "hsl(0 70% 55%)" },
  { key: "hips", label: "Hips", color: "hsl(280 70% 55%)" },
  { key: "left_bicep", label: "L Bicep", color: "hsl(45 80% 50%)" },
  { key: "right_bicep", label: "R Bicep", color: "hsl(45 80% 65%)" },
  { key: "left_thigh", label: "L Thigh", color: "hsl(180 60% 45%)" },
  { key: "right_thigh", label: "R Thigh", color: "hsl(180 60% 60%)" },
  { key: "left_calf", label: "L Calf", color: "hsl(30 70% 50%)" },
  { key: "right_calf", label: "R Calf", color: "hsl(30 70% 65%)" },
];

function formatDateLabel(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T00:00:00"), "MMM d");
  } catch {
    return dateStr;
  }
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">
        {label ? formatDateLabel(label) : ""}
      </p>
      {payload.map((entry: TooltipPayloadItem) => {
        const config = FIELD_CONFIG.find((f) => f.key === entry.name);
        return (
          <p key={entry.name} className="tabular-nums" style={{ color: entry.color }}>
            {config?.label || entry.name}: {entry.value}
          </p>
        );
      })}
    </div>
  );
}

export function MeasurementChart({
  data,
  selectedRange,
  onRangeChange,
}: MeasurementChartProps) {
  // Default: show waist, chest, biceps
  const [visible, setVisible] = useState<Set<MeasurementField>>(
    new Set(["waist", "chest", "left_bicep", "right_bicep"])
  );

  function toggleField(field: MeasurementField) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  // Only show fields that have at least one data point
  const availableFields = FIELD_CONFIG.filter((f) =>
    data.some((d) => d[f.key] !== null)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Measurement Trends</CardTitle>
          <div className="flex items-center gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.days}
                variant={selectedRange === opt.days ? "default" : "ghost"}
                size="xs"
                onClick={() => onRangeChange(opt.days)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No measurement data yet. Log measurements to see trends.
          </div>
        ) : (
          <>
            {/* Field toggles */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {availableFields.map((f) => (
                <button
                  key={f.key}
                  onClick={() => toggleField(f.key)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    visible.has(f.key)
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground"
                  }`}
                  style={
                    visible.has(f.key)
                      ? { backgroundColor: f.color }
                      : undefined
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(240 3.7% 25%)"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    stroke="hsl(240 5% 55%)"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="hsl(240 5% 55%)"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {FIELD_CONFIG.filter((f) => visible.has(f.key)).map((f) => (
                    <Line
                      key={f.key}
                      type="monotone"
                      dataKey={f.key}
                      stroke={f.color}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/body/measurement-chart.tsx
git commit -m "feat(body): add measurement chart with toggleable body part lines"
```

---

## Task 7: Create Photo Capture Component

**Files:**
- Create: `src/components/body/photo-capture.tsx`

**Context:** On native (Capacitor), use `takePhoto()` and `pickFromGallery()` from `src/lib/capacitor/camera.ts`. On web, use a standard `<input type="file" accept="image/*">`. The `isNative()` function from `src/lib/capacitor/platform.ts` detects the platform. Show a preview before uploading. Pose selector is 3 toggle buttons (front/side/back).

**Step 1: Create photo-capture.tsx**

```typescript
"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Camera, Upload, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { uploadProgressPhoto } from "@/lib/database/photos";
import { isNative } from "@/lib/capacitor/platform";
import { takePhoto, pickFromGallery } from "@/lib/capacitor/camera";
import type { PhotoPose } from "@/types";

interface PhotoCaptureProps {
  onUploaded: () => void;
}

const POSES: { value: PhotoPose; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
  { value: "back", label: "Back" },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function PhotoCapture({ onUploaded }: PhotoCaptureProps) {
  const [pose, setPose] = useState<PhotoPose>("front");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > MAX_FILE_SIZE) {
      setError("File must be under 5MB");
      return;
    }

    setError(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleNativeCapture(source: "camera" | "gallery") {
    setError(null);
    const result = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (!result) return;
    setPreview(result.dataUrl);
    setFile(result.dataUrl);
  }

  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      await uploadProgressPhoto(today, pose, file);
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleClear() {
    setPreview(null);
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="size-4" />
          Add Progress Photo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pose selector */}
        <div className="flex gap-1">
          {POSES.map((p) => (
            <Button
              key={p.value}
              variant={pose === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPose(p.value)}
              className="flex-1"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Preview */}
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt={`${pose} preview`}
              className="w-full max-h-64 object-contain rounded-md bg-zinc-900"
            />
            <Button
              variant="ghost"
              size="xs"
              onClick={handleClear}
              className="absolute top-2 right-2 text-xs"
            >
              Clear
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 rounded-md border border-dashed border-border text-muted-foreground">
            <ImagePlus className="size-8 mb-2 opacity-50" />
            <p className="text-xs">Select or capture a photo</p>
          </div>
        )}

        {/* Capture/upload buttons */}
        {!preview && (
          <div className="flex gap-2">
            {isNative() ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNativeCapture("camera")}
                  className="flex-1"
                >
                  <Camera className="size-4 mr-1.5" />
                  Camera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNativeCapture("gallery")}
                  className="flex-1"
                >
                  <ImagePlus className="size-4 mr-1.5" />
                  Gallery
                </Button>
              </>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="size-4 mr-1.5" />
                  Choose Photo
                </Button>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {/* Upload button */}
        {preview && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
            size="sm"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Upload className="size-4 mr-1.5" />
                Upload {pose} Photo
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/body/photo-capture.tsx
git commit -m "feat(body): add photo capture component with native camera and web upload"
```

---

## Task 8: Create Photo Gallery Component

**Files:**
- Create: `src/components/body/photo-gallery.tsx`

**Context:** Groups photos by date, showing up to 3 thumbnails per date (front/side/back). Uses `getPhotoUrl()` to get signed URLs for display. Photos are sorted newest first. Delete button calls `deleteProgressPhoto()`.

**Step 1: Create photo-gallery.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhotoUrl, deleteProgressPhoto } from "@/lib/database/photos";
import type { ProgressPhoto, PhotoPose } from "@/types";

interface PhotoGalleryProps {
  photos: ProgressPhoto[];
  onDeleted: () => void;
}

interface PhotoWithUrl extends ProgressPhoto {
  url: string | null;
}

const POSE_ORDER: PhotoPose[] = ["front", "side", "back"];

export function PhotoGallery({ photos, onDeleted }: PhotoGalleryProps) {
  const [photosWithUrls, setPhotosWithUrls] = useState<PhotoWithUrl[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function loadUrls() {
      const withUrls = await Promise.all(
        photos.map(async (p) => ({
          ...p,
          url: await getPhotoUrl(p.storage_path),
        }))
      );
      setPhotosWithUrls(withUrls);
    }
    loadUrls();
  }, [photos]);

  // Group by date
  const grouped = new Map<string, PhotoWithUrl[]>();
  for (const p of photosWithUrls) {
    const existing = grouped.get(p.date) || [];
    existing.push(p);
    grouped.set(p.date, existing);
  }

  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteProgressPhoto(id);
      onDeleted();
    } catch {
      // Silently handle
    } finally {
      setDeleting(null);
    }
  }

  if (photos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4" />
            Photo Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No progress photos yet. Capture your first photo above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4" />
          Photo Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedDates.map((date) => {
          const datePhotos = grouped.get(date)!;
          const sorted = POSE_ORDER.map((pose) =>
            datePhotos.find((p) => p.pose === pose)
          ).filter(Boolean) as PhotoWithUrl[];

          return (
            <div key={date}>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {format(new Date(date + "T00:00:00"), "MMM d, yyyy")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {sorted.map((photo) => (
                  <div key={photo.id} className="relative group">
                    {photo.url ? (
                      <button
                        onClick={() =>
                          setExpanded(expanded === photo.id ? null : photo.id)
                        }
                        className="w-full"
                      >
                        <img
                          src={photo.url}
                          alt={`${photo.pose} - ${photo.date}`}
                          className="w-full aspect-[3/4] object-cover rounded-md bg-zinc-900"
                        />
                      </button>
                    ) : (
                      <div className="w-full aspect-[3/4] rounded-md bg-zinc-900 flex items-center justify-center">
                        <ImageIcon className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1 rounded capitalize">
                      {photo.pose}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDelete(photo.id)}
                      disabled={deleting === photo.id}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    >
                      <Trash2 className="size-3 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Expanded view */}
              {sorted.some((p) => expanded === p.id) && (
                <div className="mt-2">
                  {sorted
                    .filter((p) => p.id === expanded)
                    .map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.url!}
                        alt={`${photo.pose} - ${photo.date}`}
                        className="w-full max-h-96 object-contain rounded-md bg-zinc-900"
                      />
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/body/photo-gallery.tsx
git commit -m "feat(body): add photo gallery component with timeline grouping"
```

---

## Task 9: Create Photo Compare Component

**Files:**
- Create: `src/components/body/photo-compare.tsx`

**Context:** Side-by-side photo comparison. Two date selectors built from available photo dates. Pose selector (front/side/back). Shows two images next to each other. If measurements exist for both dates, shows deltas below.

**Step 1: Create photo-compare.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhotoUrl } from "@/lib/database/photos";
import type { ProgressPhoto, PhotoPose, BodyMeasurement, MeasurementField } from "@/types";

interface PhotoCompareProps {
  photos: ProgressPhoto[];
  measurements: BodyMeasurement[];
}

const POSES: PhotoPose[] = ["front", "side", "back"];

const COMPARE_FIELDS: { key: MeasurementField; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "left_bicep", label: "L Bicep" },
  { key: "right_bicep", label: "R Bicep" },
];

export function PhotoCompare({ photos, measurements }: PhotoCompareProps) {
  const [pose, setPose] = useState<PhotoPose>("front");
  const [dateA, setDateA] = useState<string>("");
  const [dateB, setDateB] = useState<string>("");
  const [urlA, setUrlA] = useState<string | null>(null);
  const [urlB, setUrlB] = useState<string | null>(null);

  // Get unique dates that have the selected pose
  const availableDates = Array.from(
    new Set(photos.filter((p) => p.pose === pose).map((p) => p.date))
  ).sort();

  // Auto-select first and last dates when pose changes
  useEffect(() => {
    if (availableDates.length >= 2) {
      setDateA(availableDates[0]);
      setDateB(availableDates[availableDates.length - 1]);
    } else if (availableDates.length === 1) {
      setDateA(availableDates[0]);
      setDateB("");
    } else {
      setDateA("");
      setDateB("");
    }
  }, [pose, photos.length]);

  // Load photo URLs when dates change
  useEffect(() => {
    async function loadUrls() {
      const photoA = photos.find((p) => p.pose === pose && p.date === dateA);
      const photoB = photos.find((p) => p.pose === pose && p.date === dateB);
      setUrlA(photoA ? await getPhotoUrl(photoA.storage_path) : null);
      setUrlB(photoB ? await getPhotoUrl(photoB.storage_path) : null);
    }
    if (dateA || dateB) loadUrls();
  }, [dateA, dateB, pose, photos]);

  // Find measurements for selected dates
  const measA = measurements.find((m) => m.date === dateA);
  const measB = measurements.find((m) => m.date === dateB);

  if (photos.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="size-4" />
            Compare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Take at least 2 progress photos to compare them side by side.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="size-4" />
          Compare
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pose selector */}
        <div className="flex gap-1">
          {POSES.map((p) => (
            <Button
              key={p}
              variant={pose === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPose(p)}
              className="flex-1 capitalize"
            >
              {p}
            </Button>
          ))}
        </div>

        {/* Date selectors */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={dateA}
            onChange={(e) => setDateA(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Before</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {format(new Date(d + "T00:00:00"), "MMM d, yyyy")}
              </option>
            ))}
          </select>
          <select
            value={dateB}
            onChange={(e) => setDateB(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">After</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {format(new Date(d + "T00:00:00"), "MMM d, yyyy")}
              </option>
            ))}
          </select>
        </div>

        {/* Side-by-side photos */}
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-[3/4] rounded-md bg-zinc-900 overflow-hidden">
            {urlA ? (
              <img src={urlA} alt="Before" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                {dateA ? "Loading..." : "Select date"}
              </div>
            )}
          </div>
          <div className="aspect-[3/4] rounded-md bg-zinc-900 overflow-hidden">
            {urlB ? (
              <img src={urlB} alt="After" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                {dateB ? "Loading..." : "Select date"}
              </div>
            )}
          </div>
        </div>

        {/* Measurement deltas */}
        {measA && measB && (
          <div className="grid grid-cols-5 gap-1 text-center">
            {COMPARE_FIELDS.map((f) => {
              const valA = measA[f.key];
              const valB = measB[f.key];
              if (valA === null || valB === null) return null;
              const delta = Math.round((valB - valA) * 10) / 10;
              return (
                <div key={f.key}>
                  <p className="text-[10px] text-muted-foreground">{f.label}</p>
                  <p
                    className={`text-xs font-bold tabular-nums ${
                      delta < 0 ? "text-emerald-400" : delta > 0 ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}{delta}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/body/photo-compare.tsx
git commit -m "feat(body): add photo comparison component with measurement deltas"
```

---

## Task 10: Create Body Page

**Files:**
- Create: `src/app/(app)/body/page.tsx`

**Context:** Follow the pattern from `src/app/(app)/progress/page.tsx`: "use client" page with Tabs (from `@/components/ui/tabs`), useEffect data loading, loading state. Two tabs: Measurements and Photos. Data fetched on mount and refreshed via callbacks.

**Step 1: Create the body page**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeasurementForm } from "@/components/body/measurement-form";
import { MeasurementSummary } from "@/components/body/measurement-summary";
import { MeasurementChart } from "@/components/body/measurement-chart";
import { PhotoCapture } from "@/components/body/photo-capture";
import { PhotoGallery } from "@/components/body/photo-gallery";
import { PhotoCompare } from "@/components/body/photo-compare";
import {
  getMeasurementHistory,
  getLatestMeasurement,
} from "@/lib/database/measurements";
import { getProgressPhotos } from "@/lib/database/photos";
import type { BodyMeasurement, ProgressPhoto } from "@/types";

export default function BodyPage() {
  const [measurementRange, setMeasurementRange] = useState(90);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [latest, setLatest] = useState<BodyMeasurement | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMeasurements = useCallback(async () => {
    try {
      const [history, latestEntry] = await Promise.all([
        getMeasurementHistory(measurementRange),
        getLatestMeasurement(),
      ]);
      setMeasurements(history);
      setLatest(latestEntry);
    } catch {
      // Silently handle
    }
  }, [measurementRange]);

  const loadPhotos = useCallback(async () => {
    try {
      const data = await getProgressPhotos(365);
      setPhotos(data);
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([loadMeasurements(), loadPhotos()]);
      setIsLoading(false);
    }
    init();
  }, [loadMeasurements, loadPhotos]);

  // Get previous measurement for delta calculation
  const previous = measurements.length >= 2 ? measurements[measurements.length - 2] : null;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Body</h1>
        <p className="text-sm text-muted-foreground">
          Track measurements and progress photos.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="measurements">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>

          <TabsContent value="measurements" className="mt-4 space-y-6">
            <MeasurementSummary latest={latest} previous={previous} />
            <MeasurementForm latest={latest} onSaved={loadMeasurements} />
            <MeasurementChart
              data={measurements}
              selectedRange={measurementRange}
              onRangeChange={setMeasurementRange}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-4 space-y-6">
            <PhotoCapture onUploaded={loadPhotos} />
            <PhotoGallery photos={photos} onDeleted={loadPhotos} />
            <PhotoCompare photos={photos} measurements={measurements} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

**Step 2: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(app\)/body/page.tsx
git commit -m "feat(body): add body page with measurements and photos tabs"
```

---

## Task 11: Update Navigation

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx`
- Modify: `src/components/layout/sidebar-nav.tsx`

**Context:** Both nav files use an array of `{ href, label, icon }` objects. Add a "Body" entry between Calendar and Nutrition, using the `Ruler` icon from lucide-react.

**Step 1: Update bottom-nav.tsx**

In `src/components/layout/bottom-nav.tsx`:

1. Add `Ruler` to the lucide-react import (line 6):
```typescript
import { Home, Dumbbell, BookOpen, CalendarDays, Ruler, Apple, Bot, BarChart3 } from "lucide-react";
```

2. Add the Body tab after Calendar (after line 13, the Calendar entry):
```typescript
  { href: "/body", label: "Body", icon: Ruler },
```

The `tabs` array should now be:
```typescript
const tabs = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/exercises", label: "Exercises", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/body", label: "Body", icon: Ruler },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];
```

**Step 2: Update sidebar-nav.tsx**

In `src/components/layout/sidebar-nav.tsx`:

1. Add `Ruler` to the lucide-react import (line 6):
```typescript
import { Home, Dumbbell, BookOpen, CalendarDays, Ruler, Apple, BarChart3, Settings, LogOut, Bot } from "lucide-react";
```

2. Add the Body nav item after Calendar (after line 14, the Calendar entry):
```typescript
  { href: "/body", label: "Body", icon: Ruler },
```

The `navItems` array should now be:
```typescript
const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/exercises", label: "Exercises", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/body", label: "Body", icon: Ruler },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

**Step 3: Verify lint passes**

Run: `npx next lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/bottom-nav.tsx src/components/layout/sidebar-nav.tsx
git commit -m "feat(body): add Body to bottom nav and sidebar navigation"
```

---

## Task 12: Lint and Build Verification

**Files:** None (verification only)

**Context:** The project must pass both the SSR build (`npm run build`) and the Capacitor static build (`npm run build:cap`). The cap build uses `scripts/cap-build.mjs` which temporarily moves `src/app/api` during static export. Since the new `/body` page is a client-side page with no dynamic route segments, both builds should pass.

**Step 1: Run linter**

Run: `npx next lint`
Expected: No errors or warnings. If there are warnings, fix them.

**Step 2: Run SSR build**

Run: `npm run build`
Expected: Build completes successfully. All routes compile.

**Step 3: Run Capacitor build**

Run: `npm run build:cap`
Expected: Build completes successfully. The `/body` page is included in the static export.

**Step 4: Fix any issues found**

If either build fails, investigate the error and fix it. Common issues:
- Unused imports: remove them
- Missing type exports: add them to `src/types/index.ts` if needed
- Dynamic route issues: the `/body` page uses no dynamic segments, so this shouldn't apply

**Step 5: Commit any fixes**

If fixes were needed:
```bash
git add -A
git commit -m "fix: resolve build issues for body measurements feature"
```

# Phase 18: Body Measurements & Progress Photos — Design

## Goal

Add body composition tracking with tape measurements (10 body parts) and progress photos with side-by-side comparison, giving users a complete picture of physique changes alongside the existing weight and training data.

## Architecture

**New page:** `/body` with two tabs — Measurements and Photos. Separate from the existing `/progress` page (which focuses on training metrics like exercise progression, volume, and frequency).

**Storage:** Supabase Storage bucket `progress-photos` for image files. Photos stored as `{user_id}/{date}_{pose}.jpg`. On web, users upload via file input. On native (Capacitor), the existing `camera.ts` handles capture.

**Data:** Two new Supabase tables (`body_measurements`, `progress_photos`). Client queries through the standard Supabase client pattern used everywhere else.

**Units:** Respects the user's unit preference from settings (imperial = inches, metric = cm). Stored in the user's preferred unit.

## Data Model

### `body_measurements` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK to auth.users, NOT NULL |
| date | date | One entry per date per user (unique constraint) |
| neck | float | nullable |
| chest | float | nullable |
| waist | float | nullable |
| hips | float | nullable |
| left_bicep | float | nullable |
| right_bicep | float | nullable |
| left_thigh | float | nullable |
| right_thigh | float | nullable |
| left_calf | float | nullable |
| right_calf | float | nullable |
| notes | text | nullable |
| created_at | timestamptz | default now() |

RLS: Users can only read/write their own rows.

### `progress_photos` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK to auth.users, NOT NULL |
| date | date | NOT NULL |
| pose | text | 'front' / 'side' / 'back' |
| storage_path | text | Path in Supabase Storage bucket |
| created_at | timestamptz | default now() |

RLS: Users can only read/write their own rows.

### Supabase Storage

- Bucket: `progress-photos` (private, authenticated access only)
- Path convention: `{user_id}/{date}_{pose}.jpg`
- Max file size: 5MB
- Allowed types: image/jpeg, image/png, image/webp

## Types

```typescript
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
  pose: "front" | "side" | "back";
  storage_path: string;
  created_at: string;
}

export type MeasurementField =
  | "neck" | "chest" | "waist" | "hips"
  | "left_bicep" | "right_bicep"
  | "left_thigh" | "right_thigh"
  | "left_calf" | "right_calf";
```

## Database Functions

### `src/lib/database/measurements.ts`

- `logMeasurements(date, measurements)` — Upsert body measurements for a date (same pattern as `logWeight`)
- `getMeasurementHistory(days)` — Fetch measurements for last N days
- `getLatestMeasurement()` — Get most recent entry (for form placeholders)

### `src/lib/database/photos.ts`

- `uploadProgressPhoto(date, pose, file)` — Upload to Supabase Storage, insert DB row
- `getProgressPhotos(days)` — Fetch photo metadata for last N days
- `getPhotoUrl(storagePath)` — Get signed URL for a photo
- `deleteProgressPhoto(id)` — Remove from storage and DB

## Components

### 1. `src/components/body/measurement-form.tsx`

Input form for body measurements. Shows 10 numeric fields grouped by body region (upper/core/lower). Most recent values shown as placeholders so users only need to enter what changed. Date picker defaults to today. Save button upserts.

### 2. `src/components/body/measurement-chart.tsx`

Recharts LineChart showing measurement trends over time. Dropdown to select which body parts to show (multi-select). Same range selector pattern as WeightChart (30/60/90/180/365 days).

### 3. `src/components/body/measurement-summary.tsx`

Card showing latest measurements with delta from previous entry. Color-coded: green for decrease (waist/hips = losing), or context-aware (biceps growing = green). Shows "no data" state gracefully.

### 4. `src/components/body/photo-capture.tsx`

Photo upload component. Pose selector (front/side/back buttons). On native: uses Capacitor camera (takePhoto/pickFromGallery). On web: file input with accept="image/*". Preview before upload. Date selector defaults to today.

### 5. `src/components/body/photo-gallery.tsx`

Timeline gallery grouped by date. Each date row shows up to 3 thumbnails (front/side/back). Tap to view full size. Delete option. Sorted newest first.

### 6. `src/components/body/photo-compare.tsx`

Side-by-side comparison. Two date pickers + pose selector. Renders two photos next to each other. Shows measurement deltas between the two dates (if measurements exist for both). Empty state guides user to take photos first.

## Page

### `src/app/(app)/body/page.tsx`

```
/body
├── Tabs: Measurements | Photos
├── Measurements tab:
│   ├── MeasurementSummary (latest values + deltas)
│   ├── MeasurementForm (log new)
│   └── MeasurementChart (trends)
└── Photos tab:
    ├── PhotoCapture (upload new)
    ├── PhotoGallery (timeline)
    └── PhotoCompare (side-by-side)
```

## Navigation

Add "Body" to bottom nav and sidebar between Calendar and Nutrition:
- Icon: `Ruler` from lucide-react
- Href: `/body`
- Label: "Body"

## Error Handling

- Photo upload failures: Show toast with retry option
- Storage quota exceeded: Show "Storage full" message
- Missing camera permissions (native): Graceful fallback message
- Web file too large (>5MB): Validate before upload, show size warning
- No measurements yet: Empty state with "Log your first measurement" CTA

# Phase 13: Data Export & Integrations — Design

**Date:** 2026-02-28
**Branch:** `feature/phase-13-data-export`
**Status:** Approved

## Goal

Add comprehensive data export (CSV, JSON, PDF reports), Apple Health/Health Connect sync, shareable progress cards, and full backup/restore — all working across web and native with offline support.

## 1. Data Export (CSV / JSON / PDF)

### Export Panel UX

- New route: `/settings/export` — accessible from Settings page via a "Data Export" link
- User selects: data type, date range, format
- Data types available for export: Workouts, Nutrition, Weight, Fasting Log, Goals, All (backup)
- Date range: preset shortcuts (This Week, Last 7 Days, This Month, Last 30 Days, Custom) plus custom start/end date pickers
- Format: CSV, JSON, or PDF Report

### CSV Export — `papaparse` v5.5.3

- `Papa.unparse()` handles escaping, quotes, Unicode edge cases
- On web: Blob download via `URL.createObjectURL()`
- On native: write to cache via `@capacitor/filesystem`, then open native share sheet via `@capacitor/share`
- Each data type maps to a flat table:
  - Workouts: date, split_type, exercise, sets, reps, weight, rpe, is_pr
  - Nutrition: date, meal_name, food_item, calories, protein_g, carbs_g, fats_g
  - Weight: date, weight
  - Fasting: date, eating_start, eating_end, target_hours, achieved_hours, hit_target
  - Goals: title, type, target_value, current_value, status, target_date

### JSON Export

- Same data selection as CSV but outputs structured JSON
- Preserves nested relationships (e.g., workout sessions with their sets)
- Used for backup/restore and data portability

### PDF Reports — `@react-pdf/renderer` v4.3.2

- Declarative React components (`<Document>`, `<Page>`, `<View>`, `<Text>`)
- Custom date range with preset shortcuts
- Multi-page report sections:
  - **Cover page:** BuffNStuff logo, date range, user name
  - **Summary stats:** workouts completed, total volume, avg daily calories, weight change, PRs hit
  - **Workout log:** table with date, split, exercises, top sets per exercise
  - **Nutrition overview:** daily averages vs targets, macro breakdown
  - **Weight trend:** tabular weight data with change indicators
  - **Fasting adherence:** percentage, streak, protocol
  - **Goal progress:** each goal with progress bar representation
- Uses `PDFDownloadLink` for both web and Capacitor webview compatibility

## 2. Apple Health / Health Connect Sync

### Plugin: `@capgo/capacitor-health` v8.2.16

- Single unified plugin for both platforms:
  - **iOS** → HealthKit
  - **Android** → Health Connect (Google Fit is deprecated as of June 2025)
- **Export-only** (one-way push from BuffNStuff → Health apps)
- Hidden on web via `isNative()` check

### Data Types Pushed

| BuffNStuff Data | HealthKit/Health Connect Type |
|-----------------|------------------------------|
| Workout sessions | Workout (type, duration, calories) |
| Weight entries | Body Mass |
| Nutrition entries | Dietary Energy (calories) |

### Sync Behavior

- **Settings toggle** in Settings page → "Health Sync" section
- When enabled, data auto-pushes on save:
  - `endWorkoutSession()` → push workout to Health
  - `logWeight()` → push weight to Health
  - `addNutritionEntry()` → push calories to Health
- One-time historical backfill option: "Sync Past Data" button pushes all existing data
- Sync status indicator showing last sync time

### Platform Setup Requirements

**iOS:**
- HealthKit capability in Xcode
- `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` in Info.plist

**Android:**
- Min SDK 26+ in build.gradle
- Health Connect permissions in AndroidManifest.xml

## 3. Shareable Progress Cards

### Image Generation: `@zumer/snapdom` v2.0.2

- Renders styled React components to PNG (148x faster than html2canvas, zero dependencies)
- Card is a normal React component → captured to PNG → shared

### Card Types

| Card | Content | When to Show |
|------|---------|-------------|
| **PR Card** | Exercise name, weight × reps, date, "New Personal Record!" | After logging a PR |
| **Streak Card** | Current streak count, flame icon, "X Day Workout Streak" | From dashboard |
| **Weekly Summary** | Workouts count, total volume, avg calories, weight change | End of week / on demand |
| **Fasting Card** | Protocol badge, streak count, adherence % | From nutrition page |

### Share Flow

1. User taps "Share" button (available on dashboard, progress page, after PR)
2. Card type picker appears (if multiple options)
3. Preview renders the card component
4. "Share" button captures to PNG via snapdom
5. Native: opens share sheet via `@capacitor/share`
6. Web: downloads PNG file

### Card Styling

- Dark theme matching app aesthetic (zinc-950 background)
- BuffNStuff branding in corner
- Gradient accents matching card type (green for PR, orange for streak, blue for summary)
- Fixed aspect ratio: 1080×1080 (Instagram-friendly square)

## 4. Backup & Restore

### Full Backup

- Exports ALL user data as a single JSON file:
  - exercises (custom only), workout templates, template exercises
  - workout sessions, workout sets
  - nutrition entries, nutrition favorites, meal plans, meal plan items
  - weight entries, goals, badges
  - fasting settings, fasting log
  - user settings
- File naming: `buffnstuff-backup-{date}.json`
- Includes schema version for forward compatibility

### Restore from Backup

- Upload/select a backup JSON file
- Validation: check schema version, verify structure
- Conflict resolution: skip entries with duplicate IDs (existing data wins)
- Progress indicator during restore
- Summary after restore: "Restored X workouts, Y nutrition entries, Z weight entries..."

### Location

- Settings page → "Data" section with "Export Data" link and "Backup & Restore" card
- Backup button generates and downloads/shares the file
- Restore button opens file picker

## 5. Cross-Platform Feature Parity

| Feature | Web (PC) | Native (Phone) |
|---------|----------|----------------|
| CSV/JSON export | Browser download | Filesystem + share sheet |
| PDF report | Browser download | Filesystem + share sheet |
| Health sync | Hidden | HealthKit (iOS) / Health Connect (Android) |
| Share cards | PNG download | Native share sheet |
| Backup/restore | Browser download/upload | Filesystem + file picker |

## 6. Dependencies (New — Latest as of Feb 2026)

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-pdf/renderer` | ^4.3.2 | PDF report generation |
| `papaparse` | ^5.5.3 | CSV generation/parsing |
| `@types/papaparse` | latest | TypeScript types (dev) |
| `@capgo/capacitor-health` | ^8.2.16 | HealthKit + Health Connect |
| `@zumer/snapdom` | ^2.0.2 | DOM-to-image for share cards |
| `@capacitor/share` | ^6.0.0 | Native share sheet |
| `@capacitor/filesystem` | ^6.0.0 | Write files on native |

## 7. File Structure (New)

```
src/
├── lib/
│   ├── export/
│   │   ├── csv-export.ts          — CSV generation + download/share
│   │   ├── json-export.ts         — JSON export + backup/restore logic
│   │   ├── pdf-report.tsx         — React PDF report component
│   │   ├── health-sync.ts         — HealthKit/Health Connect push
│   │   └── file-utils.ts          — Cross-platform download/share helper
│   └── sharing/
│       └── progress-cards.ts      — snapdom capture + share
├── components/
│   ├── export/
│   │   ├── export-panel.tsx       — Data type + date range + format picker
│   │   ├── pdf-preview.tsx        — PDF download trigger
│   │   └── backup-restore.tsx     — Full backup/restore UI
│   ├── sharing/
│   │   ├── share-card-preview.tsx — Card type picker + preview + share
│   │   ├── pr-card.tsx            — PR achievement card template
│   │   ├── streak-card.tsx        — Streak card template
│   │   ├── summary-card.tsx       — Weekly summary card template
│   │   └── fasting-card.tsx       — Fasting achievement card template
│   └── settings/
│       └── health-sync-settings.tsx — Health sync toggle + status
├── app/(app)/
│   ├── settings/
│   │   └── export/
│   │       └── page.tsx           — Export & backup page
│   └── share/
│       └── page.tsx               — Share card picker page
```

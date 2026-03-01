# Phase 12: Nutrition Enhancement — Design

**Date:** 2026-02-28
**Branch:** `feature/phase-12-nutrition-enhancement`
**Status:** Approved

## Goal

Transform manual nutrition logging into a smart, fast, offline-capable system with food database search, barcode scanning, meal planning with time slots, and intermittent fasting tracking. Full feature parity across web (PC) and native (phone), working offline when away from home network.

## 1. Food Database Search (OpenFoodFacts API)

### API Strategy

- **Text search:** OpenFoodFacts v1 endpoint (only v1 supports full-text search)
  - `GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriments,serving_size,serving_quantity`
- **Barcode lookup:** OpenFoodFacts v2 endpoint
  - `GET https://world.openfoodfacts.net/api/v2/product/{barcode}?fields=product_name,brands,nutriments,serving_size,serving_quantity`
- **User-Agent header:** `BuffNStuff/1.0 (buffnstuff@example.com)` (required by OpenFoodFacts)

### Nutriment Field Mapping

| OpenFoodFacts field | App field |
|---------------------|-----------|
| `energy-kcal_100g` / `energy-kcal_serving` | calories |
| `proteins_100g` / `proteins_serving` | protein_g |
| `carbohydrates_100g` / `carbohydrates_serving` | carbs_g |
| `fat_100g` / `fat_serving` | fats_g |
| `serving_size` | serving label |
| `serving_quantity` | serving grams |

### UX Flow

1. User types in the food item field (existing input)
2. After 300ms debounce, search queries OpenFoodFacts
3. Dropdown appears below input with results: product name, brand, macros per serving
4. Selecting a result auto-fills all macro fields
5. Serving size selector: "Per serving (65g)", "Per 100g", "Custom (enter grams)" — macros auto-scale
6. User can still type any custom food name and manually enter macros (existing behavior preserved)

### Offline Caching (Dexie)

- Cache search results in IndexedDB (`food_search_cache` table) with query as key
- Cache barcode lookups in IndexedDB (`barcode_cache` table) with barcode as key
- Cache TTL: 7 days (food data doesn't change often)
- When offline, search queries hit cache first; if miss, show "No results (offline)" message
- Recently used foods also cached for instant re-entry

## 2. Barcode Scanner

### Plugin Choice

- **`@capacitor/barcode-scanner` v3.0.1** — official Ionic plugin, latest as of Feb 2026
- Falls back gracefully on web (hidden; only shown when `isNative()` returns true)

### UX Flow

1. "Scan" button (barcode icon) appears next to the food search input on native platforms
2. Tapping opens fullscreen camera scanner overlay
3. After successful scan, barcode is looked up via OpenFoodFacts v2 barcode endpoint
4. If found: auto-fills food name + all macros, shows serving selector
5. If not found: toast "Product not found — enter manually", closes scanner
6. Scanned product is cached in IndexedDB for offline re-scanning

### Web Fallback

- On web (PC), the scan button is hidden
- Users on web use the text search instead (same OpenFoodFacts data)
- Full feature parity: all food data accessible on both platforms, just different input methods

## 3. Meal Planning

### Data Model

**New Supabase tables:**

```
meal_plans
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── name (text) — e.g., "Cutting Day", "High Carb Day"
├── description (text, nullable)
├── eating_window_start (time, nullable) — e.g., "12:00"
├── eating_window_end (time, nullable) — e.g., "20:00"
├── created_at (timestamptz)
└── updated_at (timestamptz)

meal_plan_items
├── id (uuid, PK)
├── plan_id (uuid, FK → meal_plans)
├── meal_name (text) — "Breakfast", "Lunch", etc.
├── target_time (time, nullable) — e.g., "12:00" for first meal
├── food_item (text)
├── calories (numeric)
├── protein_g (numeric)
├── carbs_g (numeric)
├── fats_g (numeric)
├── serving_size (text, nullable) — e.g., "1 serving (65g)"
├── sort_order (integer)
└── created_at (timestamptz)
```

### UX Flow

- New route: `/nutrition/plans` — list of saved meal plans
- New route: `/nutrition/plans/new` — create a meal plan
- Each plan shows: name, total macros, number of meals, eating window
- Each meal in a plan has an optional target time within the eating window
- "Apply Plan to Today" button copies all entries to today's nutrition log
- "Save Current Day as Plan" button on the main nutrition page creates a plan from existing entries
- Food items in plans can be added via search/barcode (same flow as regular entry)

### Offline Support (Dexie)

- `pending_meal_plans` and `pending_meal_plan_items` tables in IndexedDB
- Plans created offline are synced when back online (same pattern as workout sync)
- Applied plans create local entries that sync to Supabase when connected

## 4. Intermittent Fasting Tracker

### Fasting Protocols

| Protocol | Fast | Eat | Description |
|----------|------|-----|-------------|
| 12:12 | 12h | 12h | Beginner |
| 14:10 | 14h | 10h | Moderate |
| 16:8 | 16h | 8h | Most popular |
| 18:6 | 18h | 6h | Advanced |
| 20:4 | 20h | 4h | Warrior |
| OMAD | 23h | 1h | One meal a day |
| Custom | Xh | Yh | User-defined |

### Data Model

**New Supabase tables:**

```
fasting_settings
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users, unique)
├── protocol (text) — "16:8", "18:6", "custom", etc.
├── target_fast_hours (numeric) — e.g., 16
├── eating_window_start (time) — e.g., "12:00"
├── eating_window_end (time) — e.g., "20:00"
├── notifications_enabled (boolean, default true)
├── updated_at (timestamptz)

fasting_log
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── date (date)
├── eating_start (timestamptz, nullable) — actual start
├── eating_end (timestamptz, nullable) — actual end
├── target_fast_hours (numeric) — snapshot of target
├── achieved_fast_hours (numeric, nullable) — computed
├── hit_target (boolean, nullable) — did they make it?
├── notes (text, nullable)
├── created_at (timestamptz)
```

### UX — Fasting Timer Widget

Displayed at top of nutrition page (above daily macros):

- **Circular progress ring** showing current fasting state:
  - **Fasting state** (green ring filling): "Fasting — 14h 23m" with time elapsed
  - **Eating window** (amber ring): "Eating Window — 2h 15m remaining"
  - **Outside window** (red): "Eating window closed 45m ago"
- **Start Eating / Stop Eating** toggle button
- Current protocol badge (e.g., "16:8")
- Streak counter: "12 day streak"

### UX — Fasting Settings

Added to the existing Settings page (`/settings`) under a new "Fasting" section:

- Protocol selector (dropdown with presets + custom)
- Eating window start/end time pickers
- Toggle for fasting notifications (window opening/closing reminders)

### Fasting Streak Calculation

- A day "counts" toward the streak if `hit_target = true`
- Streak breaks if a day is missed or target not hit
- Streak displayed on both the nutrition page and the dashboard
- Optionally: a "Fasting Adherence" percentage over the last 7/30 days

### Notifications Integration

- Uses existing `scheduleLocalNotification()` from `src/lib/capacitor/notifications.ts`
- "Eating window opens in 15 minutes" notification
- "Eating window closes in 30 minutes" notification
- "Fasting complete! You hit your 16h target" celebration notification
- On web: no native notifications, but the timer widget serves the same purpose visually

### Offline Support (Dexie)

- `pending_fasting_log` table in IndexedDB
- Start/stop eating times logged locally, synced to Supabase when online
- Fasting timer runs entirely client-side (no server dependency)
- Settings cached locally so the timer works offline

## 5. Cross-Platform Feature Parity

| Feature | Web (PC) | Native (Phone) |
|---------|----------|----------------|
| Food search | Text search via OpenFoodFacts | Text search + barcode scanner |
| Meal planning | Full CRUD + apply plans | Full CRUD + apply plans |
| Fasting timer | Visual timer widget | Timer + native notifications |
| Offline food entry | Manual entry cached in Dexie | Manual entry cached in Dexie |
| Offline search | Cached results from IndexedDB | Cached results from IndexedDB |
| Data sync | Auto-sync when online | Auto-sync when online |

## 6. Dependencies (Latest as of Feb 2026)

| Package | Version | Purpose |
|---------|---------|---------|
| `@capacitor/barcode-scanner` | ^3.0.1 | Native barcode scanning |
| Dexie (existing) | ^4.3.0 | Offline IndexedDB cache |
| OpenFoodFacts API | v1 (search) + v2 (barcode) | Food database |

No new npm dependencies needed beyond `@capacitor/barcode-scanner`. The existing stack (Dexie, Supabase, Capacitor plugins) handles everything else.

## 7. File Structure (New)

```
src/
├── lib/
│   ├── nutrition/
│   │   ├── food-search.ts          — OpenFoodFacts search + barcode lookup
│   │   ├── food-cache.ts           — Dexie caching for food search results
│   │   └── fasting.ts              — Fasting timer logic, streak calculation
│   └── database/
│       ├── meal-plans.ts           — Supabase CRUD for meal plans
│       └── fasting.ts              — Supabase CRUD for fasting settings/log
├── components/
│   ├── nutrition/
│   │   ├── food-search-input.tsx   — Autocomplete search with dropdown
│   │   ├── barcode-scanner.tsx     — Native barcode scan button + overlay
│   │   ├── serving-selector.tsx    — Per serving / per 100g / custom
│   │   ├── fasting-timer.tsx       — Circular progress ring + controls
│   │   ├── fasting-streak.tsx      — Streak counter display
│   │   └── meal-plan-card.tsx      — Plan summary card
│   └── settings/
│       └── fasting-settings.tsx    — Protocol picker + window times
├── app/(app)/
│   └── nutrition/
│       ├── plans/
│       │   ├── page.tsx            — Meal plans list
│       │   └── new/
│       │       └── page.tsx        — Create/edit meal plan
│       └── page.tsx                — Updated with fasting timer + search
```

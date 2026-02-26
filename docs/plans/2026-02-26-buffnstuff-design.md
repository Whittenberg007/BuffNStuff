# BuffNStuff — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Author:** Whitt + Claude

---

## 1. Overview

BuffNStuff is a personal workout tracking and fitness intelligence app designed for an advanced lifter who needs data-driven insights to break through plateaus and optimize training. The app prioritizes fast workout logging, progressive overload tracking, smart exercise pairing, and a unique YouTube video clipping system for saving exercise references.

### Core Problem

Years of training experience without tracking weight, reps, volume, or frequency — leading to invisible plateaus and missed progressive overload opportunities. The app solves this by making logging fast and frictionless while layering intelligent features on top of the data.

### Target User

- Advanced lifter (3+ years)
- Primary goal: body recomposition + data-driven progress tracking
- Trains for both hypertrophy and strength
- Watches fitness YouTubers (Ryan Humiston, Jeff Nippard, Dr. Mike Israetel, etc.)
- Uses Windows 11 PC at home + Galaxy S23+ at the gym

### Target Devices

| Device | Spec | Usage Context |
|--------|------|---------------|
| **Desktop** | ASUS, i7-13700K (16c/24t), 128GB DDR5-4200, RTX 4090, Samsung 990 PRO 2TB, Win 11 Pro | Planning workouts, reviewing progress, clipping videos, deep analytics |
| **Mobile** | Galaxy S23+ (Android) | Logging sets at the gym, quick macro logging, viewing exercise clips |

---

## 2. Tech Stack

### Architecture: Next.js PWA + Capacitor Hybrid

```
┌─────────────────────────────────────────────────┐
│                   BuffNStuff                     │
│                                                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  Next.js 16  │  │    Tailwind CSS 4        │  │
│  │  React 19    │  │    Responsive UI         │  │
│  │  TypeScript  │  │    Mobile-first design   │  │
│  └──────┬──────┘  └──────────────────────────┘  │
│         │                                        │
│  ┌──────▼──────────────────────────────────────┐│
│  │           Service Worker (Serwist)           ││
│  │  - Offline workout logging (IndexedDB)       ││
│  │  - Background sync when back online          ││
│  │  - Cache static assets                       ││
│  └──────┬──────────────────────────────────────┘│
│         │                                        │
│  ┌──────▼──────────────────────────────────────┐│
│  │           Capacitor (Optional wrap)          ││
│  │  - Native Android APK if needed              ││
│  │  - Camera access for barcode scanning        ││
│  │  - Push notifications                        ││
│  └─────────────────────────────────────────────┘│
└────────────────────┬────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────┐
│               Supabase Backend                   │
│                                                  │
│  ┌──────────┐ ┌────────┐ ┌───────────────────┐  │
│  │ PostgreSQL│ │  Auth  │ │  Edge Functions   │  │
│  │  + RLS    │ │        │ │  - YouTube clip   │  │
│  │          │ │        │ │    processing      │  │
│  └──────────┘ └────────┘ │  - Barcode lookup  │  │
│                          │  - TDEE calc       │  │
│  ┌──────────┐ ┌────────┐ └───────────────────┘  │
│  │ Storage  │ │Realtime│                         │
│  │ (clips)  │ │        │                         │
│  └──────────┘ └────────┘                         │
└──────────────────────────────────────────────────┘
```

### Stack Details

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 16 (App Router) | SSR/SSG, massive ecosystem, proven with Supabase |
| **Language** | TypeScript 5.x | Type safety, better DX, consistent with Custody Tracker experience |
| **UI** | React 19 + Tailwind CSS 4 | Responsive, utility-first, fast iteration |
| **Component Library** | shadcn/ui | Accessible, unstyled components, copy-paste ownership |
| **Charts** | Recharts or Chart.js | Progress visualization, trend lines |
| **PWA** | Serwist (service worker) | Offline support, installability, background sync |
| **Offline Storage** | IndexedDB via Dexie.js | Cache workouts offline, sync when connected |
| **Native Wrapper** | Capacitor | Optional Android APK, native camera/notifications |
| **Database** | Supabase (PostgreSQL) | RLS, auth, realtime, storage — proven in Custody Tracker |
| **Auth** | Supabase Auth | Email/password, session persistence |
| **Storage** | Supabase Storage | Video clips/GIFs, progress photos (future) |
| **Edge Functions** | Supabase Edge Functions (Deno) | YouTube processing, API proxying |
| **Hosting** | Vercel | Next.js-native hosting, edge functions, free tier |
| **Food APIs** | Open Food Facts + USDA FoodData Central | Free, barcode support, research-grade nutrition data |

---

## 3. Feature Specification

### 3.1 Workout Logging (CORE — Highest Priority)

The heart of the app. Must be fast enough to use between sets (3-5 seconds per log entry).

#### Two Logging Modes (User Toggle)

**Quick-Log Mode:**
- Select today's workout template (or start blank)
- Tap exercise → enter weight + reps → save
- Minimal UI: just the numbers
- Auto-suggests last session's weight for each exercise
- Rest timer starts automatically after logging a set
- Swipe to next exercise

**Guided Mode:**
- Shows today's programmed workout with target weights/reps
- Displays: "Last time: 185 lbs x 8 reps — Try: 190 lbs x 8 reps" (progressive overload suggestion)
- Color-coded feedback: green (PR), yellow (matched), red (below last session)
- Suggests rest time based on training style (60-90s hypertrophy, 3-5min strength)
- Shows volume landmarks context (approaching MRV? suggest backing off)

#### Data Captured Per Set

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Exercise | reference | Yes | From exercise library |
| Set number | integer | Auto | Sequential within exercise |
| Weight | decimal | Yes | lbs or kg (user preference) |
| Reps | integer | Yes | |
| Set type | enum | Auto/Manual | Working, warm-up, drop set, failure, PR |
| RPE/RIR | integer | Optional | Rate of Perceived Exertion / Reps in Reserve (1-10) |
| Notes | text | Optional | Form cues, pain notes, etc. |
| Timestamp | datetime | Auto | |

#### Workout Session Data

| Field | Type | Notes |
|-------|------|-------|
| Date/time start | datetime | Auto when workout begins |
| Date/time end | datetime | Auto when workout ends |
| Workout template | reference | Which routine was followed |
| Split type | enum | Push, Pull, Legs, Upper, Lower, Full Body, Custom |
| Training style | enum | Hypertrophy, Strength, Mixed |
| Total volume | computed | Sum of (weight x reps) across all sets |
| Total sets | computed | |
| Duration | computed | End - start |
| Notes | text | Overall session notes |
| Mood/energy | integer | Optional 1-5 rating |

### 3.2 Exercise Library

A comprehensive, searchable database of exercises with user-curated video clips.

#### Exercise Data Model

| Field | Type | Notes |
|-------|------|-------|
| Name | text | "Incline Dumbbell Press" |
| Primary muscle group | enum | Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core, Forearms |
| Secondary muscles | enum[] | Supporting muscles engaged |
| Equipment type | enum | Barbell, Dumbbell, Cable, Machine, Bodyweight, Band, Other |
| Movement pattern | enum | Push, Pull, Hinge, Squat, Lunge, Carry, Isolation |
| Difficulty | enum | Beginner, Intermediate, Advanced |
| Instructions | text | Brief form description |
| Video clips | reference[] | User-saved YouTube clips (see 3.5) |
| Tags | text[] | "Humiston favorite", "compound", "lengthened partial", etc. |
| Source/credit | text | "Ryan Humiston", "Jeff Nippard", etc. |

#### Pre-loaded Exercise Database

The app ships with 200+ exercises covering all major muscle groups, equipment types, and movement patterns. Users can add custom exercises.

#### Equipment Variation Suggestions

When viewing an exercise, the app suggests alternatives across equipment types:

```
Chest Press variations:
├── Barbell: Flat Bench Press, Incline Bench Press
├── Dumbbell: Flat DB Press, Incline DB Press, DB Squeeze Press
├── Cable: Cable Crossover, Low Cable Fly, High Cable Fly
├── Machine: Chest Press Machine, Pec Deck, Smith Machine Press
└── Bodyweight: Push-ups, Decline Push-ups, Dips
```

### 3.3 Routine Builder & Templates

#### Custom Routine Builder

- Create routines by selecting exercises from the library
- Drag-and-drop ordering
- Set target sets/reps/weight per exercise
- Tag with split type (Push, Pull, Legs, etc.)
- Schedule routines to specific days of the week
- Clone and modify existing routines

#### Pre-Built Templates

Based on research from top fitness YouTubers:

| Template | Structure | Source Inspiration |
|----------|-----------|-------------------|
| PPL Classic | Push/Pull/Legs 6-day | General science-based |
| PPL Humiston | Push/Pull/Legs with giant sets & century sets | Ryan Humiston |
| Upper/Lower | 4-day split | Jeff Nippard style |
| PPLUL Hybrid | 5-day Push/Pull/Legs/Upper/Lower | Highest rated for hypertrophy |
| Full Body 3x | 3-day full body | Jeremy Ethier efficiency style |
| Strength Focus | 4-day compound-heavy, low rep | Powerlifting-inspired |
| Bro Split | 5-day body part split | Classic bodybuilding |

#### Smart Pairing Guidance

When building routines, the app provides contextual tips:

- **Muscle group pairing suggestions** based on science:
  - Push muscles together (chest + shoulders + triceps)
  - Pull muscles together (back + biceps + rear delts)
  - Antagonist superset suggestions (chest/back, biceps/triceps, quads/hamstrings)
- **Recovery warnings**: "You trained chest yesterday (needs 72-120h recovery) — consider a different muscle group"
- **Frequency check**: "Biceps have only been trained 1x this week — consider adding a set"
- **Volume check**: "You're at 22 sets for chest this week — approaching MRV, consider a deload"

### 3.4 Training Intelligence Engine

#### Spaced Repetition for Exercise Rotation

Adapted from the FSRS (Free Spaced Repetition Scheduler) algorithm:

- Each exercise has a "freshness score" based on how long it's been in the current rotation
- After 4-6 weeks, the app suggests swapping the exercise for a variation
- Swapped-out exercises enter a "rest pool" and resurface after 4-8 weeks
- User can accept suggestions, dismiss them, or build their own rotation schedule

**Three rotation modes:**
1. **Manual** — user manages all exercise selection, app provides tips only
2. **Suggested** — app nudges when it's time to rotate, user approves/rejects
3. **Auto-rotate** — app automatically cycles exercises within user-defined constraints (opt-in per muscle group)

#### Plateau Detection & Intervention

Monitors each exercise for stalls:

- **Detection**: Same weight AND same reps for 2-3 consecutive sessions
- **Visual flag**: Exercise card turns yellow/orange when plateau detected
- **Suggested interventions** (based on Dr. Mike Israetel's principles):
  1. **Deload week**: Reduce volume by 40-60% for one week
  2. **Rep range change**: Switch from 8-10 to 12-15 (or vice versa)
  3. **Exercise swap**: Suggest a variation that hits the same muscle differently
  4. **Technique variation**: Different grip, angle, tempo, or range of motion
  5. **Volume adjustment**: Check if you're under MEV or over MRV

#### Training Style Support

**Hypertrophy Mode:**
- Moderate weight, higher reps (8-15)
- High volume (15-25 sets per muscle/week)
- Short rest periods (60-90 seconds)
- Emphasis on time under tension, pump, metabolic stress
- Supports giant sets, drop sets, rest-pause, century sets (Humiston style)

**Strength Mode:**
- Heavy weight, low reps (1-5)
- Lower volume, higher intensity
- Long rest periods (3-5 minutes)
- Emphasis on compound lifts (squat, bench, deadlift, OHP)
- RPE/RIR tracking critical
- Percentage-based programming (% of 1RM)

**Mixed/Periodized Mode:**
- Alternate between hypertrophy and strength phases
- Mesocycle programming (4-6 week blocks)
- Undulating periodization support (daily or weekly variation)

### 3.5 YouTube Video Clipper

A unique feature for saving exercise form references and training tips from YouTube.

#### Workflow

1. User pastes a YouTube video URL
2. App loads the video using YouTube IFrame Player API
3. Visual timeline with draggable start/end markers
4. User sets clip boundaries (e.g., 2:15 - 2:45)
5. User names the clip ("Incline DB Curl — Humiston twist grip")
6. User tags it:
   - Muscle group(s)
   - Exercise (from library)
   - Creator/source
   - Type: form reference, tip, motivation, full workout
7. Save options:
   - **Stream** (default): Saves URL + timestamps, plays segment on demand
   - **Download**: Converts to GIF/short video via Edge Function, stores in Supabase Storage

#### Display Locations

- **Exercise Library**: When viewing any exercise, associated clips appear as thumbnail cards
- **Clips Gallery**: Dedicated browsable section with filters:
  - By muscle group
  - By creator (Humiston, Nippard, etc.)
  - By type (form, tip, workout)
  - By date saved
  - Search by name

#### Technical Implementation

- YouTube IFrame Player API for in-app playback with seek control
- Custom timeline component for start/end selection
- Edge Function using `yt-dlp` + `ffmpeg` for clip extraction/GIF conversion
- Supabase Storage for downloaded clips
- Thumbnail generation for gallery view

### 3.6 Nutrition Tracking (Simple MVP)

Minimal viable nutrition tracking — fast daily macro logging.

#### Daily Log

| Field | Type | Notes |
|-------|------|-------|
| Date | date | One entry per day |
| Meal name | text | "Breakfast", "Lunch", "Post-workout", or custom |
| Food item | text | Free text or search from database |
| Calories | integer | |
| Protein (g) | decimal | |
| Carbs (g) | decimal | |
| Fats (g) | decimal | |
| Quantity/serving | text | Optional: "2 scoops", "1 cup" |

#### Dashboard Display

- Daily totals vs. targets (progress bars)
- Protein target prominently displayed (most important macro for recomp)
- Simple pie chart: protein / carbs / fats split
- "Quick add" for frequent meals (save favorites)

#### Targets

- User sets daily calorie and macro targets manually
- Built-in TDEE calculator (Mifflin-St Jeor) as a starting reference
- Adjust targets based on goal: recomp, bulk, cut

### 3.7 Weight & Body Tracking

#### Weight Log

- Daily or weekly weigh-in entry
- Trend line with 7-day moving average (smooths out water/food fluctuations)
- Weight change per week/month displayed
- Correlation view: weight trend overlaid with calorie intake trend

### 3.8 Goals System

#### Goal Types

| Type | Example | Tracking Method |
|------|---------|----------------|
| **Strength milestone** | "Bench press 225 lbs" | Auto-detected from workout logs |
| **Body composition** | "Reach 185 lbs" | From weight log entries |
| **Consistency** | "Work out 4x/week" | Counted from workout sessions |
| **Volume** | "Increase weekly chest volume 10%" | Computed from workout data |
| **Nutrition** | "Hit protein target 6/7 days" | From daily macro logs |
| **Custom** | "Do 10 pull-ups unbroken" | Manual check-off |

#### Goal Features

- Set target date (optional)
- Progress bar showing % completion
- Milestone notifications when achieved
- History of completed goals

### 3.9 Dashboard & Progress Visualization

#### Main Dashboard

- **Today's workout**: What's scheduled, quick-start button
- **Weekly summary**: Days trained, total volume, calories logged
- **Active goals**: Progress bars for current goals
- **Streak counter**: Current workout streak
- **Recent PRs**: Personal records hit in the last 7 days

#### Analytics Page

- **Exercise progression charts**: Weight over time per exercise (line graph)
- **Volume trends**: Weekly/monthly total volume per muscle group (bar chart)
- **Frequency heatmap**: Calendar view showing training days and muscle groups hit
- **Body weight trend**: Smoothed trend line with weekly averages
- **Muscle group balance**: Radar chart showing relative volume across all muscle groups
- **Strength standards**: Where your lifts fall relative to bodyweight standards (beginner → advanced)

#### Streaks & Badges

| Badge | Criteria |
|-------|---------|
| **Iron Streak** | 3, 7, 14, 30, 60, 90-day workout streaks |
| **PR Hunter** | Hit a new personal record |
| **Volume King** | New weekly volume record for any muscle group |
| **Consistency Crown** | 4+ workouts/week for a full month |
| **Protein Perfect** | Hit protein target 7 days straight |
| **Century Club** | Complete a 100-rep set (Humiston style) |
| **Plateau Breaker** | Break through a flagged plateau |

---

## 4. Database Schema (High Level)

### Core Tables

```
users
├── id (uuid, PK)
├── email
├── display_name
├── created_at
├── unit_preference (lbs/kg)
└── settings (jsonb)

exercises
├── id (uuid, PK)
├── user_id (nullable — null = system exercise)
├── name
├── primary_muscle_group
├── secondary_muscles (text[])
├── equipment_type
├── movement_pattern
├── difficulty
├── instructions
├── tags (text[])
├── source_credit
├── is_custom (boolean)
└── created_at

workout_templates
├── id (uuid, PK)
├── user_id
├── name
├── split_type
├── training_style
├── description
├── is_active (boolean)
├── sort_order
└── created_at

template_exercises
├── id (uuid, PK)
├── template_id (FK)
├── exercise_id (FK)
├── target_sets
├── target_reps
├── target_weight
├── sort_order
├── set_type (working, warmup, dropset)
└── notes

workout_sessions
├── id (uuid, PK)
├── user_id
├── template_id (FK, nullable)
├── started_at
├── ended_at
├── split_type
├── training_style
├── notes
├── mood_energy (1-5)
└── created_at

workout_sets
├── id (uuid, PK)
├── session_id (FK)
├── exercise_id (FK)
├── set_number
├── weight
├── reps
├── set_type
├── rpe_rir (nullable)
├── is_pr (boolean)
├── notes
└── logged_at

exercise_clips
├── id (uuid, PK)
├── user_id
├── exercise_id (FK, nullable)
├── youtube_url
├── start_seconds
├── end_seconds
├── title
├── muscle_groups (text[])
├── creator_name
├── clip_type (form, tip, motivation, workout)
├── thumbnail_url
├── stored_clip_path (nullable — for downloaded GIFs)
├── is_downloaded (boolean)
└── created_at

nutrition_log
├── id (uuid, PK)
├── user_id
├── date
├── meal_name
├── food_item
├── calories
├── protein_g
├── carbs_g
├── fats_g
├── quantity_note
└── created_at

nutrition_favorites
├── id (uuid, PK)
├── user_id
├── food_item
├── calories
├── protein_g
├── carbs_g
├── fats_g
├── default_quantity
└── created_at

weight_log
├── id (uuid, PK)
├── user_id
├── date
├── weight
└── created_at

goals
├── id (uuid, PK)
├── user_id
├── type (strength, body_comp, consistency, volume, nutrition, custom)
├── title
├── description
├── target_value
├── current_value
├── target_date (nullable)
├── status (active, completed, abandoned)
├── completed_at
└── created_at

user_badges
├── id (uuid, PK)
├── user_id
├── badge_type
├── earned_at
└── context (jsonb — details about how it was earned)

exercise_rotation_state
├── id (uuid, PK)
├── user_id
├── exercise_id (FK)
├── muscle_group
├── introduced_at
├── last_performed_at
├── rotation_status (active, resting, suggested_swap)
├── freshness_score (decimal)
├── swap_suggested_at
└── replacement_exercise_id (FK, nullable)

user_settings
├── id (uuid, PK)
├── user_id
├── daily_calorie_target
├── protein_target_g
├── carbs_target_g
├── fats_target_g
├── tdee_estimate
├── training_days_per_week
├── preferred_split
├── rotation_mode (manual, suggested, auto)
└── updated_at
```

### Row-Level Security

All tables enforce `user_id = auth.uid()` via RLS policies (same pattern as Custody Tracker). System exercises (user_id IS NULL) are readable by all authenticated users.

---

## 5. UI/UX Overview

### Navigation (Tab-based)

| Tab | Icon | Purpose |
|-----|------|---------|
| **Dashboard** | Home | Today's overview, stats, goals, streaks |
| **Workout** | Dumbbell | Start/log workout, view history |
| **Exercises** | Book | Exercise library, clips gallery, muscle groups |
| **Nutrition** | Apple | Daily food log, macro progress |
| **Progress** | Chart | Analytics, charts, body tracking, goals |

### Responsive Design

- **Mobile (gym use)**: Large touch targets, minimal scrolling during sets, one-hand-friendly number input
- **Desktop (planning use)**: Multi-panel layouts, side-by-side views, full analytics dashboards, video clipping workspace

### Offline-First Architecture

- Workout logging works fully offline via IndexedDB (Dexie.js)
- Queues changes and syncs to Supabase when connection returns
- Visual indicator showing online/offline status and pending sync count
- Exercise library cached locally for offline access

---

## 6. Science-Based Knowledge Engine

### Muscle Group Recovery Data (Built-in)

| Muscle Group | Recovery Time | Optimal Frequency | Notes |
|-------------|---------------|-------------------|-------|
| Calves | 24-48h | 3-4x/week | High slow-twitch, recovers fast |
| Quadriceps | 24-48h | 2-3x/week | Can handle high frequency |
| Back (Lats) | 48-72h | 2-3x/week | Large muscle, moderate recovery |
| Glutes | 48-72h | 2-3x/week | Responds well to volume |
| Hamstrings | 48-72h | 2-3x/week | Eccentric-heavy = slower recovery |
| Shoulders | 48-72h | 2-3x/week | Anterior gets hit on push days too |
| Chest | 72-120h | 2x/week | High fast-twitch, needs rest |
| Biceps | 72-120h | 2-3x/week | Small but high activation |
| Triceps | 72-120h | 2-3x/week | Hit indirectly on all pressing |
| Core | 24-48h | 3-5x/week | Endurance-oriented fibers |

### Volume Landmarks (Dr. Mike Israetel / RP)

Built into the intelligence engine per muscle group:

| Muscle Group | MV (Maintenance) | MEV (Min Effective) | MAV (Max Adaptive) | MRV (Max Recoverable) |
|-------------|------------------|--------------------|--------------------|----------------------|
| Chest | 6 sets/week | 8 sets/week | 12-20 sets/week | 22+ sets/week |
| Back | 6 sets/week | 8 sets/week | 14-22 sets/week | 25+ sets/week |
| Shoulders | 4 sets/week | 6 sets/week | 12-20 sets/week | 22+ sets/week |
| Biceps | 4 sets/week | 6 sets/week | 10-16 sets/week | 20+ sets/week |
| Triceps | 4 sets/week | 6 sets/week | 10-16 sets/week | 18+ sets/week |
| Quads | 6 sets/week | 8 sets/week | 12-18 sets/week | 20+ sets/week |
| Hamstrings | 4 sets/week | 6 sets/week | 10-16 sets/week | 18+ sets/week |
| Glutes | 4 sets/week | 6 sets/week | 10-16 sets/week | 18+ sets/week |
| Calves | 6 sets/week | 8 sets/week | 12-16 sets/week | 20+ sets/week |

### Antagonist Superset Pairings

| Pair | Muscles | Benefit |
|------|---------|---------|
| 1 | Chest + Back | 36% time savings, enhanced force output |
| 2 | Biceps + Triceps | Classic arm pairing, reciprocal inhibition |
| 3 | Quads + Hamstrings | Full leg development, knee stability |
| 4 | Front Delts + Rear Delts | Shoulder balance, injury prevention |

---

## 7. Future Enhancements (Post-MVP)

Noted for future development but explicitly NOT in the initial build:

### Nutrition Enhancements
- [ ] Barcode scanning for packaged foods (Web Barcode Detection API + Open Food Facts)
- [ ] TDEE auto-adjustment based on actual weight change vs. intake data
- [ ] Meal suggestions to hit remaining daily macros
- [ ] Restaurant/fast food database integration (Nutritionix API)
- [ ] Water intake tracking
- [ ] Meal planning / meal prep scheduling
- [ ] Recipe macro calculator (input ingredients, get totals)

### Body Tracking Enhancements
- [ ] Body measurements (arms, chest, waist, legs) with progress over time
- [ ] Progress photos with side-by-side comparison timeline
- [ ] Body fat percentage estimation (from measurements or photos)

### Social & Sharing
- [ ] Export workout summaries as shareable images
- [ ] Workout sharing via link
- [ ] Community templates marketplace

### Advanced Intelligence
- [ ] AI-powered form analysis from video (using device camera)
- [ ] Natural language workout logging ("I did 3 sets of bench at 185 for 8 reps")
- [ ] Predictive 1RM estimation from working sets
- [ ] Injury risk detection from volume/intensity patterns
- [ ] Sleep tracking integration (correlate recovery with sleep data)
- [ ] Heart rate zone tracking (via wearable integration)

### Platform
- [ ] iOS Capacitor build
- [ ] Apple Watch / Wear OS companion
- [ ] Widget support (Android home screen quick-log)
- [ ] Alexa/Google Assistant voice logging

---

## 8. Success Criteria

The app is successful when:

1. **Logging a set takes < 5 seconds** — fast enough to use between sets without disrupting rest
2. **Progressive overload is visible** — can see weight progression charts for any exercise
3. **Plateaus are caught** — app flags when an exercise has stalled for 2+ weeks
4. **Exercise rotation feels natural** — spaced repetition suggestions are helpful, not annoying
5. **YouTube clips are useful** — can quickly reference form videos during workouts
6. **Works offline at the gym** — no data loss when phone has poor connectivity
7. **Desktop experience is rich** — full analytics, video clipping, routine planning on the big screen
8. **Daily use becomes habit** — streaks, badges, and fast UX drive consistent engagement

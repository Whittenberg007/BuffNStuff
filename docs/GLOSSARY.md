# BuffNStuff Feature Glossary

A complete reference for every feature in the BuffNStuff fitness tracking app.

---

## Table of Contents

- [Authentication](#authentication)
- [Dashboard](#dashboard)
- [Workout Tracking](#workout-tracking)
- [Workout Templates](#workout-templates)
- [Exercise Library](#exercise-library)
- [Exercise Clips](#exercise-clips)
- [Nutrition Tracking](#nutrition-tracking)
- [Meal Plans](#meal-plans)
- [Intermittent Fasting](#intermittent-fasting)
- [Weight Tracking](#weight-tracking)
- [Body Measurements & Photos](#body-measurements--photos)
- [Progress & Analytics](#progress--analytics)
- [Goals](#goals)
- [Training Intelligence](#training-intelligence)
- [Strength Profile](#strength-profile)
- [Cardio Tracking](#cardio-tracking)
- [Workout Calendar](#workout-calendar)
- [Recovery & Readiness](#recovery--readiness)
- [Training Programs](#training-programs)
- [AI Coach](#ai-coach)
- [Community & Social](#community--social)
- [Challenges & Leaderboards](#challenges--leaderboards)
- [Notifications](#notifications)
- [Sharing](#sharing)
- [Settings](#settings)
- [Data Export & Backup](#data-export--backup)
- [Offline & PWA](#offline--pwa)
- [Native Mobile (Capacitor)](#native-mobile-capacitor)

---

## Authentication

**Route:** `/login`

Email/password authentication powered by Supabase Auth.

| Action | How |
|--------|-----|
| Sign up | Toggle to "Sign up" mode, enter email + password (min 6 chars), submit |
| Sign in | Enter existing email + password, submit |
| Session | Managed via cookies; persists across page refreshes |
| Protection | All app routes require authentication; unauthenticated users redirect to `/login` |

---

## Dashboard

**Route:** `/` (home)

The main hub after logging in. Displays a consolidated overview of your fitness activity.

| Widget | Description |
|--------|-------------|
| Today's Workout | Shows your scheduled workout for today (from active program or templates) |
| Weekly Summary | 7-day overview of completed workouts |
| Streak Counter | Consecutive days with logged workouts |
| Recent PRs | Latest personal records across all exercises |
| Badges Display | Achievement badges you've earned |
| Recovery Score | Current recovery readiness metric |
| Muscle Fatigue Map | Visual per-muscle fatigue indicator |
| AI Insights | AI-generated training/nutrition/recovery tips |
| Active Program | Current training program status |
| Training Alerts | Plateau warnings, rotation suggestions, volume landmarks |

---

## Workout Tracking

**Routes:** `/workout`, `/workout/active`

Log individual workout sessions with full set-by-set tracking.

| Feature | Description |
|---------|-------------|
| Start Workout | Begin a new session (blank or from template) |
| Exercise Picker | Search and add exercises from the 202-exercise library |
| Set Logger | Log weight, reps, RPE/RIR for each set |
| Set Types | Working sets, warm-up sets, drop sets |
| Rest Timer | Countdown timer between sets (configurable duration) |
| Workout Timer | Total session duration tracker |
| Auto-Rest Timer | Automatically starts rest timer after logging a set (if enabled in settings) |
| PR Detection | Automatically flags new personal records |
| Superset Indicator | Visual pairing for superset exercises |
| Plate Calculator | Calculate which plates to load on the barbell for a target weight |
| Readiness Check-in | Pre-workout survey (sleep quality, soreness, energy — each rated 1-5) |
| Guided Overlay | Form coaching overlay during exercises |
| Session Notes | Add notes to the overall session |
| Mood/Energy | Rate your energy level (1-5) for the session |
| End Workout | Finish session, triggers post-workout AI summary |

---

## Workout Templates

**Routes:** `/workout/templates`, `/workout/templates/new`, `/workout/templates/edit`

Reusable workout routines you can start a session from.

| Feature | Description |
|---------|-------------|
| Create Template | Name, split type (push/pull/legs/upper/lower/full/custom), training style (hypertrophy/strength/endurance) |
| Add Exercises | Pick exercises with target sets, reps, and weight |
| Set Order | Drag to reorder exercises within a template |
| Edit/Delete | Modify or remove existing templates |
| Start from Template | One-tap to start a workout pre-loaded with template exercises |

---

## Exercise Library

**Routes:** `/exercises`

Browse and search a library of 202 built-in exercises plus custom exercises.

| Feature | Description |
|---------|-------------|
| Search | Find exercises by name |
| Filter by Muscle Group | Chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, abs, forearms |
| Filter by Equipment | Barbell, dumbbell, cable, machine, bodyweight, band, kettlebell |
| Filter by Difficulty | Beginner, intermediate, advanced |
| Movement Patterns | Push, pull, squat, hinge, carry, isolation |
| Custom Exercises | Create your own exercises with muscle group/equipment tags |
| Exercise Details | Instructions, muscles worked, equipment needed |

---

## Exercise Clips

**Routes:** `/exercises/clips`, `/exercises/clips/new`

Save YouTube clips demonstrating exercise form.

| Feature | Description |
|---------|-------------|
| Add Clip | Paste a YouTube URL, set start/end timestamps to trim |
| Timeline Selector | Drag to select the relevant portion of a video |
| Link to Exercise | Associate a clip with a specific exercise from the library |
| Clip Gallery | Browse all saved clips, filtered by muscle group |
| YouTube Player | Embedded playback within the app |
| Clip Types | Form check, tutorial, motivation |

---

## Nutrition Tracking

**Route:** `/nutrition`

Daily food logging with full macro tracking.

| Feature | Description |
|---------|-------------|
| Log Food | Enter food name, calories, protein, carbs, fats |
| Meal Sections | Organize entries by meal (breakfast, lunch, dinner, snacks) |
| Food Search | Search for foods to auto-fill macro data |
| Favorites | Save frequently eaten foods for one-tap logging |
| Macro Progress Bars | Visual daily progress toward calorie/protein/carb/fat targets |
| Quick Food Log | AI-powered natural language food entry (e.g., "2 eggs and toast") |
| Barcode Scanner | Scan food product barcodes for instant macro lookup (native app only) |
| Serving Selector | Adjust portion sizes |
| Daily Totals | Running total of all macros for the day |

---

## Meal Plans

**Routes:** `/nutrition/plans`, `/nutrition/plans/new`

Save and reuse full meal plans.

| Feature | Description |
|---------|-------------|
| Create Plan | Name a meal plan and add food items to it |
| Add Items | Add foods with macros to specific meals within the plan |
| Browse Plans | View all saved meal plans |
| Reuse Plan | Load a saved plan to quickly log a full day of meals |

---

## Intermittent Fasting

Integrated into the Nutrition page.

| Feature | Description |
|---------|-------------|
| Fasting Protocols | Choose from 12:12, 14:10, 16:8, 18:6, 20:4, 23:1 |
| Fasting Timer | Live countdown showing time remaining in your fast |
| Fasting Streak | Track consecutive days of completing your fasting window |
| Fasting Settings | Configure your preferred protocol and eating window |

---

## Weight Tracking

Part of the Progress page.

| Feature | Description |
|---------|-------------|
| Log Weight | Enter daily bodyweight (one entry per day) |
| Weight Chart | Line chart showing weight trend over time |
| Trend Calculation | Smoothed trend line to filter out daily fluctuations |
| Unit Support | Pounds (lbs) or kilograms (kg) based on settings |

---

## Body Measurements & Photos

**Route:** `/body`

Track body composition changes beyond the scale.

| Feature | Description |
|---------|-------------|
| Log Measurements | Record chest, arms, waist, hips, thighs, calves, neck, shoulders |
| Measurement Charts | Trend lines for each body part over time |
| Capture Photos | Take progress photos with your camera |
| Photo Gallery | Browse photos organized by date |
| Photo Comparison | Side-by-side comparison of two photos from different dates |

---

## Progress & Analytics

**Route:** `/progress`

Multi-tab analytics dashboard for all training data.

| Tab | Description |
|-----|-------------|
| Weight | Body weight chart and trend |
| Exercises | Strength progression charts per exercise (weight over time) |
| Volume | Total training volume trends (weight x reps) |
| Frequency | Workout frequency heatmap (calendar-style) |
| Muscle Balance | Radar chart showing volume distribution across muscle groups |

---

## Goals

**Route:** `/progress/goals`

Set and track fitness goals with progress indicators.

| Goal Type | Description |
|-----------|-------------|
| Strength | Target a specific weight on an exercise (e.g., 315 lb squat) |
| Body Composition | Target weight or measurement |
| Consistency | Target workouts per week/month |
| Volume | Target total volume lifted |
| Nutrition | Target daily calorie/macro goals |
| Custom | Free-form goal with manual progress tracking |

Each goal shows current value vs. target, progress percentage, and optional target date.

---

## Training Intelligence

Automated insights shown on the Dashboard and during workouts.

| Feature | Description |
|---------|-------------|
| Rotation Suggestions | Detects exercises you've been doing too long and suggests fresh alternatives |
| Plateau Alerts | Identifies exercises where progress has stalled for 3+ weeks |
| Volume Landmarks | Celebrates volume milestones (e.g., 100,000 lbs total) |
| Freshness Score | Each exercise has a 0-1 freshness score that decays over time |
| Rotation Modes | "Suggested" (you decide), "Auto" (app swaps for you), or "Manual" |

---

## Strength Profile

Part of the Workout section.

| Feature | Description |
|---------|-------------|
| Rep Max Display | Estimated 1RM, 3RM, and 5RM for each exercise |
| All-Exercise PRs | View personal records across all exercises in one place |
| Strength Standards | Compare your lifts against established strength benchmarks |

---

## Cardio Tracking

**Route:** `/workout/cardio`

Dedicated logging for cardiovascular exercise.

| Feature | Description |
|---------|-------------|
| Activity Types | Run, bike, row, swim, walk |
| Log Session | Record duration, distance, and notes |
| Auto Pace Calculation | Average pace computed from duration and distance |
| Cardio Stats | Total distance, total duration, average pace over time |
| Cardio Progress | Visual analytics for cardio sessions |

---

## Workout Calendar

**Routes:** `/calendar`, `/calendar/day`

Calendar view of your training history.

| Feature | Description |
|---------|-------------|
| Monthly View | Calendar with workout days highlighted |
| Day View | Tap a day to see full workout details for that date |
| Timezone Aware | Events display in your local timezone |

---

## Recovery & Readiness

Shown on Dashboard and pre-workout.

| Feature | Description |
|---------|-------------|
| Readiness Check-in | Rate sleep quality, soreness, and energy (1-5 each) before workouts |
| Recovery Score | Composite metric based on recent check-ins |
| Muscle Fatigue Map | Visual display of which muscles are fatigued vs. recovered |
| Recovery Dashboard | Widget on the main dashboard showing current recovery status |

---

## Training Programs

**Routes:** `/programs`, `/programs/active`, `/programs/browse`, `/programs/new`

Structured multi-week training plans.

| Feature | Description |
|---------|-------------|
| Browse Programs | Pre-built science-based programs filtered by goal, difficulty, and periodization style |
| Enroll | Start a program and track your progress through it |
| Active Program | View current week's schedule, upcoming workouts, and completion status |
| Custom Program Builder | Create your own program with weekly schedules |
| Progression Rules | Linear weight increase, RPE-based, volume ramping, deload weeks |
| Week View | See each day's planned workout for the current program week |
| Deload Management | Automatic deload weeks built into program periodization |

---

## AI Coach

**Route:** `/coach`

Chat interface powered by Claude (Anthropic).

| Feature | Description |
|---------|-------------|
| Chat Interface | Multi-turn conversation with streaming responses |
| Training Advice | Ask questions about programming, form, exercise selection |
| Food Parsing | Describe meals in natural language and the AI logs them with estimated macros |
| Context Awareness | AI knows your recent workouts, goals, streak, and nutrition |
| Tool Use | AI can log food, log workouts, fetch your stats, and update goals through the chat |
| Rate Limiting | 10 requests per minute per user |
| AI Insights | Daily generated insights (2-3 actionable tips) shown on the dashboard |
| Post-Workout Summary | AI analysis of your completed workout |

**Models used:** Claude Sonnet for chat, Claude Haiku for insights and food parsing.

---

## Community & Social

**Routes:** `/community`, `/community/profile`, `/community/find`, `/community/user`, `/community/requests`, `/community/leaderboards`

Social features for connecting with other users.

| Feature | Description |
|---------|-------------|
| User Profile | Display name, bio, avatar, public/private visibility toggle |
| Friend Code | Unique code to share with friends for easy follow requests |
| User Search | Search for other users by username |
| Follow System | Send/accept/reject follow requests |
| Activity Feed | See workouts, PRs, badges, and milestones from people you follow |
| Reactions | Emoji reactions on feed posts |
| Leaderboards | Global rankings |
| Privacy | Profiles can be public (visible to all) or private (followers only) |

---

## Challenges & Leaderboards

**Routes:** `/community/challenges`, `/community/challenges/new`, `/community/challenges/view`

Competitive fitness challenges.

| Feature | Description |
|---------|-------------|
| Browse Challenges | View active and upcoming challenges |
| Create Challenge | Set a challenge type, duration, and goal |
| Challenge Types | Total volume, workout count, streak length, total sets, total reps |
| Join Challenge | Enroll in an active challenge |
| Leaderboard | Per-challenge rankings of all participants |
| Challenge Details | View rules, participants, progress, and standings |

---

## Notifications

**Route:** `/notifications`

In-app and push notifications.

| Feature | Description |
|---------|-------------|
| Notification Bell | Badge indicator showing unread count in the navigation |
| Notification List | View all notifications with timestamps |
| Types | Follow requests, challenge updates, badge earned, program reminders, workout reminders |
| Push Notifications | Native push on iOS/Android (Capacitor builds) |
| Preferences | Configure which notifications you receive (email, push, in-app) |

---

## Sharing

**Route:** `/share`

Generate visual cards to share achievements.

| Card Type | Description |
|-----------|-------------|
| PR Card | Personal record achievement with exercise, weight, and date |
| Streak Card | Workout streak milestone |
| Summary Card | Weekly workout summary (sessions, volume, time) |
| Fasting Card | Fasting milestone achievement |

Cards can be shared via native share sheet (mobile) or downloaded as images (web).

---

## Settings

**Route:** `/settings`

Configure your app experience.

| Section | Options |
|---------|---------|
| Profile | Display name, bio, avatar |
| Training | Days per week (1-7), preferred split (PPL, upper/lower, full body, bro split, custom), rotation mode |
| Nutrition | Daily calorie target, protein/carb/fat targets (grams) |
| TDEE Calculator | Estimate daily calorie needs based on age, weight, height, activity level |
| Fasting | Protocol selection (12:12 through 23:1), eating window start time |
| Auto-Rest Timer | Enable/disable auto-start rest timer, set default rest duration (seconds) |
| Units | Pounds (lbs) or kilograms (kg) |
| Health Sync | Toggle HealthKit (iOS) or Health Connect (Android) integration |
| Notification Preferences | Configure email, push, and in-app notification types |

---

## Data Export & Backup

**Route:** `/settings/export`

Export your data and create backups.

| Feature | Description |
|---------|-------------|
| CSV Export | Download workouts, nutrition, or weight data as CSV files |
| JSON Backup | Full data backup in JSON format |
| Restore | Upload a JSON backup to restore your data |
| PDF Reports | Generate formatted PDF reports of your training data |

---

## Offline & PWA

Works without an internet connection.

| Feature | Description |
|---------|-------------|
| Service Worker | Caches app shell and assets for offline access |
| IndexedDB (Dexie) | Local database stores workouts and nutrition data when offline |
| Offline Sync Queue | Changes made offline are queued and synced when connection returns |
| Offline Indicator | Badge in the UI showing current offline/online status |
| Install as App | Can be installed as a Progressive Web App on desktop or mobile |

---

## Native Mobile (Capacitor)

Available when built as a native iOS/Android app.

| Feature | Description |
|---------|-------------|
| Camera | Capture progress photos directly from the app |
| Barcode Scanner | Scan food product barcodes for nutrition lookup |
| Push Notifications | Native push notifications for reminders and social updates |
| Local Notifications | Scheduled workout and fasting reminders |
| HealthKit / Health Connect | Sync workout and weight data with Apple Health or Google Fit |
| Native Share | Share cards and achievements via the system share sheet |
| Haptic Feedback | Tactile feedback on key interactions |
| Splash Screen | Branded loading screen on app launch |
| Auth Guard | Route protection optimized for native navigation |

The native build uses a static export (no server-side rendering). API routes (AI features) are only available when the app connects to the Vercel-hosted backend.

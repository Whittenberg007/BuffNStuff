# BuffNStuff Testing Guide

A step-by-step guide to set up, create an account, and test every feature in the app.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Supabase Setup](#1-supabase-setup)
- [2. Environment Configuration](#2-environment-configuration)
- [3. Run the App Locally](#3-run-the-app-locally)
- [4. Create Your Account](#4-create-your-account)
- [5. Testing Checklist by Feature](#5-testing-checklist-by-feature)
  - [5.1 Settings (Do First)](#51-settings-do-first)
  - [5.2 Exercise Library](#52-exercise-library)
  - [5.3 Workout Templates](#53-workout-templates)
  - [5.4 Workout Tracking](#54-workout-tracking)
  - [5.5 Nutrition Tracking](#55-nutrition-tracking)
  - [5.6 Meal Plans](#56-meal-plans)
  - [5.7 Intermittent Fasting](#57-intermittent-fasting)
  - [5.8 Weight Tracking](#58-weight-tracking)
  - [5.9 Body Measurements & Photos](#59-body-measurements--photos)
  - [5.10 Progress & Analytics](#510-progress--analytics)
  - [5.11 Goals](#511-goals)
  - [5.12 Exercise Clips](#512-exercise-clips)
  - [5.13 Workout Calendar](#513-workout-calendar)
  - [5.14 Training Programs](#514-training-programs)
  - [5.15 AI Coach](#515-ai-coach)
  - [5.16 Community & Social](#516-community--social)
  - [5.17 Challenges](#517-challenges)
  - [5.18 Notifications](#518-notifications)
  - [5.19 Sharing](#519-sharing)
  - [5.20 Data Export & Backup](#520-data-export--backup)
  - [5.21 Dashboard](#521-dashboard)
- [6. Known Limitations](#6-known-limitations)
- [7. Troubleshooting](#7-troubleshooting)

---

## Prerequisites

- **Node.js** 18+ installed
- **npm** or **pnpm** package manager
- A free **Supabase** account (https://supabase.com)
- (Optional) **Anthropic API key** for AI Coach features

---

## 1. Supabase Setup

### 1.1 Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click **New Project**
3. Choose an organization, name the project (e.g., `buffnstuff-dev`), set a database password, choose a region
4. Wait for the project to finish provisioning

### 1.2 Run the Schema SQL

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `supabase/schema.sql` from this repo
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run** — this creates all 32 tables with RLS policies and indexes

### 1.3 Seed the Exercise Library

1. In the SQL Editor, open `supabase/seed-exercises.sql`
2. Copy and paste the contents, then click **Run**
3. This inserts 202 built-in exercises (system exercises with `user_id = NULL`)

### 1.4 Create a Storage Bucket (for progress photos)

1. Go to **Storage** in the Supabase dashboard
2. Click **New Bucket**
3. Name: `progress-photos`, set to **Public** (or private with signed URLs)
4. Create a second bucket named `exercise-clips` if you want clip storage

### 1.5 Verify Auth Settings

1. Go to **Authentication > Providers**
2. Ensure **Email** provider is enabled
3. For testing, you may want to disable "Confirm email" under **Authentication > Settings** so you can sign up without email verification

---

## 2. Environment Configuration

1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   Find these in **Supabase Dashboard > Settings > API**.

3. (Optional) For AI Coach features, add to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

---

## 3. Run the App Locally

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app should be running at **http://localhost:3000**.

---

## 4. Create Your Account

1. Open http://localhost:3000 — you'll be redirected to `/login`
2. Click **"Sign up"** to toggle to signup mode
3. Enter an email and password (minimum 6 characters)
4. Click **Sign Up**
5. If email confirmation is disabled in Supabase, you'll be logged in immediately
6. If email confirmation is enabled, check your email for the verification link

You should now see the main Dashboard.

**For social feature testing:** Create a second account using a different email (or use Supabase's email alias trick: `yourname+test2@gmail.com`).

---

## 5. Testing Checklist by Feature

Use the checkboxes below to track what you've tested. Test in this order for the best experience — later features depend on data from earlier ones.

### 5.1 Settings (Do First)

Go to `/settings` and configure your baseline preferences.

- [ ] Set display name
- [ ] Choose unit preference (lbs or kg)
- [ ] Set training days per week
- [ ] Choose preferred split (PPL, upper/lower, full body, bro split, custom)
- [ ] Set daily calorie target
- [ ] Set protein/carb/fat targets
- [ ] Try the TDEE calculator
- [ ] Set rotation mode (suggested, auto, manual)
- [ ] Configure fasting protocol (if desired)
- [ ] Toggle auto-rest timer on/off and set duration

### 5.2 Exercise Library

Go to `/exercises`.

- [ ] Browse the exercise list — should see 202 exercises
- [ ] Search for an exercise by name (e.g., "bench press")
- [ ] Filter by muscle group (e.g., chest)
- [ ] Filter by equipment (e.g., barbell)
- [ ] View exercise details (tap an exercise)
- [ ] Create a custom exercise — verify it appears in the list

### 5.3 Workout Templates

Go to `/workout/templates`.

- [ ] Create a new template (e.g., "Push Day")
- [ ] Set split type and training style
- [ ] Add 3-5 exercises with target sets/reps/weight
- [ ] Save the template
- [ ] Verify it appears in the template list
- [ ] Edit the template — change an exercise or rep count
- [ ] Delete a template (if you want to test deletion)

### 5.4 Workout Tracking

Go to `/workout`.

**Start a workout from template:**
- [ ] Tap a template to start a workout
- [ ] Verify exercises are pre-loaded from the template
- [ ] Complete the readiness check-in (rate sleep, soreness, energy)
- [ ] Log sets for the first exercise (enter weight, reps, tap "Log Set")
- [ ] Verify the rest timer starts (if auto-rest is enabled)
- [ ] Log multiple sets — try different weights/reps
- [ ] Move to the next exercise and log sets
- [ ] Check if any sets are flagged as PRs
- [ ] Try the plate calculator (enter a target weight, see plate breakdown)
- [ ] Add session notes
- [ ] Rate mood/energy
- [ ] End the workout
- [ ] Verify the session appears in workout history

**Start a blank workout:**
- [ ] Start a workout without a template
- [ ] Use the exercise picker to add exercises
- [ ] Log sets and complete the workout

### 5.5 Nutrition Tracking

Go to `/nutrition`.

- [ ] Log a food entry manually (name, calories, protein, carbs, fats)
- [ ] Assign it to a meal (breakfast, lunch, dinner, snacks)
- [ ] Log multiple entries across different meals
- [ ] Verify macro progress bars update
- [ ] Add a food to favorites
- [ ] Log a food from favorites (quick-add)
- [ ] Check daily totals at the bottom
- [ ] Try the food search (if integrated)

### 5.6 Meal Plans

Go to `/nutrition/plans`.

- [ ] Create a new meal plan
- [ ] Add food items with macros
- [ ] Save the plan
- [ ] Browse saved plans
- [ ] Load a plan to log a full day

### 5.7 Intermittent Fasting

On the `/nutrition` page.

- [ ] Verify fasting timer shows (based on your settings)
- [ ] Check that it counts down correctly
- [ ] Verify fasting streak updates after a completed fast

### 5.8 Weight Tracking

On the `/progress` page (Weight tab).

- [ ] Log today's weight
- [ ] Log weight for a few more days (change dates if possible)
- [ ] Verify the weight chart displays your entries
- [ ] Check the trend line calculation

### 5.9 Body Measurements & Photos

Go to `/body`.

- [ ] Log body measurements (chest, arms, waist, etc.)
- [ ] Verify measurement chart shows data
- [ ] Take a progress photo (if on a device with camera)
- [ ] Browse the photo gallery
- [ ] Try photo comparison (need at least 2 photos from different dates)

### 5.10 Progress & Analytics

Go to `/progress`.

- [ ] **Weight tab** — verify chart with logged weight data
- [ ] **Exercises tab** — select an exercise and view its progression chart (need logged workout data)
- [ ] **Volume tab** — verify total volume trends
- [ ] **Frequency tab** — check the workout frequency heatmap
- [ ] **Muscle Balance tab** — verify radar chart shows volume by muscle group

### 5.11 Goals

Go to `/progress/goals`.

- [ ] Create a strength goal (e.g., "Bench 225 lbs")
- [ ] Create a consistency goal (e.g., "4 workouts per week")
- [ ] Create a nutrition goal
- [ ] Verify progress indicators update as you log data
- [ ] Mark a goal as complete (if applicable)

### 5.12 Exercise Clips

Go to `/exercises/clips`.

- [ ] Add a new clip (paste a YouTube URL)
- [ ] Set start/end timestamps with the timeline selector
- [ ] Link it to an exercise
- [ ] Verify it appears in the clips gallery
- [ ] Play the clip back with the embedded player

### 5.13 Workout Calendar

Go to `/calendar`.

- [ ] Verify completed workouts appear on the calendar
- [ ] Tap a day with a workout to see details
- [ ] Navigate between months
- [ ] Check timezone handling

### 5.14 Training Programs

Go to `/programs`.

- [ ] Browse available programs at `/programs/browse`
- [ ] Enroll in a program
- [ ] View your active program at `/programs/active`
- [ ] Check the weekly schedule
- [ ] Start a workout from the program schedule
- [ ] Try creating a custom program at `/programs/new`
- [ ] Set progression rules

### 5.15 AI Coach

Go to `/coach`.

> Requires `ANTHROPIC_API_KEY` in `.env.local`. Only works on the web version (API routes don't work in Capacitor builds).

- [ ] Send a chat message (e.g., "What should I train today?")
- [ ] Verify streaming response works
- [ ] Try food parsing: "I had 2 eggs, toast with butter, and a coffee"
- [ ] Verify the AI logged the food to your nutrition
- [ ] Ask about your recent workouts
- [ ] Check rate limiting (send 10+ messages quickly — should see limit message)
- [ ] Go to Dashboard and check AI Insights card

### 5.16 Community & Social

Go to `/community`.

> For full testing, you need **two accounts**.

**Profile setup:**
- [ ] Go to `/community/profile`
- [ ] Set username, bio, avatar
- [ ] Toggle public/private visibility
- [ ] Note your friend code

**With second account:**
- [ ] Search for your first account at `/community/find`
- [ ] Send a follow request
- [ ] Switch to first account, go to `/community/requests`
- [ ] Accept the follow request
- [ ] Verify the follower appears

**Activity Feed:**
- [ ] Log a workout on one account
- [ ] Check the feed on the other account — should see workout activity
- [ ] React to a feed post with an emoji

**Leaderboards:**
- [ ] Check `/community/leaderboards` for global rankings

### 5.17 Challenges

Go to `/community/challenges`.

- [ ] Create a new challenge (e.g., "Most volume in 7 days")
- [ ] Set challenge type, duration, and goal
- [ ] Join the challenge from the second account
- [ ] Log workouts and verify the leaderboard updates
- [ ] View challenge details and standings

### 5.18 Notifications

Go to `/notifications`.

- [ ] Check for notifications after social interactions (follow requests, challenge invites)
- [ ] Verify the notification bell shows unread count
- [ ] Tap a notification to dismiss/mark as read
- [ ] Configure notification preferences in settings

### 5.19 Sharing

Go to `/share`.

- [ ] Generate a PR card (need at least one PR from workouts)
- [ ] Generate a streak card
- [ ] Generate a weekly summary card
- [ ] Generate a fasting card
- [ ] Try sharing/downloading the card

### 5.20 Data Export & Backup

Go to `/settings/export`.

- [ ] Export workouts as CSV
- [ ] Export nutrition as CSV
- [ ] Export weight data as CSV
- [ ] Create a full JSON backup
- [ ] Download and inspect the backup file
- [ ] Try restoring from the JSON backup
- [ ] Generate a PDF report

### 5.21 Dashboard

Go to `/` (home) — test this last since it aggregates data from everything above.

- [ ] Verify Today's Workout widget (from active program or next template)
- [ ] Verify Weekly Summary shows recent workouts
- [ ] Verify Streak Counter is accurate
- [ ] Verify Recent PRs display
- [ ] Verify Badges Display (earned from workouts, streaks, etc.)
- [ ] Verify Recovery Score (from readiness check-ins)
- [ ] Verify Muscle Fatigue Map
- [ ] Verify AI Insights (if API key configured)
- [ ] Verify Active Program status
- [ ] Check Training Alerts (plateau, rotation, volume landmarks)

---

## 6. Known Limitations

| Area | Limitation |
|------|-----------|
| **AI Coach** | Requires Anthropic API key and only works on the web build (not Capacitor native) |
| **Barcode Scanner** | Only works in Capacitor native builds, not in browser |
| **Push Notifications** | Only work in Capacitor native builds |
| **Health Sync** | Only works in Capacitor native builds with HealthKit (iOS) or Health Connect (Android) |
| **Camera** | Photo capture uses Capacitor Camera plugin — on web, falls back to file upload |
| **Offline** | Service worker caches assets but full offline data sync may have edge cases |

---

## 7. Troubleshooting

### App won't start
- Verify `.env.local` exists with valid Supabase URL and anon key
- Run `npm install` to ensure dependencies are installed
- Check that Node.js 18+ is installed: `node --version`

### Login fails
- Check Supabase Auth settings — is Email provider enabled?
- If using email confirmation, check your inbox (including spam)
- Verify Supabase URL and anon key are correct in `.env.local`

### Empty exercise library
- Run `supabase/seed-exercises.sql` in the Supabase SQL Editor
- Exercises with `user_id = NULL` are system exercises visible to all users

### Tables don't exist errors
- Run the full `supabase/schema.sql` in the SQL Editor — it contains all 32 tables needed
- Then run `supabase/seed-exercises.sql` to populate the exercise library

### AI Coach not responding
- Verify `ANTHROPIC_API_KEY` is set in `.env.local`
- This is a server-side key — it won't work in Capacitor static builds
- Check browser console for API errors
- Rate limit: 10 requests per minute per user

### Progress charts empty
- Charts require data — log workouts, weight, and nutrition first
- Exercise progression needs at least 2 sessions with the same exercise

### Photos not saving
- Check that the `progress-photos` storage bucket exists in Supabase
- Verify RLS policies allow your user to upload

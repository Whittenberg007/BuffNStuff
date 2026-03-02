# Phase 15: Structured Programs, Social Challenges & Smart Notifications — Design

**Date:** 2026-03-01
**Branch:** `feature/phase-15-programs-challenges-notifications`
**Status:** Approved

## Goal

Add science-based structured training programs with periodization, social challenges with leaderboards, and a full notification system — turning BuffNStuff from a logging tool into a coaching platform.

## Part 1: Structured Programs

### Science-Based Foundation

Programs are built on evidence-based training principles:

- **Volume Landmarks** (Renaissance Periodization): Each muscle group has MEV (Minimum Effective Volume), MAV (Maximum Adaptive Volume), and MRV (Maximum Recoverable Volume) thresholds. Programs auto-scale volume within these ranges across mesocycles.
- **Frequency**: 2-4x per muscle group per week for hypertrophy (meta-analysis supported). Strength programs use 1-2x frequency with heavier loads.
- **Progressive Overload**: Linear (add weight), percentage-based (increase by %), or RPE-based (autoregulated) progression each week.
- **Periodization**: Linear periodization for beginners, daily undulating periodization (DUP) for intermediates, block periodization for advanced.
- **Deload Protocol**: Programmed deload every 4-6 weeks — reduce volume by 40-50% while maintaining intensity to allow recovery supercompensation.
- **Rep Ranges**: Strength (1-5 reps, 3-5 min rest), Hypertrophy (6-12 reps, 60-90s rest), Endurance (12-20+ reps, 30-60s rest). Programs use the appropriate ranges per goal.

### Pre-Built Program Library

Each program includes weekly schedule, exercise selection, set/rep schemes, progression rules, and deload timing.

**Strength Programs:**

| Program | Days/Week | Level | Periodization | Description |
|---------|-----------|-------|---------------|-------------|
| Starting Strength | 3 | Beginner | Linear | Squat/Bench/Deadlift/OHP. Add 5 lbs/session. The proven beginner template. |
| GZCLP | 3-4 | Beginner | Linear (tiered) | T1 compound (3-5 reps), T2 secondary (6-10 reps), T3 accessories (15-25 reps). Auto-adjusting rep scheme on failure. |
| 5/3/1 BBB | 4 | Intermediate | Weekly undulating | Wendler's classic. Main lift at 5/3/1 reps, then 5x10 BBB sets at 50-60%. Monthly progression. |
| nSuns 5/3/1 LP | 4-5 | Intermediate | Linear | High-volume 5/3/1 variant. 8-9 sets on main lifts with back-off work. Weekly weight increases. |
| Conjugate Method | 4 | Advanced | Conjugate | Max effort + dynamic effort days. Rotate main movements every 1-3 weeks. Bands/chains optional. |

**Hypertrophy Programs:**

| Program | Days/Week | Level | Periodization | Description |
|---------|-----------|-------|---------------|-------------|
| PPL Classic | 6 | Intermediate | Linear | Push/Pull/Legs 2x/week. High frequency per muscle group. Volume progresses weekly, deload every 5th week. |
| PHUL | 4 | Intermediate | DUP | Power Hypertrophy Upper Lower. Power days (3-5 reps) + hypertrophy days (8-12 reps). Best of both worlds. |
| PHAT | 5 | Advanced | DUP | Layne Norton's Power Hypertrophy Adaptive Training. 2 power days + 3 hypertrophy days. High volume. |
| RP Mesocycle | 4-6 | Intermediate+ | Block | Renaissance Periodization style. MEV→MRV volume progression over 4-6 weeks, then deload. Volume landmarks per muscle. |
| German Volume Training | 4 | Intermediate | Linear | 10x10 at 60% 1RM. Extreme volume for mass. 60s rest periods. 6-week mesocycle. |
| Bro Split | 5 | Beginner+ | Linear | Chest/Back/Shoulders/Legs/Arms. 1x frequency but very high volume per session. Simple and effective. |

**General / Recomp:**

| Program | Days/Week | Level | Periodization | Description |
|---------|-----------|-------|---------------|-------------|
| Full Body 3x | 3 | Beginner | Linear | Full body each session. Compound-focused. Perfect for beginners or time-limited lifters. |
| Upper/Lower | 4 | Beginner+ | Linear | Alternating upper/lower. Good balance of frequency and recovery. |

### Progression Types

| Type | How It Works | Best For |
|------|-------------|----------|
| Linear (weight) | Add X lbs per session or week | Beginners, strength programs |
| Linear (reps) | Add 1 rep per set each week until target, then increase weight | Hypertrophy programs |
| Percentage-based | Increase working weight by X% each week/cycle | Intermediate programs (5/3/1) |
| RPE/RIR autoregulated | Target RPE each set; weight adjusts based on daily readiness | Advanced lifters |
| Wave loading | Cycle through heavy/medium/light weeks | DUP programs (PHUL, PHAT) |
| Volume ramp | Increase sets per week from MEV toward MRV, then deload | RP-style mesocycles |

### Database Schema

**`training_programs`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| user_id | uuid FK → auth.users | NULL for pre-built programs |
| name | text | NOT NULL |
| description | text | Optional |
| duration_weeks | int | NOT NULL (4, 6, 8, 12) |
| difficulty | text | beginner / intermediate / advanced |
| goal | text | strength / hypertrophy / endurance / recomp / general |
| days_per_week | int | NOT NULL (3-6) |
| periodization | text | linear / dup / block / conjugate |
| schedule | jsonb | See schedule format below |
| progression_rules | jsonb | See progression format below |
| deload_config | jsonb | `{ every_n_weeks: 4, volume_reduction: 0.5, intensity_reduction: 0 }` |
| is_prebuilt | boolean | Default false |
| created_at | timestamptz | Default `now()` |

**Schedule format** (jsonb):
```json
{
  "weeks": [
    {
      "week_number": 1,
      "label": "Accumulation",
      "days": [
        {
          "day_of_week": 1,
          "template_id": "uuid-of-template",
          "label": "Upper Power",
          "overrides": {
            "sets_multiplier": 1.0,
            "rpe_target": 7
          }
        }
      ]
    }
  ],
  "repeat_from_week": 1
}
```

**Progression rules format** (jsonb):
```json
{
  "type": "linear_weight",
  "compound_increment_lbs": 5,
  "isolation_increment_lbs": 2.5,
  "failure_protocol": "deload_10_percent",
  "rpe_target": 8
}
```

**`program_enrollments`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| user_id | uuid FK → auth.users | NOT NULL |
| program_id | uuid FK → training_programs | NOT NULL |
| started_at | timestamptz | NOT NULL, Default `now()` |
| current_week | int | Default 1 |
| current_day_index | int | Default 0 |
| status | text | active / completed / abandoned |
| progress_log | jsonb | Week-by-week completion tracking |
| completed_at | timestamptz | NULL |

RLS:
- Own enrollments: full CRUD
- Pre-built programs: SELECT for all authenticated users
- User-created programs: SELECT/UPDATE/DELETE only by owner

### Routes

```
/(app)/programs              → My programs (active enrollment + created)
/(app)/programs/browse       → Pre-built program library with filters
/(app)/programs/new          → Create custom program (wizard)
/(app)/programs/active       → Active program week view + today's workout
```

All static routes for Capacitor compatibility.

---

## Part 2: Social Challenges

### Challenge Types

Each challenge type auto-calculates scores from existing workout data — no manual entry needed.

| Type | Score Metric | Description |
|------|-------------|-------------|
| total_volume | Sum of (weight × reps) across all sets | Who can move the most total weight? |
| total_workouts | Count of completed sessions | Most consistent lifter wins. |
| streak | Consecutive workout days | Longest unbroken streak during the challenge. |
| total_sets | Count of working sets logged | Pure work capacity challenge. |
| total_reps | Sum of all reps logged | High-rep endurance challenge. |

### Database Schema

**`challenges`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| creator_id | uuid FK → user_profiles(id) | NOT NULL |
| title | text | NOT NULL, max 80 chars |
| description | text | Optional, max 280 chars |
| challenge_type | text | total_volume / total_workouts / streak / total_sets / total_reps |
| start_date | date | NOT NULL |
| end_date | date | NOT NULL |
| status | text | upcoming / active / completed, default `upcoming` |
| created_at | timestamptz | Default `now()` |

CHECK: `end_date > start_date`
CHECK: `end_date - start_date <= 90` (max 90 days)

**`challenge_participants`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| challenge_id | uuid FK → challenges ON DELETE CASCADE | NOT NULL |
| user_id | uuid FK → auth.users | NOT NULL |
| current_score | numeric | Default 0, recalculated on query |
| joined_at | timestamptz | Default `now()` |
| UNIQUE | | (challenge_id, user_id) |

RLS:
- Creator can INSERT, UPDATE status, DELETE their own challenges
- Participants can INSERT/DELETE their own participation
- All participants can SELECT challenge + participant data
- Score updates via database function or application-level calculation

### Persistent Leaderboards

No new table — computed from existing workout_sessions + workout_sets data, scoped to accepted followers.

| Leaderboard | Query |
|-------------|-------|
| Weekly Volume King | Sum weight×reps from current week's sessions |
| Longest Current Streak | Count consecutive workout days |
| Monthly PR Count | Count sets where is_pr=true this month |
| Monthly Workout Count | Count completed sessions this month |

### Challenge Flow

1. User creates challenge: picks type, title, date range
2. Challenge appears in creator's community feed as `challenge_created` event
3. Friends see it in feed and can join from the challenge detail page
4. Scores auto-recalculate on each page visit (query-time computation, not stored)
5. Leaderboard shows all participants ranked by score
6. When end_date passes, status becomes `completed`, winner gets a feed event

### Routes

```
/(app)/community/challenges        → Active + upcoming challenges list
/(app)/community/challenges/new    → Create a challenge
/(app)/community/challenges/view   → Challenge detail + leaderboard (?id=)
/(app)/community/leaderboards      → Persistent friend leaderboards
```

---

## Part 3: Smart Notifications

### Notification Categories

| Category | Triggers | Delivery |
|----------|---------|----------|
| **Workout Reminders** | Scheduled training days from active program or custom schedule | Local notification (Capacitor) |
| **Social** | Follow request received, follow accepted, reaction on your feed item, challenge invite/join | In-app notification |
| **Achievement** | PR hit, badge earned, streak milestone, goal completed, challenge won | In-app notification |

### Database Schema

**`notification_preferences`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| user_id | uuid FK → auth.users | UNIQUE, NOT NULL |
| workout_reminders | boolean | Default true |
| social_notifications | boolean | Default true |
| achievement_alerts | boolean | Default true |
| reminder_time | text | Default "09:00" (HH:mm) |
| reminder_days | jsonb | Default `[1,3,5]` (days of week, 0=Sunday) |
| updated_at | timestamptz | Default `now()` |

**`notifications`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| user_id | uuid FK → auth.users | NOT NULL |
| type | text | See types below |
| title | text | NOT NULL |
| body | text | NOT NULL |
| data | jsonb | `{ link: "/community/requests", metadata: {} }` |
| is_read | boolean | Default false |
| created_at | timestamptz | Default `now()` |

Notification types: `workout_reminder`, `follow_request`, `follow_accepted`, `reaction_received`, `challenge_invite`, `challenge_won`, `pr_hit`, `badge_earned`, `streak_milestone`, `goal_completed`

RLS:
- Own notifications: SELECT, UPDATE (mark read), DELETE
- System/hooks can INSERT via service role or application-level

### Implementation Approach

**In-app notifications:**
- Bell icon in app header with unread count badge
- Notification inbox page listing all notifications
- Mark as read on tap, links to relevant page
- Created by hooks in existing functions (same pattern as feed events)

**Local notifications (Capacitor):**
- Schedule weekly workout reminders using `@capacitor/local-notifications` (already installed)
- Triggered when user starts a program or configures reminder days
- Reschedule when preferences change

**Notification creation hooks:**
- Extend existing feed event hooks to also create notifications
- Follow accept/reject creates notification for the requester
- Reaction on feed item creates notification for the item owner
- Challenge join creates notification for the creator

### Routes

```
/(app)/notifications              → Notification inbox
```

### Settings Integration

Add "Notifications" section to existing settings page with toggles for each category and reminder time/day configuration.

---

## 4. Navigation Changes

- **Programs**: Add "Programs" card/link on dashboard page and in the workout section
- **Notification bell**: Add to top of all pages via the app layout (not bottom nav)
- **Challenges/Leaderboards**: Accessible from the Community page header

Bottom nav stays at 6 tabs (Dashboard, Workout, Exercises, Nutrition, Community, Progress). Programs are accessed from Dashboard or Workout. Notifications from the bell icon.

---

## 5. Cross-Feature Integration

| Event | Feed Event | Notification | Challenge Score |
|-------|-----------|--------------|-----------------|
| Workout completed | Yes (existing) | No | Auto-update volume/sets/reps/workout count |
| PR hit | Yes (existing) | Achievement alert | Auto-update if PR challenge existed |
| Badge earned | Yes (existing) | Achievement alert | — |
| Streak milestone | Yes (existing) | Achievement alert | Auto-update streak challenges |
| Follow request | — | Social notification | — |
| Follow accepted | — | Social notification | — |
| Reaction received | — | Social notification | — |
| Challenge created | New feed event type | — | — |
| Challenge joined | — | Creator notified | — |
| Challenge won | New feed event type | Achievement alert | — |
| Program started | New feed event type | — | — |
| Program completed | New feed event type | Achievement alert | — |
| Program week completed | — | — | — |

---

## 6. New Feed Event Types

Add to existing `FeedEventType`:
- `challenge_created`: `{ challenge_title, challenge_type, end_date }`
- `challenge_won`: `{ challenge_title, challenge_type, score }`
- `program_started`: `{ program_name, duration_weeks, goal }`
- `program_completed`: `{ program_name, duration_weeks }`

---

## 7. File Structure

```
src/
├── lib/database/
│   ├── programs.ts          — Program CRUD, enrollment, pre-built seed data
│   ├── challenges.ts        — Challenge CRUD, scores, leaderboards
│   └── notifications.ts     — Notification CRUD, preferences, local scheduling
├── components/
│   ├── programs/
│   │   ├── program-card.tsx       — Program summary card
│   │   ├── program-builder.tsx    — Multi-step program creation wizard
│   │   ├── week-view.tsx          — Weekly schedule visualization
│   │   ├── progression-config.tsx — Progression rule picker
│   │   └── program-browser.tsx    — Filterable pre-built program list
│   ├── challenges/
│   │   ├── challenge-card.tsx     — Challenge summary with progress
│   │   ├── challenge-form.tsx     — Create challenge form
│   │   ├── leaderboard.tsx        — Ranked participant list
│   │   └── leaderboard-card.tsx   — Single leaderboard metric card
│   └── notifications/
│       ├── notification-bell.tsx       — Bell icon with unread count
│       ├── notification-list.tsx       — Notification inbox items
│       └── notification-preferences.tsx — Settings toggles
├── app/(app)/
│   ├── programs/
│   │   ├── page.tsx               — My programs hub
│   │   ├── browse/page.tsx        — Pre-built library
│   │   ├── new/page.tsx           — Create program wizard
│   │   └── active/page.tsx        — Active program view
│   ├── community/
│   │   ├── challenges/page.tsx         — Challenges list
│   │   ├── challenges/new/page.tsx     — Create challenge
│   │   ├── challenges/view/page.tsx    — Challenge detail (?id=)
│   │   └── leaderboards/page.tsx       — Persistent leaderboards
│   └── notifications/page.tsx     — Notification inbox
```

---

## 8. Dependencies

No new npm dependencies needed. Uses existing:
- Supabase client for all database operations
- `@capacitor/local-notifications` for workout reminders (already installed)
- `@capacitor/haptics` for interaction feedback (already installed)
- `lucide-react` icons
- shadcn/ui components
- `date-fns` for date calculations

---

## 9. Cross-Platform

| Feature | Web | Native |
|---------|-----|--------|
| Programs | Standard pages | Same |
| Challenges | Standard pages | Same |
| Leaderboards | Standard pages | Same |
| Workout reminders | Not available (no local notifications) | Local notifications via Capacitor |
| In-app notifications | Bell icon + inbox | Same + haptic on new notification |
| Challenge sharing | Copy link | Native share sheet |

---

## References

- [Resistance Training Variables for Optimization of Muscle Hypertrophy (Frontiers)](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2022.949021/full)
- [Training Volume Landmarks for Muscle Growth (RP Strength)](https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth)
- [Loading Recommendations: Repetition Continuum Re-Examination (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7927075/)
- [GZCLP Program Guide (Lift Vault)](https://liftvault.com/programs/powerlifting/gzclp-program-spreadsheets/)
- [Best Muscle-Building Programs 2026 (Powerlifting Technique)](https://powerliftingtechnique.com/best-hypertrophy-program/)
- [Mike Israetel Volume Landmarks Explained](https://drmikeisraetel.com/dr-mike-israetel-wikipedia/dr-mike-israetel-mv-mev-mav-mrv-explained/)

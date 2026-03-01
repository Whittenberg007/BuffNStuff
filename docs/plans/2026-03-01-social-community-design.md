# Phase 14: Social & Community — Design

**Date:** 2026-03-01
**Branch:** `feature/phase-14-social-community`
**Status:** Approved

## Goal

Add motivation and accountability features: user profiles, follow system with friend codes, activity feed of followed users' fitness activity, and emoji reactions — the gym buddy experience.

## Approach

Supabase-native with polling/pull-to-refresh. No real-time subscriptions. Standard Supabase tables with RLS. Matches existing architecture, works offline (cached feed), simple.

## 1. Database Schema

### `user_profiles` — Public profile data

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| user_id | uuid FK → auth.users | UNIQUE, NOT NULL |
| username | text | UNIQUE, NOT NULL, lowercase, 3-20 chars, `^[a-z0-9_]+$` |
| display_name | text | From user_settings or custom |
| bio | text | Optional, max 160 chars |
| avatar_url | text | Optional |
| is_public | boolean | Default `false` (private by default) |
| friend_code | text | UNIQUE, NOT NULL, auto-generated (e.g. "BUFF-7X3K") |
| created_at | timestamptz | Default `now()` |

RLS:
- Own profile: full CRUD
- Other profiles: SELECT only when `is_public = true` OR viewer has accepted follow relationship
- Username and friend_code: always visible for search/lookup (needed for discovery)

### `follows` — Follow relationships with approval

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| follower_id | uuid FK → user_profiles(id) | NOT NULL |
| following_id | uuid FK → user_profiles(id) | NOT NULL |
| status | text | `pending` / `accepted` / `rejected`, default `pending` |
| created_at | timestamptz | Default `now()` |
| UNIQUE | | (follower_id, following_id) |

CHECK: `follower_id != following_id` (can't follow yourself)

RLS:
- Follower can INSERT and DELETE their own follows
- Following user can UPDATE status (accept/reject pending requests)
- Both parties can SELECT rows involving them

### `activity_feed` — Feed events

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| user_id | uuid FK → auth.users | NOT NULL |
| event_type | text | NOT NULL |
| event_data | jsonb | Type-specific payload |
| created_at | timestamptz | Default `now()` |

Event types and their `event_data` shape:
- `workout_completed`: `{ split_type, total_sets, total_volume, duration_minutes }`
- `pr_hit`: `{ exercise_name, weight, reps, unit }`
- `streak_milestone`: `{ streak_count }`
- `badge_earned`: `{ badge_type, badge_label }`
- `weight_milestone`: `{ message }` (no actual weight exposed)

RLS:
- Own events: INSERT, SELECT
- Followed users' events: SELECT only if follow status is `accepted`

### `reactions` — Emoji reactions on feed items

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Default `gen_random_uuid()` |
| activity_id | uuid FK → activity_feed(id) ON DELETE CASCADE | NOT NULL |
| user_id | uuid FK → auth.users | NOT NULL |
| emoji | text | NOT NULL, one of: 💪🔥🎉👏🏆 |
| created_at | timestamptz | Default `now()` |
| UNIQUE | | (activity_id, user_id) — one reaction per user per item |

RLS:
- Own reactions: INSERT, DELETE, SELECT
- Others' reactions: SELECT on feed items user can already see

## 2. Profile Setup

- Username picker shown in Settings → "Community Profile" section
- Username: unique, 3-20 chars, lowercase alphanumeric + underscores
- Auto-generated friend code on profile creation: format `BUFF-XXXX` (4 random alphanumeric uppercase chars)
- Bio: optional, 160 char max
- Avatar: optional URL (Supabase Storage upload or external URL)
- Privacy toggle: public/private (default private)
- Profile card displays: username, display name, bio, total workouts, current streak, badge count, follower/following counts

## 3. Follow System

- **Discovery:** Search by username OR enter friend code
- **Private profiles:** Follow sends request → shows as `pending` → target user accepts/rejects from requests page
- **Public profiles:** Follow is instantly `accepted`
- **Unfollow:** Removes the follow row entirely
- **Pending requests page:** List of incoming requests with accept/reject buttons
- **Counts:** Follower count and following count shown on profile

## 4. Activity Feed

- **Route:** `/community` — main social page
- **Content:** Chronological feed of followed users' activity (newest first)
- **Pull-to-refresh:** Standard load-on-mount + refresh button (no real-time)
- **Pagination:** Load 20 items at a time, "Load more" button
- **Event display:**
  - Workout completed: "{name} finished {split_type} — {total_sets} sets, {total_volume} lbs volume"
  - PR hit: "{name} hit a PR! {exercise_name}: {weight} {unit} × {reps}"
  - Streak milestone: "{name} reached a {streak_count}-day workout streak 🔥"
  - Badge earned: "{name} earned {badge_label}"
  - Weight milestone: "{name} hit a weight goal!"
- **Reactions:** Tap to react with emoji (💪🔥🎉👏🏆), shows reaction counts per emoji, one reaction per user per item (tapping again removes it)

## 5. Feed Event Generation

Events auto-created by hooking into existing database functions:

| Trigger | Event Type | Where to Hook |
|---------|-----------|---------------|
| Workout session ended | `workout_completed` | `endWorkoutSession()` in `lib/database/workouts.ts` |
| PR detected on set log | `pr_hit` | Where `is_pr` is set in workout set logging |
| Streak reaches 7, 14, 30, 60, 90 | `streak_milestone` | `checkAndAwardBadges()` or streak calculation |
| Badge earned | `badge_earned` | `awardBadge()` in `lib/training/badges.ts` |
| Weight goal achieved | `weight_milestone` | `logWeight()` + goal check |

Each hook checks if the user has a profile before creating the event. If no profile exists, no event is created (opt-in via profile creation).

## 6. Routes

```
/(app)/community              → Activity feed + header with profile/find links
/(app)/community/profile      → Own profile view/edit
/(app)/community/requests     → Pending follow requests (accept/reject)
/(app)/community/find         → Search by username or friend code
/(app)/community/user         → View another user's profile (via ?id= query param)
```

All static routes (no `[id]` segments) for Capacitor static export compatibility.

## 7. Navigation

- Add "Community" icon to bottom nav bar (between Nutrition and Progress)
- Uses `Users` icon from lucide-react
- Badge indicator on Community icon when there are pending follow requests

## 8. File Structure

```
src/
├── lib/
│   └── database/
│       ├── profiles.ts          — Profile CRUD, friend code generation
│       ├── follows.ts           — Follow/unfollow, accept/reject, counts
│       └── feed.ts              — Feed queries, event creation, reactions
├── components/
│   └── community/
│       ├── profile-card.tsx     — Profile display card
│       ├── profile-form.tsx     — Profile setup/edit form
│       ├── activity-feed.tsx    — Feed list with events
│       ├── feed-item.tsx        — Single feed event card
│       ├── reaction-bar.tsx     — Emoji reaction buttons
│       ├── follow-button.tsx    — Follow/unfollow/pending button
│       ├── user-search.tsx      — Username/friend code search
│       └── request-list.tsx     — Pending follow requests
├── app/(app)/
│   └── community/
│       ├── page.tsx             — Feed page
│       ├── profile/
│       │   └── page.tsx         — Own profile
│       ├── requests/
│       │   └── page.tsx         — Pending requests
│       ├── find/
│       │   └── page.tsx         — Search/find users
│       └── user/
│           └── page.tsx         — View other user's profile
```

## 9. Cross-Platform

| Feature | Web | Native |
|---------|-----|--------|
| Feed | Standard page | Same |
| Reactions | Click emoji | Tap + haptic feedback |
| Avatar upload | File input | File input (Capacitor webview handles camera/gallery) |
| Friend code sharing | Copy to clipboard | Native share sheet via @capacitor/share |
| Pull to refresh | Button | Same (future: native pull gesture) |

## 10. Dependencies

No new npm dependencies needed. Uses existing:
- Supabase client for all database operations
- `@capacitor/share` for friend code sharing (already installed from Phase 13)
- `@capacitor/haptics` for reaction feedback (already installed from Phase 11)
- `lucide-react` icons
- shadcn/ui components

## 11. Privacy & Security

- Profiles private by default — must opt-in to public
- Private profile stats only visible to accepted followers
- Weight values never shown in feed (only "hit a weight goal!" message)
- Friend codes are random and don't expose user identity
- RLS enforces all access control at the database level
- Users can unfollow at any time, immediately revoking access

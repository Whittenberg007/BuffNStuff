# BuffNStuff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal workout tracking and fitness intelligence PWA with fast set logging, progressive overload tracking, smart exercise pairing, YouTube video clipping, and nutrition tracking.

**Architecture:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui for the frontend, Supabase (PostgreSQL + Auth + Storage + Edge Functions) for the backend, Serwist for PWA/offline support, Dexie.js for IndexedDB offline caching, and Capacitor as an optional native Android wrapper. Mobile-first responsive design with desktop-optimized layouts for analytics and video clipping.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.x, Tailwind CSS 4, shadcn/ui, Supabase, Serwist, Dexie.js, Recharts, Capacitor, YouTube IFrame API

**Design Doc:** `docs/plans/2026-02-26-buffnstuff-design.md`

---

## Phase 1: Project Foundation

### Task 1.1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Step 1: Create Next.js app with TypeScript and Tailwind**

```bash
cd /c/Repos/BuffNStuff
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This creates the full project scaffold.

**Step 2: Verify the app runs**

```bash
npm run dev
```

Open `http://localhost:3000` — should see the Next.js default page.

**Step 3: Clean up default boilerplate**

Replace `src/app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">BuffNStuff</h1>
    </main>
  );
}
```

Remove all default content from `src/app/globals.css` except the Tailwind directives:

```css
@import "tailwindcss";
```

**Step 4: Verify clean app runs**

```bash
npm run dev
```

Should see "BuffNStuff" centered on the page.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with TypeScript and Tailwind CSS"
```

---

### Task 1.2: Install Core Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install all core dependencies**

```bash
cd /c/Repos/BuffNStuff

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI components (shadcn/ui init)
npx shadcn@latest init -d

# Charts
npm install recharts

# Offline/PWA
npm install dexie dexie-react-hooks

# Date utilities
npm install date-fns

# Form handling
npm install react-hook-form @hookform/resolvers zod

# UUID generation
npm install uuid
npm install -D @types/uuid
```

**Step 2: Initialize shadcn/ui and add base components**

```bash
npx shadcn@latest add button card input label tabs dialog sheet select badge progress toast sonner separator dropdown-menu avatar scroll-area
```

**Step 3: Verify build still works**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: install core dependencies (Supabase, shadcn/ui, Recharts, Dexie, etc.)"
```

---

### Task 1.3: Set Up Supabase Client

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `.env.local` (DO NOT commit)
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Create environment example file**

Create `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Create `.env.local` with actual values (get from Supabase dashboard after creating project).

**Step 2: Create browser Supabase client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 3: Create server Supabase client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

**Step 4: Create middleware for auth session refresh**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

Create `src/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 5: Ensure `.env.local` is in `.gitignore`**

Verify `.gitignore` contains `.env*.local`. It should from the Next.js scaffold.

**Step 6: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts .env.example
git commit -m "feat: set up Supabase client (browser, server, middleware)"
```

---

### Task 1.4: Create Supabase Database Schema

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Write the complete database schema**

Create `supabase/schema.sql`:

```sql
-- BuffNStuff Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EXERCISES (system + user-custom)
-- ============================================
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_muscle_group TEXT NOT NULL,
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment_type TEXT NOT NULL DEFAULT 'barbell',
  movement_pattern TEXT NOT NULL DEFAULT 'push',
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  instructions TEXT,
  tags TEXT[] DEFAULT '{}',
  source_credit TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System exercises (user_id IS NULL) readable by all; user exercises only by owner
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System exercises are readable by all authenticated users"
  ON exercises FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Users can read their own custom exercises"
  ON exercises FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own exercises"
  ON exercises FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_custom = true);

CREATE POLICY "Users can update their own exercises"
  ON exercises FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own exercises"
  ON exercises FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- WORKOUT TEMPLATES
-- ============================================
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  split_type TEXT NOT NULL DEFAULT 'custom',
  training_style TEXT NOT NULL DEFAULT 'hypertrophy',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own templates"
  ON workout_templates FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- TEMPLATE EXERCISES (exercises within a template)
-- ============================================
CREATE TABLE template_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER NOT NULL DEFAULT 10,
  target_weight DECIMAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  set_type TEXT NOT NULL DEFAULT 'working',
  notes TEXT
);

ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD template exercises via template ownership"
  ON template_exercises FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.user_id = auth.uid()
    )
  );

-- ============================================
-- WORKOUT SESSIONS
-- ============================================
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  split_type TEXT,
  training_style TEXT,
  notes TEXT,
  mood_energy INTEGER CHECK (mood_energy >= 1 AND mood_energy <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own sessions"
  ON workout_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- WORKOUT SETS (individual set logs)
-- ============================================
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight DECIMAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  set_type TEXT NOT NULL DEFAULT 'working',
  rpe_rir INTEGER CHECK (rpe_rir >= 1 AND rpe_rir <= 10),
  is_pr BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD sets via session ownership"
  ON workout_sets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_sets.session_id
      AND workout_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_sets.session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- ============================================
-- EXERCISE CLIPS (YouTube video bookmarks)
-- ============================================
CREATE TABLE exercise_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  youtube_url TEXT NOT NULL,
  start_seconds DECIMAL NOT NULL DEFAULT 0,
  end_seconds DECIMAL NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  muscle_groups TEXT[] DEFAULT '{}',
  creator_name TEXT,
  clip_type TEXT NOT NULL DEFAULT 'form',
  thumbnail_url TEXT,
  stored_clip_path TEXT,
  is_downloaded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE exercise_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own clips"
  ON exercise_clips FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- NUTRITION LOG
-- ============================================
CREATE TABLE nutrition_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_name TEXT NOT NULL,
  food_item TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g DECIMAL NOT NULL DEFAULT 0,
  carbs_g DECIMAL NOT NULL DEFAULT 0,
  fats_g DECIMAL NOT NULL DEFAULT 0,
  quantity_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own nutrition logs"
  ON nutrition_log FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- NUTRITION FAVORITES
-- ============================================
CREATE TABLE nutrition_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_item TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g DECIMAL NOT NULL DEFAULT 0,
  carbs_g DECIMAL NOT NULL DEFAULT 0,
  fats_g DECIMAL NOT NULL DEFAULT 0,
  default_quantity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own nutrition favorites"
  ON nutrition_favorites FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- WEIGHT LOG
-- ============================================
CREATE TABLE weight_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight DECIMAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own weight logs"
  ON weight_log FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- GOALS
-- ============================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL,
  current_value DECIMAL NOT NULL DEFAULT 0,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own goals"
  ON goals FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- USER BADGES
-- ============================================
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB DEFAULT '{}'
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own badges"
  ON user_badges FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- EXERCISE ROTATION STATE
-- ============================================
CREATE TABLE exercise_rotation_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL,
  introduced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_performed_at TIMESTAMPTZ,
  rotation_status TEXT NOT NULL DEFAULT 'active',
  freshness_score DECIMAL NOT NULL DEFAULT 1.0,
  swap_suggested_at TIMESTAMPTZ,
  replacement_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL
);

ALTER TABLE exercise_rotation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own rotation state"
  ON exercise_rotation_state FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- USER SETTINGS
-- ============================================
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  unit_preference TEXT NOT NULL DEFAULT 'lbs',
  daily_calorie_target INTEGER DEFAULT 2500,
  protein_target_g DECIMAL DEFAULT 180,
  carbs_target_g DECIMAL DEFAULT 250,
  fats_target_g DECIMAL DEFAULT 70,
  tdee_estimate INTEGER,
  training_days_per_week INTEGER DEFAULT 4,
  preferred_split TEXT DEFAULT 'ppl',
  rotation_mode TEXT NOT NULL DEFAULT 'suggested',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own settings"
  ON user_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_exercises_muscle_group ON exercises(primary_muscle_group);
CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_sets_session ON workout_sets(session_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX idx_nutrition_log_user_date ON nutrition_log(user_id, date DESC);
CREATE INDEX idx_weight_log_user_date ON weight_log(user_id, date DESC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_exercise_clips_user ON exercise_clips(user_id);
CREATE INDEX idx_exercise_clips_exercise ON exercise_clips(exercise_id);
CREATE INDEX idx_exercise_rotation_user ON exercise_rotation_state(user_id, muscle_group);
```

**Step 2: Run schema in Supabase**

Go to Supabase Dashboard → SQL Editor → paste and run `supabase/schema.sql`.

Alternatively, if using Supabase CLI:

```bash
npx supabase db push
```

**Step 3: Verify tables exist**

In Supabase Dashboard → Table Editor, confirm all 12 tables are visible.

**Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add complete database schema with RLS policies"
```

---

### Task 1.5: Create TypeScript Types

**Files:**
- Create: `src/types/database.ts`
- Create: `src/types/index.ts`

**Step 1: Create database types**

Create `src/types/database.ts`:

```ts
export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "forearms";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "band"
  | "other";

export type MovementPattern =
  | "push"
  | "pull"
  | "hinge"
  | "squat"
  | "lunge"
  | "carry"
  | "isolation";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type SplitType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "custom";

export type TrainingStyle = "hypertrophy" | "strength" | "mixed";

export type SetType =
  | "working"
  | "warmup"
  | "dropset"
  | "failure"
  | "rest_pause"
  | "giant_set"
  | "century";

export type ClipType = "form" | "tip" | "motivation" | "workout";

export type GoalType =
  | "strength"
  | "body_comp"
  | "consistency"
  | "volume"
  | "nutrition"
  | "custom";

export type GoalStatus = "active" | "completed" | "abandoned";

export type RotationStatus = "active" | "resting" | "suggested_swap";

export type RotationMode = "manual" | "suggested" | "auto";

export type UnitPreference = "lbs" | "kg";

export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  primary_muscle_group: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment_type: EquipmentType;
  movement_pattern: MovementPattern;
  difficulty: Difficulty;
  instructions: string | null;
  tags: string[];
  source_credit: string | null;
  is_custom: boolean;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  split_type: SplitType;
  training_style: TrainingStyle;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  target_weight: number | null;
  sort_order: number;
  set_type: SetType;
  notes: string | null;
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id: string | null;
  started_at: string;
  ended_at: string | null;
  split_type: SplitType | null;
  training_style: TrainingStyle | null;
  notes: string | null;
  mood_energy: number | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  set_type: SetType;
  rpe_rir: number | null;
  is_pr: boolean;
  notes: string | null;
  logged_at: string;
  exercise?: Exercise;
}

export interface ExerciseClip {
  id: string;
  user_id: string;
  exercise_id: string | null;
  youtube_url: string;
  start_seconds: number;
  end_seconds: number;
  title: string;
  muscle_groups: MuscleGroup[];
  creator_name: string | null;
  clip_type: ClipType;
  thumbnail_url: string | null;
  stored_clip_path: string | null;
  is_downloaded: boolean;
  created_at: string;
}

export interface NutritionEntry {
  id: string;
  user_id: string;
  date: string;
  meal_name: string;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  quantity_note: string | null;
  created_at: string;
}

export interface NutritionFavorite {
  id: string;
  user_id: string;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  default_quantity: string | null;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  date: string;
  weight: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  type: GoalType;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  target_date: string | null;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_type: string;
  earned_at: string;
  context: Record<string, unknown>;
}

export interface ExerciseRotationState {
  id: string;
  user_id: string;
  exercise_id: string;
  muscle_group: MuscleGroup;
  introduced_at: string;
  last_performed_at: string | null;
  rotation_status: RotationStatus;
  freshness_score: number;
  swap_suggested_at: string | null;
  replacement_exercise_id: string | null;
}

export interface UserSettings {
  id: string;
  user_id: string;
  display_name: string | null;
  unit_preference: UnitPreference;
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fats_target_g: number;
  tdee_estimate: number | null;
  training_days_per_week: number;
  preferred_split: string;
  rotation_mode: RotationMode;
  updated_at: string;
}
```

**Step 2: Create barrel export**

Create `src/types/index.ts`:

```ts
export * from "./database";
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types for all database tables"
```

---

### Task 1.6: Authentication — Login Page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`

**Step 1: Create the login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">BuffNStuff</CardTitle>
          <CardDescription>
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary underline"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

**Step 2: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(origin);
}
```

**Step 3: Verify login page renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000/login` — should see the login form.

**Step 4: Commit**

```bash
git add src/app/login/ src/app/auth/
git commit -m "feat: add authentication login/signup page"
```

---

### Task 1.7: App Layout with Tab Navigation

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Create: `src/components/layout/bottom-nav.tsx`
- Create: `src/components/layout/sidebar-nav.tsx`
- Create: `src/components/layout/app-shell.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create the responsive app shell**

The app shell detects screen size: mobile gets bottom tabs, desktop gets a sidebar.

Create `src/components/layout/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Dumbbell, BookOpen, Apple, BarChart3 } from "lucide-react";

const tabs = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/exercises", label: "Exercises", icon: BookOpen },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950 md:hidden">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

Create `src/components/layout/sidebar-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Dumbbell, BookOpen, Apple, BarChart3, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/exercises", label: "Exercises", icon: BookOpen },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-zinc-800 md:bg-zinc-950">
      <div className="flex h-16 items-center border-b border-zinc-800 px-6">
        <h1 className="text-xl font-bold">BuffNStuff</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-zinc-800 text-primary"
                  : "text-muted-foreground hover:bg-zinc-900 hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-zinc-900 hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
```

Create `src/components/layout/app-shell.tsx`:

```tsx
import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <SidebarNav />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

**Step 2: Create the app route group layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

**Step 3: Move the home page into the app route group**

Create `src/app/(app)/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Welcome to BuffNStuff</p>
    </div>
  );
}
```

Update `src/app/page.tsx` to redirect:

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/");
}
```

Actually, since route groups don't add to the URL, `(app)/page.tsx` IS the root `/` page. So delete the original `src/app/page.tsx` content and just use the route group.

**Step 4: Update root layout**

Update `src/app/layout.tsx` to set dark mode and fonts:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BuffNStuff",
  description: "Track your workouts, nutrition, and progress",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**Step 5: Install lucide-react for icons**

```bash
npm install lucide-react
```

**Step 6: Verify the layout renders**

```bash
npm run dev
```

Desktop view should show sidebar, mobile view (resize browser) should show bottom tabs.

**Step 7: Commit**

```bash
git add src/components/layout/ src/app/
git commit -m "feat: add responsive app shell with sidebar nav and bottom tabs"
```

---

### Task 1.8: Create Placeholder Route Pages

**Files:**
- Create: `src/app/(app)/workout/page.tsx`
- Create: `src/app/(app)/exercises/page.tsx`
- Create: `src/app/(app)/nutrition/page.tsx`
- Create: `src/app/(app)/progress/page.tsx`
- Create: `src/app/(app)/settings/page.tsx`

**Step 1: Create all placeholder pages**

Each page follows the same pattern. Create each file:

`src/app/(app)/workout/page.tsx`:
```tsx
export default function WorkoutPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold">Workout</h1>
      <p className="mt-2 text-muted-foreground">Start or log a workout</p>
    </div>
  );
}
```

`src/app/(app)/exercises/page.tsx`:
```tsx
export default function ExercisesPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold">Exercise Library</h1>
      <p className="mt-2 text-muted-foreground">Browse exercises and clips</p>
    </div>
  );
}
```

`src/app/(app)/nutrition/page.tsx`:
```tsx
export default function NutritionPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold">Nutrition</h1>
      <p className="mt-2 text-muted-foreground">Track your daily macros</p>
    </div>
  );
}
```

`src/app/(app)/progress/page.tsx`:
```tsx
export default function ProgressPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold">Progress</h1>
      <p className="mt-2 text-muted-foreground">Analytics and goals</p>
    </div>
  );
}
```

`src/app/(app)/settings/page.tsx`:
```tsx
export default function SettingsPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">App preferences</p>
    </div>
  );
}
```

**Step 2: Verify all routes work**

```bash
npm run dev
```

Navigate to each tab — all should render their placeholder content.

**Step 3: Commit**

```bash
git add src/app/\(app\)/
git commit -m "feat: add placeholder pages for all main routes"
```

---

## Phase 2: Exercise Library

### Task 2.1: Seed Exercise Database

**Files:**
- Create: `src/lib/data/exercises-seed.ts`

**Step 1: Create the seed data file with 200+ exercises**

Create `src/lib/data/exercises-seed.ts` with a comprehensive exercise list. This is a large file — each exercise includes primary/secondary muscles, equipment, movement pattern, difficulty, instructions, and tags.

The file should export an array of exercise objects covering:
- **Chest** (20+ exercises): flat/incline/decline bench (barbell, dumbbell, smith), flyes (dumbbell, cable), push-ups, dips, pec deck, machine press
- **Back** (20+ exercises): pull-ups, chin-ups, lat pulldown, barbell/dumbbell rows, cable rows, t-bar row, face pulls, deadlift
- **Shoulders** (15+ exercises): overhead press (barbell, dumbbell), lateral raises (dumbbell, cable), front raises, reverse flyes, arnold press, upright rows
- **Biceps** (12+ exercises): barbell curl, dumbbell curl, hammer curl, preacher curl, incline curl, cable curl, concentration curl, spider curl
- **Triceps** (12+ exercises): tricep pushdown, overhead extension (cable, dumbbell), skull crushers, close-grip bench, dips, kickbacks
- **Quads** (12+ exercises): squat (barbell, goblet), leg press, leg extension, lunges, Bulgarian split squat, hack squat, front squat
- **Hamstrings** (10+ exercises): Romanian deadlift, leg curl (seated, lying), stiff-leg deadlift, good mornings, Nordic curls
- **Glutes** (10+ exercises): hip thrust, glute bridge, cable kickbacks, sumo deadlift, step-ups, clamshells
- **Calves** (6+ exercises): standing calf raise, seated calf raise, leg press calf raise, donkey calf raise
- **Core** (12+ exercises): plank, ab wheel, cable crunch, hanging leg raise, Russian twists, bicycle crunches, dead bugs, pallof press
- **Forearms** (6+ exercises): wrist curls, reverse wrist curls, farmer's carries, plate pinches

Tag notable exercises with source credits (e.g., "Humiston" for mechanical disadvantage variations, "Nippard" for lengthened partial variations).

```ts
import { type MuscleGroup, type EquipmentType, type MovementPattern, type Difficulty } from "@/types";

export interface ExerciseSeed {
  name: string;
  primary_muscle_group: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment_type: EquipmentType;
  movement_pattern: MovementPattern;
  difficulty: Difficulty;
  instructions: string;
  tags: string[];
  source_credit: string | null;
}

export const exercisesSeed: ExerciseSeed[] = [
  // ====== CHEST ======
  {
    name: "Flat Barbell Bench Press",
    primary_muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment_type: "barbell",
    movement_pattern: "push",
    difficulty: "intermediate",
    instructions: "Lie on flat bench, grip bar slightly wider than shoulder width, lower to mid-chest, press up.",
    tags: ["compound", "strength_staple"],
    source_credit: null,
  },
  {
    name: "Incline Barbell Bench Press",
    primary_muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment_type: "barbell",
    movement_pattern: "push",
    difficulty: "intermediate",
    instructions: "Set bench to 30-45 degrees. Lower bar to upper chest, press up.",
    tags: ["compound", "upper_chest"],
    source_credit: null,
  },
  {
    name: "Flat Dumbbell Press",
    primary_muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment_type: "dumbbell",
    movement_pattern: "push",
    difficulty: "beginner",
    instructions: "Lie on flat bench with dumbbells, press up, lower with control.",
    tags: ["compound", "unilateral"],
    source_credit: null,
  },
  {
    name: "Incline Dumbbell Press",
    primary_muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment_type: "dumbbell",
    movement_pattern: "push",
    difficulty: "beginner",
    instructions: "Set bench to 30-45 degrees. Press dumbbells up from upper chest.",
    tags: ["compound", "upper_chest", "unilateral"],
    source_credit: null,
  },
  {
    name: "Dumbbell Squeeze Press",
    primary_muscle_group: "chest",
    secondary_muscles: ["triceps"],
    equipment_type: "dumbbell",
    movement_pattern: "push",
    difficulty: "intermediate",
    instructions: "Press dumbbells together throughout the movement while pressing up and down.",
    tags: ["mechanical_disadvantage", "humiston_favorite"],
    source_credit: "Ryan Humiston",
  },
  // ... (200+ total exercises - full list generated during implementation)
  // The complete seed file will be generated with all exercises during implementation.
  // Pattern continues for all muscle groups listed above.
];
```

Note: The full 200+ exercise seed file is large. During implementation, generate the complete list following this pattern for all muscle groups documented in the design doc.

**Step 2: Create a seed script or Supabase SQL insert**

Create `supabase/seed-exercises.sql` — a SQL file that inserts all system exercises (user_id = NULL, is_custom = false).

**Step 3: Run the seed in Supabase**

Run the SQL in Supabase Dashboard → SQL Editor.

**Step 4: Commit**

```bash
git add src/lib/data/ supabase/seed-exercises.sql
git commit -m "feat: add exercise seed data (200+ exercises with muscle groups and tags)"
```

---

### Task 2.2: Exercise Library Data Layer

**Files:**
- Create: `src/lib/database/exercises.ts`

**Step 1: Create CRUD operations for exercises**

Create `src/lib/database/exercises.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import type { Exercise, MuscleGroup, EquipmentType } from "@/types";

export async function getExercises(filters?: {
  muscleGroup?: MuscleGroup;
  equipmentType?: EquipmentType;
  search?: string;
}): Promise<Exercise[]> {
  const supabase = createClient();
  let query = supabase
    .from("exercises")
    .select("*")
    .order("name");

  if (filters?.muscleGroup) {
    query = query.eq("primary_muscle_group", filters.muscleGroup);
  }
  if (filters?.equipmentType) {
    query = query.eq("equipment_type", filters.equipmentType);
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Exercise[];
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Exercise;
}

export async function getExerciseVariations(
  muscleGroup: MuscleGroup,
  excludeId?: string
): Promise<Record<EquipmentType, Exercise[]>> {
  const supabase = createClient();
  let query = supabase
    .from("exercises")
    .select("*")
    .eq("primary_muscle_group", muscleGroup)
    .order("name");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const grouped: Record<string, Exercise[]> = {};
  for (const exercise of data as Exercise[]) {
    if (!grouped[exercise.equipment_type]) {
      grouped[exercise.equipment_type] = [];
    }
    grouped[exercise.equipment_type].push(exercise);
  }

  return grouped as Record<EquipmentType, Exercise[]>;
}

export async function createExercise(
  exercise: Omit<Exercise, "id" | "created_at" | "is_custom" | "user_id">
): Promise<Exercise> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      ...exercise,
      user_id: user.id,
      is_custom: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Exercise;
}

export async function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, "id" | "created_at" | "user_id">>
): Promise<Exercise> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Exercise;
}

export async function deleteExercise(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/database/
git commit -m "feat: add exercise CRUD operations with filtering and variation lookup"
```

---

### Task 2.3: Exercise Library UI

**Files:**
- Modify: `src/app/(app)/exercises/page.tsx`
- Create: `src/components/exercises/exercise-list.tsx`
- Create: `src/components/exercises/exercise-card.tsx`
- Create: `src/components/exercises/exercise-filters.tsx`
- Create: `src/components/exercises/muscle-group-tabs.tsx`

**Step 1: Build the muscle group tabs component**

Create `src/components/exercises/muscle-group-tabs.tsx` — horizontal scrollable tabs showing each muscle group with an icon/emoji. Tapping a tab filters the exercise list.

**Step 2: Build the filter bar component**

Create `src/components/exercises/exercise-filters.tsx` — search input + equipment type dropdown filter.

**Step 3: Build the exercise card component**

Create `src/components/exercises/exercise-card.tsx` — shows exercise name, muscle group badge, equipment badge, and tags. Tappable to expand details (instructions, video clips, variations).

**Step 4: Build the exercise list component**

Create `src/components/exercises/exercise-list.tsx` — fetches exercises using the data layer, applies filters, renders exercise cards in a responsive grid.

**Step 5: Wire up the exercises page**

Update `src/app/(app)/exercises/page.tsx` to compose the muscle group tabs, filters, and exercise list.

**Step 6: Verify the page renders with data**

```bash
npm run dev
```

Navigate to `/exercises` — should show the exercise library with filtering.

**Step 7: Commit**

```bash
git add src/app/\(app\)/exercises/ src/components/exercises/
git commit -m "feat: add exercise library page with muscle group tabs and filters"
```

---

## Phase 3: Workout Core (Highest Priority)

### Task 3.1: Workout Data Layer

**Files:**
- Create: `src/lib/database/workouts.ts`
- Create: `src/lib/database/templates.ts`

**Step 1: Create workout session and set CRUD**

Create `src/lib/database/workouts.ts` with functions:
- `startWorkoutSession(templateId?)` — creates a new session with `started_at = now()`
- `endWorkoutSession(sessionId)` — sets `ended_at = now()`
- `logSet(sessionId, exerciseId, weight, reps, setType?, rpeRir?)` — inserts a workout_set
- `updateSet(setId, updates)` — updates weight/reps/notes
- `deleteSet(setId)` — removes a set
- `getSessionSets(sessionId)` — fetches all sets for a session with exercise details
- `getRecentSessions(limit)` — fetches recent sessions
- `getExerciseHistory(exerciseId, limit)` — fetches previous sets for an exercise (for progressive overload suggestions)
- `getLastSessionForExercise(exerciseId)` — gets the most recent session's sets for a specific exercise

**Step 2: Create template CRUD**

Create `src/lib/database/templates.ts` with functions:
- `getTemplates()` — fetch all user templates
- `getTemplateWithExercises(templateId)` — fetch template + its exercises
- `createTemplate(name, splitType, trainingStyle, exercises[])` — create template with exercises
- `updateTemplate(id, updates)` — update template metadata
- `deleteTemplate(id)` — delete template and its exercises
- `addExerciseToTemplate(templateId, exerciseId, targetSets, targetReps)` — add exercise
- `removeExerciseFromTemplate(templateExerciseId)` — remove exercise
- `reorderTemplateExercises(templateId, exerciseIds[])` — update sort_order

**Step 3: Commit**

```bash
git add src/lib/database/
git commit -m "feat: add workout session, set logging, and template CRUD operations"
```

---

### Task 3.2: Workout Logging UI — Quick Log Mode

**Files:**
- Create: `src/app/(app)/workout/active/page.tsx`
- Create: `src/components/workout/active-workout.tsx`
- Create: `src/components/workout/set-logger.tsx`
- Create: `src/components/workout/rest-timer.tsx`
- Create: `src/components/workout/exercise-set-card.tsx`

**Step 1: Build the set logger component**

Create `src/components/workout/set-logger.tsx` — the core logging widget:
- Displays exercise name at top
- Shows previous session's weight/reps as reference
- Large number inputs for weight and reps (easy to tap on phone)
- Set type selector (working, warmup, dropset, failure)
- Optional RPE/RIR slider
- "Log Set" button that saves and auto-increments set number
- Auto-starts rest timer after logging

**Step 2: Build the rest timer component**

Create `src/components/workout/rest-timer.tsx`:
- Countdown timer (configurable: 60s, 90s, 120s, 180s, 300s)
- Visual progress ring
- Plays sound/vibration when timer completes
- Can be dismissed or extended

**Step 3: Build the exercise set card**

Create `src/components/workout/exercise-set-card.tsx`:
- Shows exercise name and all logged sets in a compact table
- Each set row: set#, weight, reps, set type
- Color coding: green = PR, yellow = matched previous, red = below
- "Add Set" button at bottom

**Step 4: Build the active workout page**

Create `src/components/workout/active-workout.tsx`:
- Scrollable list of exercises from the template (or manually added)
- Each exercise renders an exercise-set-card
- "Add Exercise" button to add exercises from the library
- Workout duration timer at top
- "Finish Workout" button that ends the session

Wire up `src/app/(app)/workout/active/page.tsx` to render the active workout.

**Step 5: Verify workout logging works end-to-end**

```bash
npm run dev
```

Start a workout, log sets, verify data appears in Supabase.

**Step 6: Commit**

```bash
git add src/app/\(app\)/workout/ src/components/workout/
git commit -m "feat: add active workout logging with set logger, rest timer, and PR detection"
```

---

### Task 3.3: Workout Start Flow

**Files:**
- Modify: `src/app/(app)/workout/page.tsx`
- Create: `src/components/workout/workout-start.tsx`
- Create: `src/components/workout/template-picker.tsx`

**Step 1: Build the workout start page**

Update `src/app/(app)/workout/page.tsx`:
- "Start Workout" button (prominent, top of page)
- Two options: "From Template" or "Empty Workout"
- Template picker shows user's templates as cards
- Recent workout history below (last 10 sessions as cards)
- Toggle between Quick Log and Guided mode

**Step 2: Build template picker**

Create `src/components/workout/template-picker.tsx`:
- Grid of template cards showing name, split type, exercise count
- Tapping a template starts a new session with those exercises pre-loaded

**Step 3: Verify flow works**

Start from workout page → pick template → lands in active workout with exercises loaded.

**Step 4: Commit**

```bash
git add src/app/\(app\)/workout/ src/components/workout/
git commit -m "feat: add workout start flow with template picker"
```

---

### Task 3.4: Guided Mode Overlay

**Files:**
- Create: `src/components/workout/guided-overlay.tsx`
- Create: `src/lib/training/progressive-overload.ts`

**Step 1: Build the progressive overload suggestion engine**

Create `src/lib/training/progressive-overload.ts`:
- `getSuggestion(exerciseId, trainingStyle)` — looks up last session's sets for this exercise, calculates suggested weight/reps
- For hypertrophy: if all target reps hit last time → suggest +5 lbs (barbell) or +2.5 lbs (dumbbell)
- For strength: if target reps hit at target RPE → suggest +5-10 lbs with same rep target
- Returns: `{ lastWeight, lastReps, suggestedWeight, suggestedReps, message }`

**Step 2: Build the guided overlay**

Create `src/components/workout/guided-overlay.tsx`:
- Appears above the set logger when Guided Mode is active
- Shows: "Last time: 185 lbs x 8 — Try: 190 lbs x 8"
- Color-coded after logging: green (beat it), yellow (matched), red (below)
- Volume landmark indicator: "Week volume for chest: 16 sets (in MAV range)"

**Step 3: Commit**

```bash
git add src/components/workout/ src/lib/training/
git commit -m "feat: add guided mode with progressive overload suggestions"
```

---

### Task 3.5: Routine Builder

**Files:**
- Create: `src/app/(app)/workout/templates/page.tsx`
- Create: `src/app/(app)/workout/templates/new/page.tsx`
- Create: `src/app/(app)/workout/templates/[id]/page.tsx`
- Create: `src/components/workout/template-builder.tsx`
- Create: `src/components/workout/exercise-picker-dialog.tsx`
- Create: `src/lib/training/pairing-guidance.ts`

**Step 1: Build the muscle pairing guidance engine**

Create `src/lib/training/pairing-guidance.ts`:
- Contains all science-based pairing data from the design doc
- `getPairingTips(splitType, selectedMuscles[])` — returns relevant tips
- `getRecoveryWarning(muscleGroup, lastTrainedDate)` — checks if muscle has recovered
- `getVolumeCheck(muscleGroup, weeklySetCount)` — checks against MEV/MAV/MRV landmarks
- `getAntagonistPairs(muscleGroup)` — suggests superset pairings
- `getSuggestedExercises(muscleGroup, equipmentType?)` — suggests exercises for a given muscle

**Step 2: Build the exercise picker dialog**

Create `src/components/workout/exercise-picker-dialog.tsx`:
- Modal/dialog that shows the exercise library with filters
- Tap an exercise to add it to the template
- Shows equipment variation suggestions
- Shows pairing guidance inline

**Step 3: Build the template builder page**

Create `src/components/workout/template-builder.tsx`:
- Form: template name, split type, training style
- Drag-and-drop exercise list
- For each exercise: target sets, target reps, target weight inputs
- "Add Exercise" button opens the picker dialog
- Pairing tips panel shows contextual guidance based on selected exercises
- Recovery and volume warnings displayed inline
- Save/cancel buttons

Wire up the route pages to use the builder component (new page for creating, [id] page for editing).

**Step 4: Build the templates list page**

Update `src/app/(app)/workout/templates/page.tsx`:
- Grid of template cards
- "New Template" button
- Pre-built templates section (PPL, Upper/Lower, etc. from design doc)

**Step 5: Verify routine builder works end-to-end**

Create a template, add exercises, see pairing tips, save, then start a workout from it.

**Step 6: Commit**

```bash
git add src/app/\(app\)/workout/templates/ src/components/workout/ src/lib/training/
git commit -m "feat: add routine builder with exercise picker and muscle pairing guidance"
```

---

## Phase 4: Nutrition & Weight Tracking

### Task 4.1: Nutrition Data Layer

**Files:**
- Create: `src/lib/database/nutrition.ts`

**Step 1: Create nutrition CRUD**

Create `src/lib/database/nutrition.ts`:
- `getDailyLog(date)` — fetch all entries for a date
- `addNutritionEntry(entry)` — insert a food entry
- `updateNutritionEntry(id, updates)` — update an entry
- `deleteNutritionEntry(id)` — delete an entry
- `getDailyTotals(date)` — sum calories/protein/carbs/fats for a date
- `getFavorites()` — fetch favorite foods
- `addFavorite(food)` — save a favorite
- `deleteFavorite(id)` — remove a favorite

**Step 2: Commit**

```bash
git add src/lib/database/nutrition.ts
git commit -m "feat: add nutrition log CRUD operations"
```

---

### Task 4.2: Nutrition Tracking UI

**Files:**
- Modify: `src/app/(app)/nutrition/page.tsx`
- Create: `src/components/nutrition/daily-macros.tsx`
- Create: `src/components/nutrition/food-entry-form.tsx`
- Create: `src/components/nutrition/meal-section.tsx`
- Create: `src/components/nutrition/macro-progress-bars.tsx`
- Create: `src/components/nutrition/favorites-list.tsx`

**Step 1: Build macro progress bars component**

Create `src/components/nutrition/macro-progress-bars.tsx`:
- Four progress bars: Calories, Protein, Carbs, Fats
- Each shows current / target with percentage
- Protein bar is visually emphasized (most important for recomp)
- Color coding: green (on track), yellow (over 80%), red (over target)

**Step 2: Build food entry form**

Create `src/components/nutrition/food-entry-form.tsx`:
- Meal name selector (Breakfast, Lunch, Dinner, Snack, Post-workout, custom)
- Food item text input
- Calories, Protein, Carbs, Fats number inputs
- "Save as Favorite" checkbox
- Quick-add from favorites list
- Submit button

**Step 3: Build the daily macros page**

Compose the nutrition page:
- Date picker at top (navigate between days)
- Macro progress bars
- Meal sections grouped by meal name
- Each meal section shows food entries as cards
- Floating "Add Food" button
- Quick-add favorites section

**Step 4: Verify nutrition tracking works**

Log some food entries, check progress bars update, save a favorite, use quick-add.

**Step 5: Commit**

```bash
git add src/app/\(app\)/nutrition/ src/components/nutrition/
git commit -m "feat: add nutrition tracking page with macro progress bars and favorites"
```

---

### Task 4.3: Weight Tracking Data Layer & UI

**Files:**
- Create: `src/lib/database/weight.ts`
- Create: `src/components/progress/weight-tracker.tsx`
- Create: `src/components/progress/weight-chart.tsx`

**Step 1: Create weight log CRUD**

Create `src/lib/database/weight.ts`:
- `logWeight(date, weight)` — insert or upsert (one entry per day)
- `getWeightHistory(days)` — fetch weight entries for the last N days
- `getWeightTrend(days)` — compute 7-day moving average
- `getWeightChange(days)` — compute change over period

**Step 2: Build weight tracking components**

Create `src/components/progress/weight-tracker.tsx`:
- Quick entry: weight input + "Log Today" button
- Current weight display
- Change this week / this month

Create `src/components/progress/weight-chart.tsx`:
- Line chart (Recharts) showing daily weight + 7-day moving average trend line
- Date range selector (7d, 30d, 90d, 1y, All)

**Step 3: Commit**

```bash
git add src/lib/database/weight.ts src/components/progress/
git commit -m "feat: add weight tracking with trend chart and 7-day moving average"
```

---

## Phase 5: Dashboard & Analytics

### Task 5.1: Dashboard

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Create: `src/components/dashboard/today-workout.tsx`
- Create: `src/components/dashboard/weekly-summary.tsx`
- Create: `src/components/dashboard/active-goals.tsx`
- Create: `src/components/dashboard/streak-counter.tsx`
- Create: `src/components/dashboard/recent-prs.tsx`
- Create: `src/lib/database/stats.ts`

**Step 1: Create stats query functions**

Create `src/lib/database/stats.ts`:
- `getWeeklySummary()` — days trained, total volume, total sets this week
- `getCurrentStreak()` — count consecutive days with a workout session
- `getRecentPRs(days)` — fetch sets marked as `is_pr = true` in the last N days
- `getTodaysScheduledWorkout()` — check if a template is scheduled for today
- `getWeeklyVolumeByMuscle()` — total sets per muscle group this week

**Step 2: Build dashboard components**

Each component queries its own data and renders a card:
- `today-workout.tsx` — shows scheduled workout template or "No workout scheduled" with quick-start button
- `weekly-summary.tsx` — 3 stat cards: days trained, total volume (lbs), total sets
- `streak-counter.tsx` — fire emoji + streak count + "day streak" label
- `recent-prs.tsx` — list of recent PR sets with exercise name, weight, reps
- `active-goals.tsx` — progress bars for active goals (from Phase 6, can be placeholder for now)

**Step 3: Compose the dashboard page**

Update `src/app/(app)/page.tsx`:
- Greeting: "Let's get it, [name]" or time-based greeting
- Responsive grid layout: 2 columns on desktop, single column on mobile
- Components arranged: Today's Workout → Weekly Summary → Streak → Recent PRs → Active Goals

**Step 4: Commit**

```bash
git add src/app/\(app\)/page.tsx src/components/dashboard/ src/lib/database/stats.ts
git commit -m "feat: add dashboard with weekly summary, streak counter, and recent PRs"
```

---

### Task 5.2: Analytics / Progress Page

**Files:**
- Modify: `src/app/(app)/progress/page.tsx`
- Create: `src/components/progress/exercise-progression-chart.tsx`
- Create: `src/components/progress/volume-trends-chart.tsx`
- Create: `src/components/progress/frequency-heatmap.tsx`
- Create: `src/components/progress/muscle-balance-radar.tsx`
- Create: `src/lib/database/analytics.ts`

**Step 1: Create analytics query functions**

Create `src/lib/database/analytics.ts`:
- `getExerciseProgression(exerciseId, days)` — weight over time for a specific exercise
- `getVolumeByMuscleGroup(days)` — weekly volume per muscle group over time
- `getTrainingFrequency(days)` — which days had workouts, what muscle groups were hit
- `getMuscleGroupBalance()` — relative volume across all muscle groups (for radar chart)

**Step 2: Build chart components**

Using Recharts:
- `exercise-progression-chart.tsx` — line chart with exercise picker dropdown, shows weight progression
- `volume-trends-chart.tsx` — stacked bar chart, weekly volume by muscle group
- `frequency-heatmap.tsx` — calendar grid showing workout days color-coded by intensity
- `muscle-balance-radar.tsx` — radar/spider chart showing relative volume per muscle group

**Step 3: Compose the progress page**

Update `src/app/(app)/progress/page.tsx`:
- Tabs or sections: Charts | Weight | Goals
- Charts tab shows all analytics components
- Weight tab shows weight tracker and chart (from Phase 4)
- Goals tab will be wired in Phase 6

**Step 4: Commit**

```bash
git add src/app/\(app\)/progress/ src/components/progress/ src/lib/database/analytics.ts
git commit -m "feat: add analytics page with exercise progression, volume trends, and muscle balance charts"
```

---

## Phase 6: Goals & Gamification

### Task 6.1: Goals System

**Files:**
- Create: `src/lib/database/goals.ts`
- Create: `src/components/goals/goal-form.tsx`
- Create: `src/components/goals/goal-card.tsx`
- Create: `src/components/goals/goals-list.tsx`
- Create: `src/app/(app)/progress/goals/page.tsx`

**Step 1: Create goals CRUD and auto-tracking**

Create `src/lib/database/goals.ts`:
- `getActiveGoals()` — fetch goals with status = 'active'
- `getAllGoals()` — fetch all goals grouped by status
- `createGoal(goal)` — insert a new goal
- `updateGoalProgress(id, currentValue)` — update progress
- `completeGoal(id)` — mark as completed
- `abandonGoal(id)` — mark as abandoned
- `checkStrengthGoals(exerciseId, weight)` — auto-check if any strength goals were met by a new set
- `checkConsistencyGoals()` — count workouts this week and update consistency goals
- `checkNutritionGoals(date)` — check if protein/calorie targets were met

**Step 2: Build goal form**

Create `src/components/goals/goal-form.tsx`:
- Goal type selector (strength, body comp, consistency, volume, nutrition, custom)
- Dynamic fields based on type:
  - Strength: exercise picker + target weight
  - Body comp: target weight
  - Consistency: workouts per week target
  - Volume: muscle group + target set increase %
  - Nutrition: macro target + days per week
  - Custom: free text + optional numeric target
- Target date picker (optional)

**Step 3: Build goal card and list**

Create `src/components/goals/goal-card.tsx`:
- Progress bar showing current vs target
- Goal title and description
- Target date countdown
- Complete/abandon actions

Create `src/components/goals/goals-list.tsx`:
- Active goals section
- Completed goals section (collapsible)
- "New Goal" button

**Step 4: Commit**

```bash
git add src/lib/database/goals.ts src/components/goals/ src/app/\(app\)/progress/goals/
git commit -m "feat: add goals system with auto-tracking for strength, consistency, and nutrition goals"
```

---

### Task 6.2: Badges & Streaks

**Files:**
- Create: `src/lib/training/badges.ts`
- Create: `src/components/dashboard/badges-display.tsx`

**Step 1: Create badge evaluation engine**

Create `src/lib/training/badges.ts`:
- Define all badge types with criteria (from design doc):
  - Iron Streak (3/7/14/30/60/90 days)
  - PR Hunter (any new PR)
  - Volume King (new weekly volume record)
  - Consistency Crown (4+ workouts/week for a month)
  - Protein Perfect (7 consecutive days hitting protein target)
  - Century Club (100-rep set)
  - Plateau Breaker (beat a flagged plateau)
- `evaluateBadges(userId)` — check all criteria and award new badges
- `getUserBadges(userId)` — fetch earned badges
- Call `evaluateBadges` after each workout session ends and after daily nutrition logging

**Step 2: Build badges display**

Create `src/components/dashboard/badges-display.tsx`:
- Grid of badge icons
- Earned badges in color, unearned greyed out
- Tooltip with badge name and criteria
- Recent badge celebration animation (optional)

**Step 3: Add badge display to dashboard**

Add the badges component to the dashboard page.

**Step 4: Commit**

```bash
git add src/lib/training/badges.ts src/components/dashboard/badges-display.tsx
git commit -m "feat: add badge system with 7 badge types and dashboard display"
```

---

## Phase 7: YouTube Video Clipper

### Task 7.1: Video Clipper Data Layer

**Files:**
- Create: `src/lib/database/clips.ts`
- Create: `src/lib/youtube/utils.ts`

**Step 1: Create clip CRUD**

Create `src/lib/database/clips.ts`:
- `getClips(filters?)` — fetch clips with optional filters (muscleGroup, exerciseId, creatorName, clipType)
- `getClipsForExercise(exerciseId)` — fetch clips tagged to a specific exercise
- `createClip(clip)` — insert a new clip
- `updateClip(id, updates)` — update clip metadata
- `deleteClip(id)` — delete a clip

**Step 2: Create YouTube utility functions**

Create `src/lib/youtube/utils.ts`:
- `extractVideoId(url)` — parse YouTube URL to extract video ID (supports youtube.com/watch, youtu.be, youtube.com/shorts)
- `getThumbnailUrl(videoId)` — return YouTube thumbnail URL
- `formatSeconds(seconds)` — format seconds to MM:SS display
- `parseTimestamp(timestamp)` — parse "2:15" or "02:15" to seconds

**Step 3: Commit**

```bash
git add src/lib/database/clips.ts src/lib/youtube/
git commit -m "feat: add YouTube clip CRUD and URL parsing utilities"
```

---

### Task 7.2: Video Clipper UI

**Files:**
- Create: `src/app/(app)/exercises/clips/page.tsx`
- Create: `src/app/(app)/exercises/clips/new/page.tsx`
- Create: `src/components/clips/clip-creator.tsx`
- Create: `src/components/clips/youtube-player.tsx`
- Create: `src/components/clips/timeline-selector.tsx`
- Create: `src/components/clips/clip-card.tsx`
- Create: `src/components/clips/clips-gallery.tsx`

**Step 1: Build the YouTube player component**

Create `src/components/clips/youtube-player.tsx`:
- Loads YouTube IFrame Player API
- Renders video player with custom controls
- Exposes `seekTo(seconds)`, `getCurrentTime()`, `play()`, `pause()` methods
- Supports starting at a specific timestamp

**Step 2: Build the timeline selector component**

Create `src/components/clips/timeline-selector.tsx`:
- Horizontal bar representing the video duration
- Two draggable handles for start and end time
- Time display below each handle (MM:SS)
- "Set Start" and "Set End" buttons that capture current playback position
- Preview button that plays just the selected segment

**Step 3: Build the clip creator page**

Create `src/components/clips/clip-creator.tsx`:
- URL input field at top
- YouTube player loads when valid URL pasted
- Timeline selector below the player
- Metadata form:
  - Clip title (text input)
  - Muscle group multi-select
  - Exercise picker (optional — link to existing exercise)
  - Creator name (text input, with suggestions: "Ryan Humiston", "Jeff Nippard", etc.)
  - Clip type selector (form, tip, motivation, workout)
- Save options: "Save as Bookmark" (default) or "Download Clip" (future — when Edge Function ready)
- Save button

**Step 4: Build the clips gallery**

Create `src/components/clips/clips-gallery.tsx`:
- Grid of clip cards showing thumbnail, title, creator, duration
- Filter bar: muscle group, creator, clip type, search
- Each card plays the clip segment on tap (inline or in a modal)

Create `src/components/clips/clip-card.tsx`:
- Thumbnail from YouTube
- Title, creator badge, muscle group badges
- Duration label (e.g., "0:30")
- Play button overlay

**Step 5: Wire up routes**

- `src/app/(app)/exercises/clips/page.tsx` — renders clips gallery
- `src/app/(app)/exercises/clips/new/page.tsx` — renders clip creator

Add "Clips" sub-navigation within the Exercises section (tab or button).

**Step 6: Verify end-to-end clip workflow**

Paste a YouTube URL → set start/end times → name and tag the clip → save → see it in the gallery → tap to play the segment.

**Step 7: Commit**

```bash
git add src/app/\(app\)/exercises/clips/ src/components/clips/
git commit -m "feat: add YouTube video clipper with timeline selector and clips gallery"
```

---

### Task 7.3: Integrate Clips into Exercise Library

**Files:**
- Modify: `src/components/exercises/exercise-card.tsx`
- Create: `src/components/exercises/exercise-detail.tsx`

**Step 1: Build exercise detail view**

Create `src/components/exercises/exercise-detail.tsx`:
- Full exercise details (instructions, muscles, equipment)
- Associated video clips section (from clips database)
- Equipment variation suggestions
- "Add Clip" button that navigates to clip creator with exercise pre-selected
- Exercise history (recent sets logged for this exercise)

**Step 2: Update exercise card to show clip count**

Modify `src/components/exercises/exercise-card.tsx` to show a small badge if the exercise has associated clips (e.g., "3 clips" with a play icon).

**Step 3: Commit**

```bash
git add src/components/exercises/
git commit -m "feat: integrate video clips into exercise library with detail view"
```

---

## Phase 8: Training Intelligence

### Task 8.1: Spaced Repetition Engine

**Files:**
- Create: `src/lib/training/rotation-engine.ts`
- Create: `src/lib/database/rotation.ts`

**Step 1: Create rotation state database operations**

Create `src/lib/database/rotation.ts`:
- `getRotationState(userId, muscleGroup?)` — fetch current rotation state for all or specific muscle group
- `initializeRotation(exerciseId, muscleGroup)` — create initial rotation state when exercise is first used
- `updateRotationAfterWorkout(exerciseId)` — update `last_performed_at` and recalculate `freshness_score`
- `suggestSwap(exerciseId, replacementId)` — mark exercise as `suggested_swap`
- `acceptSwap(rotationId)` — swap the exercise (set old to 'resting', new to 'active')
- `dismissSwap(rotationId)` — reset rotation status to 'active', reset timer

**Step 2: Build the rotation engine**

Create `src/lib/training/rotation-engine.ts`:
- Implements a simplified FSRS-inspired algorithm:
  - `freshness_score` starts at 1.0 and decreases linearly over time
  - After 4 weeks: score drops below 0.5 → "getting stale" indicator
  - After 6 weeks: score drops below 0.25 → suggest swap
  - When an exercise is rested for 4+ weeks, its freshness resets to 1.0
- `calculateFreshness(introducedAt, lastPerformedAt)` — compute current freshness
- `getSwapSuggestions(userId)` — find all exercises due for rotation and suggest replacements
- `findReplacement(exerciseId)` — find a variation of the same muscle group with different equipment or angle that's currently in the 'resting' pool or hasn't been used recently

**Step 3: Commit**

```bash
git add src/lib/training/rotation-engine.ts src/lib/database/rotation.ts
git commit -m "feat: add spaced repetition exercise rotation engine"
```

---

### Task 8.2: Plateau Detection

**Files:**
- Create: `src/lib/training/plateau-detector.ts`

**Step 1: Build plateau detection**

Create `src/lib/training/plateau-detector.ts`:
- `detectPlateaus(userId)` — scan all exercises used in last 3 sessions
  - For each exercise, compare the best set (highest weight x reps) across sessions
  - If weight AND reps are identical for 2+ consecutive sessions → flag as plateau
  - If weight AND reps have decreased for 2+ sessions → flag as regression
- `getInterventions(exerciseId, plateauType)` — suggest specific actions:
  1. Deload recommendation: "Take a deload week — reduce volume by 50% for 1 week"
  2. Rep range change: "Switch from 8-10 reps to 12-15 reps for 2 weeks"
  3. Exercise swap: suggest a variation (from rotation engine)
  4. Technique change: "Try a different grip width" or "Slow down the eccentric to 3 seconds"
  5. Volume check: look up current weekly volume vs. MEV/MAV/MRV and suggest adjustment
- Returns structured data: `{ exerciseId, exerciseName, plateauType, sessionCount, interventions[] }`

**Step 2: Integrate plateau flags into workout UI**

When rendering exercise-set-card in the active workout, check if the exercise has been flagged as a plateau. If so, show a yellow/orange border and a small "Plateau" badge. Tapping the badge shows the intervention suggestions in a dialog.

**Step 3: Commit**

```bash
git add src/lib/training/plateau-detector.ts
git commit -m "feat: add plateau detection with science-based intervention suggestions"
```

---

### Task 8.3: Rotation & Intelligence UI

**Files:**
- Create: `src/components/training/rotation-suggestions.tsx`
- Create: `src/components/training/plateau-alerts.tsx`
- Create: `src/components/training/volume-landmarks.tsx`

**Step 1: Build rotation suggestions component**

Create `src/components/training/rotation-suggestions.tsx`:
- Card showing exercises due for rotation
- For each: current exercise → suggested replacement, with reasoning
- "Swap", "Dismiss", "Remind me later" actions
- Shows on dashboard and in the exercises page

**Step 2: Build plateau alerts component**

Create `src/components/training/plateau-alerts.tsx`:
- Alert cards for each detected plateau
- Shows: exercise name, how many sessions stalled, intervention suggestions as actionable buttons
- Dismissable

**Step 3: Build volume landmarks indicator**

Create `src/components/training/volume-landmarks.tsx`:
- Small widget showing per-muscle-group volume status
- Bar showing current weekly sets vs. MEV / MAV / MRV zones
- Color coding: blue (below MEV), green (in MAV), yellow (approaching MRV), red (over MRV)
- Used in workout active page and in routine builder

**Step 4: Add intelligence components to dashboard**

Add rotation suggestions and plateau alerts to the dashboard, below the existing widgets.

**Step 5: Commit**

```bash
git add src/components/training/
git commit -m "feat: add training intelligence UI — rotation suggestions, plateau alerts, volume landmarks"
```

---

## Phase 9: Settings

### Task 9.1: Settings Page

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `src/lib/database/settings.ts`
- Create: `src/components/settings/profile-settings.tsx`
- Create: `src/components/settings/training-settings.tsx`
- Create: `src/components/settings/nutrition-settings.tsx`
- Create: `src/components/settings/tdee-calculator.tsx`

**Step 1: Create settings CRUD**

Create `src/lib/database/settings.ts`:
- `getSettings()` — fetch or create default settings for current user
- `updateSettings(updates)` — update settings

**Step 2: Build settings sections**

- `profile-settings.tsx` — display name, unit preference (lbs/kg), sign out, delete account
- `training-settings.tsx` — preferred split, training days/week, rotation mode (manual/suggested/auto)
- `nutrition-settings.tsx` — calorie target, protein/carbs/fats targets
- `tdee-calculator.tsx` — Mifflin-St Jeor calculator: weight, height, age, activity level inputs → computed TDEE → "Use as calorie target" button

**Step 3: Compose settings page**

Update `src/app/(app)/settings/page.tsx` with all settings sections in a scrollable layout.

**Step 4: Commit**

```bash
git add src/app/\(app\)/settings/ src/lib/database/settings.ts src/components/settings/
git commit -m "feat: add settings page with profile, training, nutrition settings, and TDEE calculator"
```

---

## Phase 10: PWA & Offline Support

### Task 10.1: PWA Configuration

**Files:**
- Create: `public/manifest.json`
- Create: `src/app/manifest.ts`
- Create: `public/icons/` (app icons at various sizes)
- Modify: `src/app/layout.tsx`

**Step 1: Create web app manifest**

Create `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuffNStuff",
    short_name: "BuffNStuff",
    description: "Track your workouts, nutrition, and progress",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

**Step 2: Generate app icons**

Create simple placeholder icons at 192x192 and 512x512 in `public/icons/`.

**Step 3: Add manifest link to layout**

Update `src/app/layout.tsx` metadata:

```ts
export const metadata: Metadata = {
  title: "BuffNStuff",
  description: "Track your workouts, nutrition, and progress",
  manifest: "/manifest.webmanifest",
};
```

**Step 4: Commit**

```bash
git add public/icons/ src/app/manifest.ts
git commit -m "feat: add PWA manifest with app icons"
```

---

### Task 10.2: Service Worker & Offline Support

**Files:**
- Install: `serwist`, `@serwist/next`
- Create: `src/app/sw.ts`
- Modify: `next.config.ts`

**Step 1: Install Serwist**

```bash
npm install serwist @serwist/next
```

**Step 2: Configure Next.js for Serwist**

Update `next.config.ts` to wrap with Serwist's withSerwist plugin.

**Step 3: Create service worker**

Create `src/app/sw.ts`:
- Cache static assets (JS, CSS, images)
- Cache API responses with stale-while-revalidate strategy
- Enable offline page fallback

**Step 4: Commit**

```bash
git add src/app/sw.ts next.config.ts
git commit -m "feat: add service worker for offline support and asset caching"
```

---

### Task 10.3: Offline Workout Logging with Dexie.js

**Files:**
- Create: `src/lib/offline/db.ts`
- Create: `src/lib/offline/sync.ts`

**Step 1: Create Dexie offline database**

Create `src/lib/offline/db.ts`:

```ts
import Dexie, { type EntityTable } from "dexie";

interface PendingSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  set_type: string;
  rpe_rir: number | null;
  logged_at: string;
  synced: boolean;
}

interface PendingSession {
  id: string;
  template_id: string | null;
  started_at: string;
  ended_at: string | null;
  split_type: string | null;
  training_style: string | null;
  synced: boolean;
}

const db = new Dexie("BuffNStuffOffline") as Dexie & {
  pendingSets: EntityTable<PendingSet, "id">;
  pendingSessions: EntityTable<PendingSession, "id">;
};

db.version(1).stores({
  pendingSets: "id, session_id, synced",
  pendingSessions: "id, synced",
});

export { db };
export type { PendingSet, PendingSession };
```

**Step 2: Create sync engine**

Create `src/lib/offline/sync.ts`:
- `savePendingSet(set)` — save to IndexedDB
- `savePendingSession(session)` — save to IndexedDB
- `syncPendingData()` — push all unsynced data to Supabase, mark as synced
- `getPendingSyncCount()` — count of unsynced items
- Auto-sync when coming back online via `navigator.onLine` event listener

**Step 3: Update workout logging to use offline-first pattern**

In the active workout components, save sets to both Supabase (if online) and IndexedDB (always). On page load, check for unsynced data and sync.

**Step 4: Commit**

```bash
git add src/lib/offline/
git commit -m "feat: add offline-first workout logging with IndexedDB and background sync"
```

---

## Phase 11: Capacitor (Optional Native Wrapper)

### Task 11.1: Add Capacitor

**Files:**
- Install: `@capacitor/core`, `@capacitor/cli`
- Create: `capacitor.config.ts`

**Step 1: Install Capacitor**

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init BuffNStuff com.buffnstuff.app --web-dir=out
```

**Step 2: Configure for Next.js static export**

Update `next.config.ts` to add `output: 'export'` for Capacitor builds (can be conditional via env variable).

Update `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.buffnstuff.app",
  appName: "BuffNStuff",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
```

**Step 3: Add Android platform**

```bash
npx cap add android
```

**Step 4: Build and sync**

```bash
npm run build
npx cap sync android
```

**Step 5: Commit**

```bash
git add capacitor.config.ts android/
git commit -m "feat: add Capacitor with Android platform for native wrapper"
```

---

## Phase 12: Pre-Built Workout Templates

### Task 12.1: Seed Pre-Built Templates

**Files:**
- Create: `src/lib/data/templates-seed.ts`

**Step 1: Create template seed data**

Create `src/lib/data/templates-seed.ts` with the 7 pre-built templates from the design doc:

1. **PPL Classic** — 6-day Push/Pull/Legs
2. **PPL Humiston** — Push/Pull/Legs with giant sets, century sets, drop sets by week
3. **Upper/Lower** — 4-day split (Nippard style)
4. **PPLUL Hybrid** — 5-day (rated 9/10 for hypertrophy)
5. **Full Body 3x** — 3-day efficient (Ethier style)
6. **Strength Focus** — 4-day compound-heavy, 1-5 rep range
7. **Bro Split** — 5-day body part split

Each template includes its full exercise list with target sets/reps/weight.

**Step 2: Create a "clone template" flow**

When a user selects a pre-built template, clone it into their personal templates so they can customize it.

**Step 3: Commit**

```bash
git add src/lib/data/templates-seed.ts
git commit -m "feat: add 7 pre-built workout templates (PPL, Upper/Lower, PPLUL, etc.)"
```

---

## Phase 13: Polish & Testing

### Task 13.1: End-to-End Testing

**Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install
```

**Step 2: Write core E2E tests**

Create tests for critical flows:
- Login/signup
- Start workout from template → log sets → finish workout
- Add food entry → see macro progress update
- Log weight → see chart update
- Create exercise clip → see it in gallery
- Create a goal → see it on dashboard

**Step 3: Run tests**

```bash
npx playwright test
```

**Step 4: Commit**

```bash
git add e2e/ playwright.config.ts
git commit -m "test: add E2E tests for core workout, nutrition, and clip flows"
```

---

### Task 13.2: Responsive Polish

**Step 1: Audit all pages on mobile viewport (375px)**

Walk through every page and fix any layout issues:
- Touch targets minimum 44x44px
- Number inputs are large enough for thumb tapping
- No horizontal overflow
- Bottom nav doesn't overlap content

**Step 2: Audit all pages on desktop viewport (1440px+)**

- Sidebar nav works correctly
- Multi-column layouts utilize space
- Charts are readable at full width

**Step 3: Commit**

```bash
git commit -m "fix: responsive layout polish for mobile and desktop viewports"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| **Phase 1** | 1.1 – 1.8 | Project scaffold, Supabase, auth, layout, routes |
| **Phase 2** | 2.1 – 2.3 | Exercise library with seed data, filters, UI |
| **Phase 3** | 3.1 – 3.5 | Workout logging (core), templates, guided mode, routine builder |
| **Phase 4** | 4.1 – 4.3 | Nutrition tracking, weight logging |
| **Phase 5** | 5.1 – 5.2 | Dashboard, analytics charts |
| **Phase 6** | 6.1 – 6.2 | Goals system, badges & streaks |
| **Phase 7** | 7.1 – 7.3 | YouTube video clipper |
| **Phase 8** | 8.1 – 8.3 | Spaced repetition, plateau detection, intelligence UI |
| **Phase 9** | 9.1 | Settings page with TDEE calculator |
| **Phase 10** | 10.1 – 10.3 | PWA manifest, service worker, offline logging |
| **Phase 11** | 11.1 | Capacitor native Android wrapper |
| **Phase 12** | 12.1 | Pre-built workout templates |
| **Phase 13** | 13.1 – 13.2 | E2E testing, responsive polish |

**Total: 13 phases, ~30 tasks, ~100+ steps**

**Critical path for MVP:** Phase 1 → Phase 2 → Phase 3 → Phase 5.1 (dashboard)
Everything else can be layered on incrementally after the core workout logging loop works.

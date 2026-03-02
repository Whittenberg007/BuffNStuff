# Phase 16: AI Coach & Insights — Design

## Overview

An AI-powered coaching system built on the Claude API that provides personalized training advice, natural language food logging, smart workout recommendations, and conversational coaching. The AI has full context about the user's training history, nutrition, goals, and progress — leveraging all data accumulated across Phases 1–15.

## Architecture

**Server-side API route** (`/api/ai/chat`) handles all Claude API calls — keeps the API key secure and never exposes it to the client. The route streams responses back to the client using the Web Streams API, giving users a real-time typing effect.

**Tool use pattern:** Claude is given tools that can query the user's data (recent workouts, nutrition logs, PRs, goals, plateaus, volume landmarks). When the user asks a question like "How's my chest progress?", Claude calls the relevant tools, gets structured data back, and synthesizes a personalized response.

**Natural language food logging:** A dedicated tool (`log_food`) lets Claude parse "I had a chicken breast with rice and broccoli" into structured nutrition entries and insert them directly into Supabase. This is the killer UX feature — replaces manual food search entirely.

## Four AI Features

### 1. AI Chat Coach (main feature)

- Full-screen chat interface at `/coach`
- Streaming responses with typing indicator
- System prompt includes: user's settings (goals, experience level, units), recent workout summary, current program status, nutrition targets
- Tools available to Claude:
  - `get_recent_workouts` — last 7 days of sessions with sets
  - `get_nutrition_summary` — today's and this week's macros vs targets
  - `get_exercise_history` — progression data for a specific exercise
  - `get_active_program` — current program enrollment and progress
  - `get_plateau_status` — any flagged plateaus
  - `get_goals` — active goals and their progress
  - `log_food` — parse natural language food and insert nutrition entry
  - `create_workout_suggestion` — generate a workout plan for today

### 2. Quick Food Log (natural language)

- Floating text input on the nutrition page
- User types "2 eggs, toast with butter, coffee with milk"
- Claude extracts: items, estimated portions, macros
- Shows a confirmation card with parsed items before saving
- One tap to confirm and log all items

### 3. Dashboard Insight Cards

- Small AI-generated insight cards on the dashboard
- Generated server-side on page load (cached for the day)
- Examples: "Your bench press has stalled for 2 weeks — try adding paused reps" or "You've been under-eating protein by 30g on rest days"
- Uses Haiku model for cost efficiency
- No streaming needed — pre-computed insights

### 4. Post-Workout Summary

- After ending a workout session, show an AI-generated summary
- "Great session! You hit a new PR on squats. Your total volume was 12,400 lbs, up 8% from last week."
- Generated from the session data, shown once after session completion

## Data Flow

```
Client (chat UI)
  → POST /api/ai/chat (streaming)
    → Authenticate user via Supabase session
    → Build system prompt with user context
    → Call Claude API with tools
    → Claude may call tools (get_recent_workouts, etc.)
    → Execute tool: query Supabase with user's ID, return data
    → Claude synthesizes response
    → Stream text back to client
  ← ReadableStream of text chunks
```

```
Client (insights)
  → GET /api/ai/insights
    → Authenticate user
    → Gather user stats (streaks, plateaus, nutrition gaps)
    → Call Claude Haiku with stats summary
    → Return 2-3 insight strings
  ← JSON array of insight objects
```

```
Client (food log)
  → POST /api/ai/chat with tool_choice: log_food
    → Claude parses natural language
    → Returns structured food items with macros
  ← JSON with parsed food items
  → User confirms
  → Client calls existing nutrition logging functions
```

## Tech Stack

- `@anthropic-ai/sdk` — Claude TypeScript SDK (new dependency)
- `zod` — Already in project, used for tool input validation with `betaZodTool`
- Next.js Route Handler (`app/api/ai/chat/route.ts`) — Server-side streaming
- `ReadableStream` + `TextEncoder` — Stream responses to client
- React state + `fetch` with streaming reader — Client-side consumption
- Claude Sonnet for chat, Claude Haiku for insights (cost optimization)

## Security

- API key stored as `ANTHROPIC_API_KEY` environment variable (server-only)
- All Claude calls server-side only (Route Handlers)
- User authentication checked via Supabase session cookie in every request
- Rate limiting: simple in-memory counter (10 messages/minute per user)
- Tool calls only access the authenticated user's own data (user ID from session)
- No conversation history persisted server-side

## New Files

| File | Purpose |
|------|---------|
| `src/app/api/ai/chat/route.ts` | Streaming chat API route |
| `src/app/api/ai/insights/route.ts` | Dashboard insights API route |
| `src/lib/ai/tools.ts` | Tool definitions with Supabase data queries |
| `src/lib/ai/system-prompt.ts` | System prompt builder from user context |
| `src/lib/ai/food-parser.ts` | Food logging tool + confirmation logic |
| `src/components/ai/chat-interface.tsx` | Full chat UI with streaming display |
| `src/components/ai/chat-message.tsx` | Individual message bubble component |
| `src/components/ai/quick-food-log.tsx` | Natural language food input component |
| `src/components/ai/insight-card.tsx` | Dashboard insight card component |
| `src/components/ai/post-workout-summary.tsx` | Post-workout AI summary component |
| `src/app/(app)/coach/page.tsx` | Coach chat page |

## Modified Files

| File | Change |
|------|--------|
| `src/app/(app)/page.tsx` | Add InsightCards to dashboard |
| `src/app/(app)/nutrition/page.tsx` | Add QuickFoodLog input |
| `src/components/workout/active-workout.tsx` | Show PostWorkoutSummary after session end |
| `src/components/layout/sidebar-nav.tsx` | Add Coach nav item |
| `src/components/layout/bottom-nav.tsx` | Add Coach nav item |
| `src/types/database.ts` | Add AI-related types (ChatMessage, AIInsight) |

## Out of Scope (YAGNI)

- No conversation history persistence (messages live in React state only)
- No custom model selection (hardcoded Haiku for insights, Sonnet for chat)
- No image analysis or photo food logging
- No voice input
- No AI-generated training programs (13 pre-built programs already exist)
- No embeddings or RAG — direct tool-use is sufficient for our data size
- No premium/paid tier gating — all users get AI features

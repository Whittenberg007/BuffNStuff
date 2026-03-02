# Phase 17: Workout Calendar & Smart Scheduling — Design

## Goal

Add a visual calendar that shows completed workouts and upcoming program days projected onto real dates, letting users see their training history at a glance and know what's coming next.

## Architecture

- **No new database tables** — uses existing `workout_sessions` for history and `ProgramEnrollment.program.schedule` for upcoming days
- **Two new pages**: `/calendar` (month/week views) and `/calendar/day/[date]` (day detail)
- **New lib module**: `src/lib/calendar.ts` — pure functions to project program schedules onto absolute dates
- **New data function**: `getSessionsForRange(startDate, endDate)` in `src/lib/database/workouts.ts`
- **Nav update**: Calendar icon added to bottom nav and sidebar nav

## Program Day Projection Logic

The core algorithm in `lib/calendar.ts`:

1. Fetch active enrollment → get `started_at`, `current_week`, `current_day_index`, `progress_log`
2. Get the program's `schedule.weeks` array
3. For each week in the program, compute the real-world start date:
   - Week 1 starts on the Monday of or after `enrollment.started_at`
   - Each subsequent week is +7 days
4. For each `ProgramDay` in that week, map `day_of_week` (1=Mon..7=Sun) to a real date
5. Check `progress_log` to mark days as completed vs upcoming
6. For cycling programs (`repeat_from_week`), project forward from the repeat point

Export: `projectProgramDays(enrollment): Array<{ date: string; day: ProgramDay; status: 'completed' | 'upcoming' | 'today' }>`

## Pages

### `/calendar` — Calendar Page

Two view modes via segmented control toggle:

**Month View:**
- Standard 7-column grid (Mon–Sun)
- Day cells show:
  - Filled colored dot for completed workouts (color by split type)
  - Outlined dot for scheduled-but-not-done program days
  - Today: highlighted ring
- Tap any day → navigate to `/calendar/day/[date]`
- Header: `< Month Year >` with prev/next arrows
- Footer: month summary stats (sessions, volume, training days)

**Split type color mapping:**
- Push → blue
- Pull → green
- Legs → orange
- Upper → purple
- Lower → amber
- Full body → pink
- Custom/other → gray

**Week View:**
- Horizontal 7-day strip for current week
- Taller day cards showing more detail:
  - Completed: split label, volume, set count
  - Scheduled: program day label, exercise count
  - Rest day: "Rest" label
- Swipe/arrow navigation between weeks

### `/calendar/day/[date]` — Day Detail Page

Shows all activity for a given date:

**Completed workout card:**
- Duration, exercises list, total sets, total volume
- PRs hit (if any)
- Split type badge
- "View Full Session" link (future: could link to detailed session page)

**Scheduled program day card:**
- Program name + week/day label
- Exercises with prescribed sets/reps/RPE
- "Start This Workout" button → creates session from program template, navigates to active workout

**Empty day:**
- "No workout" message
- "Start Workout" button → navigates to `/workout`

Multiple sessions on the same day render as stacked cards.

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| `MonthCalendar` | `src/components/calendar/month-calendar.tsx` | Full month grid view |
| `WeekStrip` | `src/components/calendar/week-strip.tsx` | Horizontal 7-day strip |
| `DayCell` | `src/components/calendar/day-cell.tsx` | Individual day in month grid |
| `DayDetailCard` | `src/components/calendar/day-detail-card.tsx` | Session or scheduled day summary |
| `CalendarNav` | `src/components/calendar/calendar-nav.tsx` | Month/week toggle + navigation |

## Data Functions

### New in `src/lib/database/workouts.ts`:
- `getSessionsForRange(startDate: string, endDate: string)` — fetch completed sessions with basic stats (id, started_at, ended_at, split_type, notes) plus aggregated set count and volume

### New in `src/lib/calendar.ts`:
- `projectProgramDays(enrollment: ProgramEnrollment)` — map program schedule to real dates
- `getSplitColor(splitType: SplitType | null)` — consistent color mapping
- `getMonthRange(year: number, month: number)` — start/end dates for a calendar month (including overflow days)

## Navigation

Add Calendar (CalendarDays icon from lucide-react) to:
- Bottom nav: between Exercises and Nutrition
- Sidebar nav: between Exercises and Nutrition

## Error Handling

- No active enrollment → calendar shows only completed workouts, no scheduled dots
- Failed data fetch → show empty calendar with error toast
- Future dates with no program → blank cells (no scheduled indicator)

## Performance

- Fetch sessions for visible month only (not all history)
- Memoize program day projections (recompute only when enrollment changes)
- Use `date-fns` for all date arithmetic (already in deps)

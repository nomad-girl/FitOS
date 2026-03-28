# FitOS — Product Specification

## What is FitOS?

A personal training planning & self-coaching system. NOT a workout tracker, NOT a generic fitness app. FitOS is the **brain** — it plans, analyzes, and helps you make better decisions. Hevy is the **muscle** — it tracks execution in the gym.

```
FitOS (plan, analyze, decide) + Hevy (execute, track)
```

**Single user.** No multi-client. No social. Built for structured self-coaching.

---

## Core Philosophy

The system works in layers:

```
Mesocycle (strategy)
  → Weekly Plan (structure)
    → Training Execution (reality, via Hevy)
      → Weekly Check-in (evaluation)
        → Weekly Score (quantified assessment)
          → Weekly Decision (coaching)
            → Insights & Adjustments (intelligence)
```

The app doesn't just store information. It helps **interpret** what's happening.

---

## App Structure & Navigation

### Web (>768px): Sidebar navigation
### Mobile (<768px): Bottom tab bar

| Tab | Name | Purpose |
|-----|------|---------|
| **Plan** | Plan | HOME. Dashboard + meso + trends + phase health + insights |
| **Train** | Train | Current week sessions, Hevy sync, plan vs actual |
| **Check-in** | Check-in | Weekly self-assessment → Weekly Score → Decisions |
| **Journal** | Journal | Decision history timeline + past phases |
| **Profile** | Profile | Stats, settings, Hevy config, goals |

### Key Navigation Principle
**Plan is the hub.** Everything important is visible from Plan. You shouldn't need to dig to understand your current state.

---

## Screen-by-Screen Specification

### 1. Plan (Home)

**Purpose:** Single glance at everything that matters this week.

**Components (top to bottom):**

1. **Live Week Dashboard** (purple gradient card)
   - Weekly Score ring (0-100, calculated from 4 pillars)
   - 4 pillar breakdown: Training %, Nutrition %, Steps %, Sleep %
   - Quick gap indicators: "Glutes: 8/14", "Steps: 82%", "Weight: ↓0.4kg"
   - No old/completed phases here — just the NOW

2. **Active Mesocycle Card** (compact, clickable → detail)
   - Name, badges (Active, Cut/Build), frequency, focus muscles
   - Chevron to enter detail view

3. **Trends** (2-column grid, 6 cards)
   - Weight (with delta)
   - Waist (with delta)
   - Adherence (%)
   - Steps (% of goal)
   - Sleep (% of goal)
   - Weekly Score (number + label)

4. **Phase Health** (card with green/yellow/red border)
   - AI analysis text: "On Track" / "Warning" / "Consider ending"
   - Exit Criteria monitor:
     - Performance declining 3+ weeks → counter
     - Energy ≤2 for 2+ weeks → counter
     - Hunger ≥4 for 3+ weeks → counter
     - Weight stall 2+ weeks → counter
   - Rule: When 2+ criteria triggered → AI suggests ending/pausing phase

5. **Insights** (insight cards with severity)
   - Action (red border) — must address
   - Warning (yellow border) — should consider
   - Info (green border) — on track
   - Each has: title, explanation, suggestion, Apply/Dismiss buttons

### 2. Plan → Mesocycle Detail

**Accessed by:** tapping active meso card on Plan home

**Components:**
1. **Back button** → Plan home
2. **Meso metadata:** Goal, Calories target, Protein target
3. **Week selector:** W1-W6 pills (template week is W1, cloned for others)
4. **Sessions list** (clickable cards):
   - Session name (Day A: Fuerza)
   - Total sets count
   - Exercise list preview
   - Click → Session Editor
5. **Weekly Volume Dashboard:**
   - Each muscle group: bar with current fill + target line
   - Colors: Green (within ±2 of target), Yellow (3-4 off), Red (5+ off)
   - Muscles: Glutes, Back, Quads, Hamstrings, Chest, Shoulders, Biceps, Triceps, Core
6. **Movement Patterns:**
   - Squat, Hinge, H. Push, H. Pull, V. Push, V. Pull
   - Bar chart with set counts

### 3. Plan → Session Editor

**Accessed by:** tapping a session card in meso detail

**Components:**
1. **Back button** → Meso detail
2. **Header:** session name, exercise count, total sets
3. **Exercise list** (ordered, draggable):
   - Icon, name, muscle + pattern, RPE range
   - Sets × rep range
4. **+ Add Exercise button** → opens exercise modal
5. **Session Volume Impact** (sticky):
   - Chips showing contribution: "Glutes +7", "Quads +4", etc.
   - Updates in real-time as exercises added/removed
6. **Warning banner** if gaps remain:
   - "Glutes still 6 sets short of weekly target"

### 4. Exercise Modal (Add Exercise)

**Accessed by:** "+ Add Exercise" in session editor

**Components:**
1. Search input
2. Filters: Muscle, Pattern, Equipment
3. **Suggested section** (AI-powered):
   - Exercises that would fill current volume gaps
   - Shows impact: "Would add ~3 glute sets"
4. **All exercises** alphabetical list
   - Name, muscle group, pattern
   - "+" button to add

### 5. Train

**Purpose:** See execution status for current week. Sync with Hevy.

**Components:**
1. **Sync bar:** Hevy connection status, last sync time, Sync Now button
2. **Session cards** (for each planned session):
   - Status icon: ✅ done, ⚠️ partial, ⬜ pending
   - Session name, date, duration, volume
   - Adherence: sets completed / planned (color coded)
   - Click → Comparison view
3. **Weekly Adherence bar:**
   - Progress bar with percentage
   - "72 of 74 sets" · "Excellent"
4. **Volume Executed vs Planned:**
   - Same bar chart format as planning, but showing actual vs planned

### 6. Train → Plan vs Actual Comparison

**Accessed by:** tapping a completed session in Train

**Components:**
1. Table: Exercise | Plan | Actual | Status
2. Matched exercises show: planned sets×reps vs actual sets×reps@weight
3. Skipped exercises highlighted in red
4. **Volume Impact** banner: "Hamstrings: -3 sets (Lying Leg Curl skipped)"

### 7. Check-in

**Purpose:** Weekly self-assessment that feeds the intelligence layer.

**Sections (card-based, clean):**

1. **Body**
   - Weight (kg) with delta from last week
   - Waist (cm) with delta from last week
   - Side by side layout

2. **How You Feel**
   - Energy: 1-5 scale (Exhausted → Great)
   - Hunger: 1-5 scale (None → Starving)
   - Performance: ↓ Declining | ↔ Stable | ↑ Improving
   - Horizontal button selectors (not dots)

3. **Nutrition (weekly avg/day)**
   - Calories input + target display
   - Protein (g), Carbs (g), Fats (g) — 3-column
   - Each shows goal underneath
   - **Nutrition Adherence** auto-calculated: avg vs target → percentage
   - Displayed in green success banner

4. **Activity & Recovery**
   - Avg Daily Steps input + goal + progress bar
   - Avg Sleep (hrs) input + goal + progress bar
   - Side by side layout

5. **Notes**
   - Free text area

6. **Weekly Score** (dark card, auto-calculated)
   - Ring chart with score (0-100)
   - Label: "Great week!" / "Room to improve" / etc.
   - 4 pillar breakdown with mini progress bars:
     - Training: sets adherence %
     - Nutrition: adherence %
     - Steps: % of goal
     - Sleep: % of goal
   - **AI suggestion** about weakest pillar:
     - "Steps are your weakest pillar (82%). Try adding a 15-min walk after lunch."

7. **Action buttons:**
   - "Save & Continue to Decisions" (primary) → Decision screen
   - "Save Only" (ghost) → saves without decision

### 8. Check-in → Weekly Decision

**Accessed by:** "Save & Continue to Decisions" after check-in

**Purpose:** Explicit coaching decisions logged with reasoning. This is what turns the check-in into real coaching.

**Components:**

1. **AI Recommendation** (gradient card):
   - Contextual analysis of this week's data
   - Bold key conclusion
   - Specific suggestion

2. **Decision Chips** (toggleable, multi-select):
   - **Volume:** Keep as is | + Glute volume | - Total volume | Swap exercises | Add deload
   - **Nutrition:** Keep calories | - Calories | + Calories | Adjust macros
   - **Phase:** Continue | Extend | End early | Deload week

3. **Decision Notes:** "Why?" textarea
   - This builds the decision history
   - Critical for looking back and understanding what worked

4. **Log Decision button**

### 9. Journal

**Purpose:** Your coaching diary. Decision history + past phases.

**Components:**

1. **Decision History** (timeline):
   - Each entry: Week #, date, decision chips (colored tags), notes, context snapshot (weight, waist, energy, adherence)
   - Current week at top (active indicator)
   - Past weeks below (faded)
   - Past meso decisions included (with outcome notes)

2. **Past Phases** (cards):
   - Phase name, type badge, dates
   - Summary stats: weight change, adherence %, check-in count
   - Faded opacity to indicate completed

### 10. Profile

**Components:**
1. Avatar, name, training since
2. Stats grid: Weight, Waist, Days/week
3. Settings:
   - Hevy Integration (connection status, API key config)
   - Volume Targets (MEV/MAV/MRV per muscle, customizable)
   - Nutrition Goals (calories, macros, step goal, sleep goal)
   - Exercise Database (count, manage)
4. Notes (free text)

---

## Data Model

```
Profile (singleton)
├── name: string
├── weight: number
├── waist: number
├── training_days_per_week: number
├── calorie_target: number
├── protein_target: number
├── carbs_target: number
├── fats_target: number
├── step_goal: number (default 10000)
├── sleep_goal: number (default 7.5)
├── notes: text

Mesocycle
├── id
├── name: string
├── goal: enum [cut, maintain, build, custom]
├── status: enum [draft, active, completed, abandoned]
├── duration_weeks: number
├── start_date: date
├── focus_muscles: string[]
├── frequency: number (days/week)
├── calorie_target: number (optional, overrides profile)
├── protein_target: number (optional)
├── carbs_target: number (optional)
├── fats_target: number (optional)
├── notes: text
├── exit_criteria: json (customizable thresholds)
│
├── has many → Week
│   ├── week_number: number
│   ├── weekly_score: number (0-100, calculated)
│   │
│   ├── has many → PlannedSession
│   │   ├── label: string ("Day A: Fuerza")
│   │   ├── order: number
│   │   │
│   │   ├── has many → PlannedExercise
│   │   │   ├── exercise_id: fk
│   │   │   ├── sets: number
│   │   │   ├── rep_range_low: number
│   │   │   ├── rep_range_high: number
│   │   │   ├── target_rpe: number (optional)
│   │   │   ├── rest_seconds: number
│   │   │   ├── notes: text
│   │   │   └── order: number
│   │   │
│   │   └── has one → ExecutedSession (nullable, from Hevy)
│   │       ├── hevy_workout_id: string
│   │       ├── date: datetime
│   │       ├── duration_minutes: number
│   │       ├── total_volume_kg: number
│   │       │
│   │       └── has many → ExecutedExercise
│   │           ├── exercise_id: fk
│   │           ├── planned_exercise_id: fk (nullable)
│   │           └── has many → ExecutedSet
│   │               ├── weight: number
│   │               ├── reps: number
│   │               └── rpe: number (optional)
│   │
│   ├── has one → CheckIn (nullable)
│   │   ├── avg_weight: number
│   │   ├── waist: number
│   │   ├── energy: number (1-5)
│   │   ├── hunger: number (1-5)
│   │   ├── performance_trend: enum [declining, stable, improving]
│   │   ├── avg_calories: number
│   │   ├── avg_protein: number
│   │   ├── avg_carbs: number
│   │   ├── avg_fats: number
│   │   ├── nutrition_adherence: number (%, calculated)
│   │   ├── avg_steps: number
│   │   ├── avg_sleep_hours: number
│   │   ├── training_adherence: number (%, calculated from Hevy)
│   │   ├── weekly_score: number (0-100, calculated)
│   │   ├── notes: text
│   │   └── created_at: datetime
│   │
│   └── has one → Decision (nullable)
│       ├── volume_decisions: string[] (chips selected)
│       ├── nutrition_decisions: string[]
│       ├── phase_decisions: string[]
│       ├── notes: text (the "why")
│       ├── ai_recommendation: text
│       ├── outcome: text (filled later)
│       └── created_at: datetime

Exercise
├── id
├── name: string
├── primary_muscle: enum
├── secondary_muscles: enum[]
├── movement_pattern: enum [squat, hinge, horizontal_push, horizontal_pull,
│   vertical_push, vertical_pull, isolation, core, carry, lunge]
├── equipment: enum [barbell, dumbbell, cable, machine, bodyweight, band]
├── hevy_template_id: string (nullable, for matching)
├── source: enum [built_in, hevy_import, custom]

ExerciseMapping (for Hevy sync)
├── hevy_exercise_name: string
├── exercise_id: fk
├── confirmed: boolean

Insight (generated per week)
├── id
├── week_id: fk
├── type: enum [volume_gap, overload_warning, balance_issue,
│   progress_flag, adherence_note, phase_suggestion, score_tip]
├── severity: enum [info, warning, action]
├── title: string
├── body: text
├── suggestion: text
├── dismissed: boolean
├── applied: boolean
├── created_at: datetime
```

---

## Weekly Score Calculation

The Weekly Score (0-100) combines 4 pillars:

```
weekly_score = (
  training_adherence * 0.35 +
  nutrition_adherence * 0.30 +
  steps_adherence * 0.15 +
  sleep_adherence * 0.20
)

Where:
  training_adherence = executed_sets / planned_sets * 100
  nutrition_adherence = avg(
    clamp(avg_calories / calorie_target, 0, 1),
    clamp(avg_protein / protein_target, 0, 1),
    clamp(avg_carbs / carbs_target, 0, 1),
    clamp(avg_fats / fats_target, 0, 1)
  ) * 100
  steps_adherence = clamp(avg_steps / step_goal, 0, 1) * 100
  sleep_adherence = clamp(avg_sleep / sleep_goal, 0, 1) * 100

Labels:
  90-100: "Excellent week"
  80-89: "Great week"
  70-79: "Good week"
  60-69: "Room to improve"
  <60: "Tough week"
```

Weights are opinionated: Training matters most during a structured program, nutrition is critical for body composition, sleep for recovery, steps for NEAT/general health.

---

## Volume Calculation Logic

Each exercise contributes sets to muscle groups:

```
For each PlannedExercise:
  primary_muscle: sets × 1.0
  secondary_muscles: sets × 0.5 each
```

### Volume Targets (defaults, adjustable per mesocycle)

| Muscle | MEV | MAV Low | MAV High | MRV |
|--------|-----|---------|----------|-----|
| Glutes | 8 | 12 | 16 | 20 |
| Quads | 8 | 12 | 16 | 20 |
| Hamstrings | 6 | 10 | 14 | 18 |
| Back | 10 | 14 | 18 | 22 |
| Chest | 6 | 10 | 14 | 18 |
| Shoulders | 6 | 10 | 16 | 22 |
| Biceps | 4 | 8 | 12 | 16 |
| Triceps | 4 | 8 | 12 | 16 |
| Core | 4 | 6 | 10 | 14 |
| Calves | 4 | 8 | 12 | 16 |

**Focus muscles** (declared in mesocycle) → target pushed to MAV High.
**Non-focus muscles** → target at MAV Low.

### Color coding
- Green: within ±2 sets of target
- Yellow: 3-4 sets off
- Red: 5+ sets off OR exceeding MRV

### Overload warnings
- Any muscle > MRV
- Single session >8 sets for one muscle
- Total session >28 sets (fatigue)

---

## Hevy Integration

### Architecture
```
FitOS ←(read only)← Hevy Personal API ($6/mo)
```

FitOS does NOT push routines to Hevy (requires Coach API @ $49/mo). Instead:
- User copies routine to Hevy manually once per mesocycle (3 routines every 4-6 weeks)
- FitOS pulls completed workouts automatically via API

### API Details
- Auth: API key (from Hevy account settings)
- Pull workouts: `GET /v1/workouts?updated_since={timestamp}`
- Pull exercises: `GET /v1/exercise_templates`
- Rate limit: 5 requests / 10 seconds
- No webhooks — manual "Sync Now" button

### Exercise Matching
1. First sync: pull all Hevy exercise templates
2. Fuzzy match against FitOS exercise database
3. User confirms/corrects mappings
4. Store in ExerciseMapping table
5. Future syncs are automatic

### Plan vs Execution Comparison
```
For each PlannedSession:
  Match to ExecutedSession by date + label
  For each PlannedExercise:
    Find matching ExecutedExercise
    Compare: sets completed, reps within range, RPE
    Flag: skipped, extra, load changes
  Calculate:
    session_adherence = executed_sets / planned_sets
    volume_delta per muscle group
```

---

## Analysis & Suggestion Engine

### Rule Engine (V1)

**Volume rules:**
| Trigger | Severity | Suggestion |
|---------|----------|------------|
| planned < MEV for focus muscle | Action | "Add X sets" |
| planned < MAV for focus muscle | Warning | "Consider adding sets" |
| planned > MRV | Action | "Reduce volume, recovery at risk" |
| push:pull ratio > 1.5 or < 0.67 | Warning | "Pattern imbalance" |

**Adherence rules:**
| Trigger | Severity |
|---------|----------|
| <80% weekly sets | Warning |
| Session missed entirely | Action |
| Same exercise skipped 2+ weeks | Info ("consider replacing") |

**Progress rules:**
| Trigger | Severity |
|---------|----------|
| No weight change 2+ weeks (during cut) | Warning |
| Weight loss >1%/week | Warning |
| Performance declining 2+ weeks | Warning |
| Energy ≤2 for 2+ weeks | Action |

**Phase exit rules:**
| Trigger | Suggestion |
|---------|------------|
| 2+ exit criteria triggered | "Consider ending phase" |
| All metrics on track | "Keep going, no changes" |
| Duration reached + goals met | "Phase complete" |
| 3+ weeks no progress | "Consider adjusting" |

**Weekly Score rules:**
| Trigger | Suggestion |
|---------|------------|
| Weakest pillar identified | Contextual tip to improve it |
| Score declining 2+ weeks | "Overall compliance dropping" |
| Score consistently >90 | "Excellent consistency" |

### AI Layer (V2)
- Takes structured rule outputs
- Generates natural language explanations
- Can look across multiple weeks for trends
- Answers follow-up questions
- Is NOT the decision engine — rules are. AI is the explanation layer.

---

## Phase Planning (To Design)

Still needs design:
- Where to CREATE a new mesocycle (settings? plan tab?)
- How to CLOSE/END a mesocycle
- Exit criteria configuration per mesocycle
- Transition flow: end phase → review → start new phase
- Template reuse across mesocycles

---

## MVP Scope

### V1 — Build This

| Module | Scope |
|--------|-------|
| Profile | Weight, waist, goals (calories, macros, steps, sleep), notes |
| Mesocycle | Full CRUD, status management, focus muscles |
| Training Planner | Session editor, exercise assignment, live volume dashboard |
| Exercise DB | ~150 pre-loaded, muscle/pattern classification |
| Volume Logic | Auto-calc, MEV/MAV/MRV, color feedback |
| Check-in | Full form: body, feel, nutrition, activity, notes |
| Weekly Score | 4-pillar calculation, labels, suggestions |
| Weekly Decision | AI recommendation, decision chips, notes, history |
| Hevy Sync | Pull workouts via API, exercise matching |
| Plan vs Actual | Comparison view per session |
| Insights | Rule-based engine |
| Phase Health | Exit criteria monitoring |
| Journal | Decision timeline + past phases |
| Web Sidebar | Desktop navigation |

### V2 — Next
- AI-powered explanations and natural language insights
- Progressive overload suggestions (auto weight/rep increases)
- Exercise gap-fill recommendations (smart "Add Exercise")
- Trend charts (weight, volume, score over mesocycle)
- Session templates (reuse across mesocycles)
- Phase creation/closure wizard

### V3 — Later
- Photo progress in check-ins
- Deload auto-planning
- Export mesocycle as PDF
- Mobile native app (React Native)
- Fitbit/Apple Health integration for steps/sleep (auto)

---

## Tech Stack (Recommended)

- **Next.js 15** (App Router) — web-first
- **SQLite via Turso** or **Supabase** — simple, single user
- **Tailwind CSS** — matches prototype aesthetic
- **shadcn/ui** — polished components
- **Recharts** — for charts/trends
- **No auth in V1** — single user, simple password or local

---

## Design Principles

1. **Plan is home.** One screen to know your status.
2. **Data flows up.** Hevy → Check-in → Score → Decision → Insight.
3. **Decisions are explicit.** Not just "I changed something" — but what, when, and why.
4. **Intelligence explains.** The AI tells you WHY, not just what to do.
5. **Weekly rhythm.** The app is designed for one focused session per week, not daily fiddling.
6. **Clean, minimal, bright.** Soft animations, generous whitespace, clear hierarchy.

---

## Current Prototype

**Location:** `/prototype/index.html`
**Server:** `python3 -m http.server 3000 -d prototype`
**Status:** Interactive prototype with mock data (Natali's actual training data)

### Screens implemented:
- [x] Plan home (dashboard + trends + phase health + insights)
- [x] Mesocycle detail (sessions + volume + patterns)
- [x] Session editor (exercises + volume impact)
- [x] Exercise modal (search + suggestions)
- [x] Train (sessions + adherence + volume executed)
- [x] Plan vs Actual comparison
- [x] Check-in (body + feel + nutrition + activity + weekly score)
- [x] Weekly Decision (AI rec + chips + notes)
- [x] Journal (decision history + past phases)
- [x] Profile (stats + settings)
- [x] Web sidebar navigation
- [x] Mobile bottom tab navigation

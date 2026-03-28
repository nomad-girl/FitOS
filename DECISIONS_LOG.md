# FitOS — Decision Log

Chronological record of product decisions made during design.

---

## 2026-03-27 — Initial Design Session

### Decision 1: FitOS + Hevy (Option A)
**What:** FitOS is the brain (plan, analyze, decide). Hevy is the muscle (execute, track in gym).
**Why:** Hevy's logging UX is great and already used. No point rebuilding it. Every completed workout auto-syncs to FitOS for analysis.
**Trade-off:** User copies routine to Hevy manually once per mesocycle (~every 4-6 weeks). Acceptable.

### Decision 2: Hevy Personal API, NOT Coach API
**What:** Use Hevy Pro ($6/mo) for read-only API access. NOT Hevy Coach ($49/mo).
**Why:** Coach API allows pushing routines TO Hevy but costs $49/mo — defeats the purpose of building FitOS. Personal API lets us pull completed workouts, which is the critical path.
**Implication:** Cannot programmatically push routines to Hevy. Manual copy once per meso.

### Decision 3: Plan tab is the main hub
**What:** Moved Trends, Phase Health, and Insights from a separate tab INTO the Plan tab.
**Why:** Plan is the most important screen. User should see everything at a glance without switching tabs. The previous Insights tab was splitting attention.

### Decision 4: Old phases removed from Plan home
**What:** Past/completed mesocycles moved to Journal tab. Plan home only shows current state.
**Why:** Past phases are irrelevant to daily use. They clutter the most important screen. Journal is the right place for historical data.

### Decision 5: Insights tab → Journal tab
**What:** Renamed and repurposed. Journal now holds Decision History + Past Phases.
**Why:** "Insights" was redundant since insights moved to Plan. "Journal" better describes the coaching diary function — what you decided, when, and why.

### Decision 6: Weekly Decision as explicit coaching step
**What:** After check-in, user explicitly selects decisions (chips) and writes WHY.
**Why:** Without explicit decisions, the check-in is just data collection. The decision step converts it into coaching. The "why" field builds a searchable history of what worked.

### Decision 7: Decision History with context
**What:** Each decision entry stores: decisions made, reasoning, AND the context (weight, waist, energy, adherence) at the time.
**Why:** Looking back at "I increased glute volume" is useless without knowing the context. Was I losing weight? Was adherence high? Context makes the history actionable.

### Decision 8: Phase exit criteria (Definition of Done)
**What:** Each mesocycle has configurable exit criteria. AI monitors them weekly and suggests ending/extending.
**Why:** Without exit criteria, phases either run too long (inertia) or end arbitrarily. The system should proactively tell you "hey, you're fatigued, hungry, and stalling — consider ending this cut."

### Decision 9: Nutrition tracking via manual averages
**What:** User inputs weekly average calories and macros (from their existing tracking app). FitOS calculates adherence vs targets.
**Why:** NOT building a full meal logging system. User already tracks in another app. Just need the weekly aggregates for analysis. "Nutrition Compliance" renamed to "Nutrition Adherence" — clearer.

### Decision 10: Daily steps tracking (manual input)
**What:** User inputs average daily steps from Fitbit/phone. Goal configurable.
**Why:** NEAT (non-exercise activity) is critical for fat loss. Steps are the simplest proxy. Manual input from Fitbit is fine for V1.

### Decision 11: Sleep tracking (manual input)
**What:** Average hours of sleep per night, with configurable goal.
**Why:** Recovery is a pillar. Sleep directly affects performance, hunger, and energy. Same manual input model as steps.

### Decision 12: Weekly Score (composite metric)
**What:** Single 0-100 score combining Training (35%), Nutrition (30%), Steps (15%), Sleep (20%).
**Why:** Gives a quick "how was my week" number. The breakdown shows which pillar needs attention. The AI suggests improvements for the weakest pillar.
**Weights rationale:** Training highest because it's a training app. Nutrition critical for body composition. Sleep for recovery. Steps for general health/NEAT.

### Decision 13: Web-first with sidebar navigation
**What:** Sidebar on desktop (>768px), bottom tabs on mobile (<768px).
**Why:** Training planning benefits from screen real estate. The planner and volume dashboard work much better with horizontal space. Mobile is secondary for planning (primary for execution in Hevy).

### Decision 14: Check-in redesign with card sections
**What:** Check-in form split into distinct card sections: Body, How You Feel, Nutrition, Activity & Recovery, Notes, Weekly Score.
**Why:** Previous design was a long form. Cards create visual breathing room and make each section feel like a distinct step. The Weekly Score card at the bottom feels like a "reward" after completing the check-in.

---

## 2026-03-27 — Second Design Session (Refinement)

### Decision 15: Consolidate to 5 tabs
**What:** Reduce from 7 tabs to 5. Phases moves inside Plan (sub-tab). Check-in becomes a flow launched from Home.
**Why:** 7 tabs is too many for mobile bottom nav. Phases is conceptually part of planning. Check-in is a weekly action, not a permanent screen.
**New structure:** Home, Plan, Progress, Journal, Learn.

### Decision 16: Macro targets — both % and grams
**What:** User can set macros as percentages OR absolute grams. If one is set, the other auto-calculates.
**Why:** Some people think in percentages (40/30/30), others in grams (120g protein). Supporting both is easy and removes friction.

### Decision 17: Volume targets (MEV/MAV/MRV) per phase
**What:** Volume targets are configured during phase setup wizard, per muscle group.
**Why:** Volume needs change per phase (cut vs. build). Setting them at phase creation ensures intentional programming.

### Decision 18: Progressive overload as suggestions
**What:** System analyzes Hevy data and suggests weight/rep increases as badges in the session editor. User decides whether to accept.
**Rules:** RPE ≤8.5 + all reps completed → suggest +2.5kg or +1 rep. RPE 9.5+ → suggest maintain. Missed reps → suggest maintain/reduce.
**Why:** Automates the coach's job of saying "you're ready for more" without removing user agency.

### Decision 19: AI-powered weekly analysis (Claude API)
**What:** Use Claude API for the weekly check-in analysis instead of hardcoded rules.
**Why:** More intelligent, personalized, and flexible than rule-based. Can incorporate past decisions, user's training history, and personal context. Cost: ~$0.01 per analysis.
**Context file:** User can maintain a personal "coach context" file with training history, preferences, injuries, goals — fed to Claude for better analysis.

### Decision 20: Multi-device sync with auth
**What:** Supabase handles auth (email/magic link) + real-time sync across devices.
**Why:** User needs to see same data on phone and computer. Supabase's real-time subscriptions make this nearly free.
**Cost:** $0 (Supabase free tier).

### Decision 21: Tech stack finalized
**What:** Next.js 15 + Supabase (PostgreSQL + Auth) + Vercel + Tailwind + shadcn/ui + Claude API.
**Why:** Maximum simplicity, zero cost at scale of 1 user, excellent DX, all free tiers.
**Monthly cost:** $0-3 (only Claude API usage for weekly analysis).

### Decision 22: Learn tab — knowledge base
**What:** Dedicated section for saving fitness resources (videos, articles, book notes, personal notes) tagged by exercise and topic.
**Why:** Learning is a core part of self-coaching. Having resources linked to specific exercises creates a personal training wiki.

### Decision 23: Exercise add UX
**What:** Clicking an exercise in the library adds it to the bottom of the current session. Drag & drop to reorder.
**Why:** Simple, predictable. Matches Hevy Coach behavior.

---

## Open Questions (resolved)

1. ~~Phase creation flow~~ → **Wizard modal from Plan tab** (Decision 15)
2. ~~Phase closure flow~~ → **End Phase modal with reason + notes** (already in prototype)
3. ~~Exit criteria configuration~~ → **Per phase, in phase creation wizard** (Decision 17)
4. **Hevy exercise matching UX:** Still open — to design in build phase
5. ~~Volume target customization~~ → **Phase setup wizard with presets** (Decision 17)
6. ~~Macro % vs grams~~ → **Both, auto-convert** (Decision 16)
7. ~~Progressive overload~~ → **AI suggestions as badges** (Decision 18)

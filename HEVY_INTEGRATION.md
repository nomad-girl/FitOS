# FitOS — Hevy Integration Spec

## Architecture

```
FitOS ←── READ ONLY ──← Hevy Personal API (Pro, ~$6/mo)
```

FitOS does NOT write to Hevy. No Coach API ($49/mo).

## What We Pull

### Workouts
- **Endpoint:** `GET /v1/workouts?updated_since={ISO timestamp}`
- **Data:** exercise name, sets (weight, reps, RPE), date, duration, total volume
- **Frequency:** Manual "Sync Now" button (no webhooks available)
- **Rate limit:** 5 requests / 10 seconds

### Exercise Templates
- **Endpoint:** `GET /v1/exercise_templates`
- **Data:** exercise name, category, equipment type
- **Used for:** building the exercise mapping table

## Authentication
- API key based (no OAuth)
- Generated from Hevy account settings → Developer/API section
- Passed as header: `api-key: {key}` or `x-api-key: {key}`
- Stored securely in FitOS settings

## Exercise Matching Flow

### First Sync
1. Pull all exercise templates from Hevy
2. For each Hevy exercise, attempt matching:
   - **Exact match:** Hevy name === FitOS name
   - **Fuzzy match:** normalized strings (e.g. "Barbell Hip Thrust" ↔ "Hip Thrust (Barbell)")
   - **Unmatched:** flagged for user to classify
3. User reviews and confirms/corrects all mappings
4. Mappings stored in `exercise_mappings` table

### Subsequent Syncs
- New exercises from Hevy checked against existing mappings
- Only new/unknown exercises require user confirmation
- Mappings are permanent once confirmed

## Workout → ExecutedSession Mapping

```
For each synced Hevy workout:
  1. Match to a PlannedSession by:
     - Date (same day or ±1 day)
     - Session label similarity (if Hevy workout title matches)
     - Exercise overlap (which planned session has the most matching exercises)
  2. For each exercise in the workout:
     - Match to PlannedExercise via exercise_mapping
     - Store as ExecutedExercise with all sets
  3. Calculate session adherence:
     - executed_sets / planned_sets
     - per-muscle volume delta
```

## Sync States
- **Connected:** API key valid, syncs working
- **Disconnected:** No API key configured
- **Error:** API key invalid or rate limited
- **Syncing:** Currently fetching data

## Data We DON'T Get from Hevy
- Nutrition data (tracked in separate app, entered manually)
- Body measurements (entered manually in check-in)
- Steps / sleep (from Fitbit, entered manually)
- RPE (Hevy supports it, but only if user logs it in Hevy)

## Future: Hevy Coach API (if ever)
If user decides to pay for Coach ($49/mo), we could:
- `POST /v1/routines` → push planned sessions to Hevy
- `POST /v1/exercise_templates` → create custom exercises
- Eliminate manual routine copying entirely

This is V3+ territory. Not in current scope.

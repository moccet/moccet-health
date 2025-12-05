# FORGE MCP IMPLEMENTATION PLAN

**Status:** Ready for Implementation
**Priority:** HIGH
**Estimated Effort:** 3-4 days (leveraging Sage infrastructure)
**Based on:** Completed Sage MCP Implementation

---

## EXECUTIVE SUMMARY

Forge is the **training-focused counterpart** to Sage (nutrition-focused). While Sage optimizes nutrition timing and stress management, Forge optimizes **training protocols, workout programming, and performance nutrition** based on wearable data, recovery metrics, and training goals.

**Key Difference:**
- **Sage:** "What and when should I eat?" → Nutrition-first with training support
- **Forge:** "How should I train and fuel performance?" → Training-first with nutrition support

**Leverage Factor:** ~70% of Sage MCP infrastructure can be reused for Forge, significantly reducing implementation time.

---

## ARCHITECTURE OVERVIEW

### Shared Infrastructure (Already Built ✅)
- Token management system
- MCP sync service
- Ecosystem data fetcher
- Base inference modules (stress, sleep, meal timing)

### Forge-Specific Components (To Build 🔨)
- Training plan inference (advanced)
- Performance nutrition optimizer
- Recovery protocol calculator
- Workout programming engine
- Forge-specific prompt builder

---

# PHASE 1: FORGE DATA INFRASTRUCTURE

**Priority:** HIGH
**Effort:** 0.5 days
**Dependencies:** None (uses existing token manager)

## 1.1 Database Schema Updates

### File: `/supabase/migrations/007_forge_enhancements.sql`

```sql
-- Add Forge-specific columns to integration_tokens table (if needed)
-- Currently tokens table is already provider-agnostic, so minimal changes

-- Add Forge training data table
CREATE TABLE IF NOT EXISTS forge_training_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('strava', 'fitbit', 'whoop', 'garmin', 'polar', 'apple_health')),

  -- Workout data (JSONB for flexibility)
  workouts JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Training metrics
  weekly_volume INTEGER, -- Total minutes per week
  avg_workout_duration INTEGER, -- Minutes
  workout_frequency INTEGER, -- Days per week
  intensity_distribution JSONB, -- { low: 20, moderate: 50, high: 30 }

  -- Performance metrics
  performance_trends JSONB, -- { strength: 'improving', endurance: 'stable', ... }
  pr_history JSONB, -- Personal records

  -- Recovery metrics
  recovery_score JSONB, -- { avg: 75, trend: 'improving' }
  hrv_trends JSONB,
  resting_hr_trends JSONB,

  -- Data period
  data_period_start DATE,
  data_period_end DATE,
  data_points_analyzed INTEGER,

  -- Metadata
  sync_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_forge_training_email ON forge_training_data(email);
CREATE INDEX idx_forge_training_provider ON forge_training_data(provider);
CREATE INDEX idx_forge_training_email_provider ON forge_training_data(email, provider);
CREATE INDEX idx_forge_training_sync_date ON forge_training_data(sync_date);

-- GIN indexes for JSONB queries
CREATE INDEX idx_forge_training_workouts ON forge_training_data USING GIN (workouts);
CREATE INDEX idx_forge_training_performance ON forge_training_data USING GIN (performance_trends);

-- Add Forge workout patterns table (similar to behavioral_patterns for Sage)
CREATE TABLE IF NOT EXISTS forge_workout_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('strava', 'fitbit', 'whoop', 'garmin', 'polar', 'apple_health', 'manual')),

  -- Pattern analysis (JSONB for flexibility)
  patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "trainingLoad": { "weekly": 450, "trend": "increasing", "status": "optimal" },
  --   "workoutDistribution": { "strength": 3, "cardio": 2, "hiit": 1, "flexibility": 1 },
  --   "recoveryPatterns": { "avgRecovery": 75, "adequateRecovery": true },
  --   "performanceTrends": { "strength": "improving", "endurance": "stable" },
  --   "optimalTrainingTimes": ["06:00-07:00", "17:00-19:00"]
  -- }

  -- Metrics (JSONB for flexibility)
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "trainingScore": 85,
  --   "recoveryScore": 72,
  --   "performanceScore": 78,
  --   "overtrainingRisk": "low"
  -- }

  -- Data period
  data_period_start DATE,
  data_period_end DATE,
  data_points_analyzed INTEGER,

  -- Metadata
  sync_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_forge_workout_patterns_email ON forge_workout_patterns(email);
CREATE INDEX idx_forge_workout_patterns_source ON forge_workout_patterns(source);
CREATE INDEX idx_forge_workout_patterns_email_source ON forge_workout_patterns(email, source);
CREATE INDEX idx_forge_workout_patterns_sync_date ON forge_workout_patterns(sync_date);

-- GIN indexes for JSONB queries
CREATE INDEX idx_forge_workout_patterns_patterns ON forge_workout_patterns USING GIN (patterns);
CREATE INDEX idx_forge_workout_patterns_metrics ON forge_workout_patterns USING GIN (metrics);

-- Add RLS policies
ALTER TABLE forge_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_workout_patterns ENABLE ROW LEVEL SECURITY;

-- Policies for forge_training_data
CREATE POLICY "Users can view their own training data"
  ON forge_training_data FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert their own training data"
  ON forge_training_data FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update their own training data"
  ON forge_training_data FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

-- Policies for forge_workout_patterns
CREATE POLICY "Users can view their own workout patterns"
  ON forge_workout_patterns FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert their own workout patterns"
  ON forge_workout_patterns FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update their own workout patterns"
  ON forge_workout_patterns FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);
```

### Checklist:
- [ ] Create migration file
- [ ] Test migration on development database
- [ ] Verify RLS policies work correctly
- [ ] Document table structure in schema docs

---

# PHASE 2: FORGE DATA FETCHING ENDPOINTS

**Priority:** HIGH
**Effort:** 1.5 days
**Dependencies:** Phase 1, Existing token-manager

## 2.1 Strava Data Fetching

### File: `/app/api/strava/fetch-data/route.ts` (NEW)

**Purpose:** Fetch workout activities from Strava and analyze training patterns

**Checklist:**
- [ ] **Strava API Integration**
  - [ ] Get athlete activities (past 30 days)
  - [ ] Fetch activity details (type, duration, distance, heart rate zones)
  - [ ] Extract workout splits and laps
  - [ ] Get athlete stats (recent runs, rides, swims)

- [ ] **Training Pattern Analysis**
  - [ ] Calculate weekly training volume (total minutes)
  - [ ] Determine workout frequency (days per week)
  - [ ] Categorize workout types (run, bike, swim, strength, other)
  - [ ] Analyze intensity distribution (heart rate zones if available)
  - [ ] Identify preferred training times
  - [ ] Calculate training load trend (increasing/stable/decreasing)

- [ ] **Performance Metrics**
  - [ ] Track pace/speed improvements
  - [ ] Identify personal records
  - [ ] Analyze consistency (workout adherence)

- [ ] **Store in Database**
  - [ ] Save raw workout data to `forge_training_data`
  - [ ] Save analyzed patterns to `forge_workout_patterns`
  - [ ] Include source attribution and confidence scores

**Key Endpoints:**
- `GET /api/strava/activities` - List activities
- `GET /api/strava/athlete/stats` - Athlete statistics
- `POST /api/strava/fetch-data` - Main data fetching endpoint

**Expected Output Structure:**
```typescript
{
  patterns: {
    trainingLoad: {
      weeklyMinutes: 450,
      trend: 'increasing',
      status: 'optimal'
    },
    workoutDistribution: {
      run: 3,
      bike: 2,
      swim: 1,
      strength: 1
    },
    intensityDistribution: {
      zone1_recovery: 15,
      zone2_base: 45,
      zone3_tempo: 25,
      zone4_threshold: 10,
      zone5_max: 5
    },
    optimalTrainingTimes: ['06:00-07:00', '17:00-19:00'],
    consistency: {
      adherence: 85, // percentage
      missedWorkouts: 2
    }
  },
  metrics: {
    trainingScore: 85,
    performanceScore: 78,
    overtrainingRisk: 'low'
  },
  confidence: 90,
  dataSource: 'Strava'
}
```

---

## 2.2 Fitbit/Whoop Data Fetching

### Files:
- `/app/api/fitbit/fetch-training-data/route.ts` (NEW)
- `/app/api/whoop/fetch-data/route.ts` (NEW)

**Purpose:** Fetch workout sessions and recovery metrics

**Checklist:**

**Fitbit:**
- [ ] Fetch activities (past 30 days)
- [ ] Get heart rate zones per workout
- [ ] Extract activity types and durations
- [ ] Calculate training volume
- [ ] Analyze workout consistency

**Whoop:**
- [ ] Fetch workout data (strain scores)
- [ ] Get recovery scores
- [ ] Extract HRV trends
- [ ] Analyze sleep quality impact on training
- [ ] Calculate optimal training days vs rest days
- [ ] Identify overtraining risk from recovery patterns

**Whoop-Specific Metrics:**
```typescript
{
  recovery: {
    avgRecoveryScore: 75,
    trend: 'stable',
    greenDays: 20, // high recovery days
    yellowDays: 7,  // moderate recovery days
    redDays: 3      // low recovery days
  },
  strain: {
    avgDailyStrain: 14.5,
    optimalStrainRange: [12, 17],
    overreachingDays: 2
  },
  hrvTrends: {
    avgHRV: 65,
    trend: 'improving',
    baseline: 62
  },
  recommendations: {
    restDaysNeeded: 2,
    optimalTrainingDays: ['Mon', 'Tue', 'Thu', 'Fri', 'Sat'],
    deloadWeekRecommended: false
  }
}
```

---

## 2.3 Update MCP Sync Service

### File: `/lib/services/mcp-sync.ts` (UPDATE)

**Add Forge-specific sync configs:**

```typescript
const SYNC_CONFIGS: Record<string, SyncConfig> = {
  // ... existing configs

  // Forge-specific (training data syncs)
  strava: {
    provider: 'strava',
    endpoint: '/api/strava/fetch-data',
    interval: 1440, // 24 hours (once daily)
    priority: 'high',
    timeout: 60000,
  },
  whoop: {
    provider: 'whoop',
    endpoint: '/api/whoop/fetch-data',
    interval: 360, // 6 hours (recovery updates multiple times daily)
    priority: 'high',
    timeout: 45000,
  },
  garmin: {
    provider: 'garmin',
    endpoint: '/api/garmin/fetch-data',
    interval: 1440, // 24 hours
    priority: 'medium',
    timeout: 60000,
  },
};
```

**Checklist:**
- [ ] Add Strava sync config
- [ ] Add Whoop sync config
- [ ] Add Fitbit training data sync (separate from health data)
- [ ] Update data quality calculation for training metrics
- [ ] Test sync scheduling for training integrations

---

# PHASE 3: FORGE-SPECIFIC INFERENCE MODULES

**Priority:** HIGH
**Effort:** 1.5 days
**Dependencies:** Phase 2, Existing inference framework

## 3.1 Advanced Training Protocol Inference

### File: `/lib/inference/forge-training-protocol.ts` (NEW - Enhanced version)

**Purpose:** Advanced training analysis using actual workout data from Strava/Whoop/Fitbit

**Key Differences from Sage's `training-protocol.ts`:**
- Sage version: Questionnaire-based with basic inference
- Forge version: Data-driven with actual workout analysis

**Checklist:**

- [ ] **Workout Data Extraction**
  - [ ] Parse Strava activities (type, duration, distance, HR zones)
  - [ ] Parse Whoop strain data
  - [ ] Parse Fitbit activity sessions
  - [ ] Normalize across providers

- [ ] **Training Volume Analysis**
  - [ ] Calculate weekly volume (total minutes)
  - [ ] Calculate volume by workout type
  - [ ] Identify training blocks (build, peak, taper)
  - [ ] Detect periodization patterns

- [ ] **Intensity Analysis**
  - [ ] Calculate time in heart rate zones
  - [ ] Identify HIIT sessions (Zone 4-5 work)
  - [ ] Detect recovery sessions (Zone 1-2)
  - [ ] Analyze intensity distribution (polarized, pyramidal, threshold)

- [ ] **Performance Tracking**
  - [ ] Track pace/speed improvements over time
  - [ ] Identify PRs and breakthrough workouts
  - [ ] Calculate training effectiveness score
  - [ ] Detect plateaus or regressions

- [ ] **Overtraining Detection**
  - [ ] Acute:Chronic Workload Ratio (ACWR)
  - [ ] Recovery score trends (Whoop)
  - [ ] HRV decline patterns
  - [ ] Subjective fatigue indicators

- [ ] **Training Recommendations**
  - [ ] Optimal training frequency
  - [ ] Volume recommendations (increase/maintain/reduce)
  - [ ] Intensity distribution adjustments
  - [ ] Deload week recommendations
  - [ ] Nutrition timing for training

**Output Structure:**
```typescript
interface ForgeTrainingProtocol {
  trainingVolume: {
    weeklyMinutes: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    recommendation: 'increase' | 'maintain' | 'reduce' | 'deload';
  };
  intensityDistribution: {
    zone1_recovery: number; // percentage
    zone2_base: number;
    zone3_tempo: number;
    zone4_threshold: number;
    zone5_max: number;
    polarizationIndex: number; // How polarized training is (0-100)
  };
  workoutTypes: Array<{
    type: 'run' | 'bike' | 'swim' | 'strength' | 'hiit' | 'sports';
    frequency: number; // per week
    avgDuration: number; // minutes
    intensityFocus: 'low' | 'moderate' | 'high';
  }>;
  performance: {
    trend: 'improving' | 'stable' | 'declining';
    recentPRs: number;
    trainingEffectiveness: number; // 0-100
    consistencyScore: number; // 0-100
  };
  recovery: {
    adequateRecovery: boolean;
    avgRecoveryScore: number; // 0-100 (from Whoop)
    hrvTrend: 'improving' | 'stable' | 'declining';
    overtrainingRisk: 'none' | 'low' | 'moderate' | 'high';
    recommendedRestDays: number;
  };
  nutritionTiming: {
    preWorkoutCarbs: string; // Amount and timing
    intraWorkoutFueling: string; // For long sessions
    postWorkoutRecovery: string; // Protein + carbs
    dailyProtein: string; // Based on training load
    dailyCarbs: string; // Periodized to training
  };
  confidence: number;
  dataSource: string;
  insights: string[];
  recommendations: string[];
}
```

---

## 3.2 Performance Nutrition Optimizer

### File: `/lib/inference/performance-nutrition.ts` (NEW)

**Purpose:** Optimize nutrition specifically for training performance and recovery

**Checklist:**

- [ ] **Carbohydrate Periodization**
  - [ ] High-intensity training days: High carbs (6-8g/kg)
  - [ ] Moderate training days: Moderate carbs (4-6g/kg)
  - [ ] Rest days: Lower carbs (2-3g/kg)
  - [ ] Taper phase: Carb loading protocol

- [ ] **Protein Optimization**
  - [ ] Base on training volume and type
  - [ ] Strength training: 2.0-2.2g/kg
  - [ ] Endurance training: 1.6-1.8g/kg
  - [ ] Mixed training: 1.8-2.0g/kg
  - [ ] Distribute protein across 4-5 meals

- [ ] **Workout Fuel Timing**
  - [ ] Pre-workout (1-3 hours): Carb + protein amounts
  - [ ] Intra-workout (>90 min): 30-60g carbs/hour
  - [ ] Post-workout (0-60 min): Fast carbs + protein
  - [ ] Recovery window optimization

- [ ] **Hydration Strategy**
  - [ ] Base on training volume and sweat rate
  - [ ] Electrolyte needs for long sessions
  - [ ] Hydration testing recommendations

- [ ] **Supplement Recommendations**
  - [ ] Creatine (for strength/power training)
  - [ ] Beta-alanine (for HIIT/anaerobic work)
  - [ ] Caffeine timing (for training performance)
  - [ ] Carbohydrate supplements (for endurance)

**Output Structure:**
```typescript
interface PerformanceNutrition {
  carbohydratePeriodization: {
    highTrainingDays: { gPerKg: number; totalGrams: number; timing: string[] };
    moderateTrainingDays: { gPerKg: number; totalGrams: number; timing: string[] };
    restDays: { gPerKg: number; totalGrams: number; timing: string[] };
  };
  proteinStrategy: {
    dailyTarget: { gPerKg: number; totalGrams: number };
    distribution: string[]; // e.g., ['30g breakfast', '40g lunch', '30g snack', '50g dinner']
    timing: string; // e.g., 'Every 3-4 hours, emphasis within 2h post-training'
  };
  workoutFueling: {
    preWorkout: { timing: string; foods: string[]; macros: string };
    intraWorkout: { when: string; amount: string; type: string };
    postWorkout: { timing: string; foods: string[]; macros: string };
  };
  hydration: {
    dailyBaseline: string; // liters
    perHourTraining: string; // ml/hour
    electrolyteNeeds: boolean;
  };
  supplements: Array<{
    name: string;
    dosage: string;
    timing: string;
    rationale: string;
    priority: 'essential' | 'beneficial' | 'optional';
  }>;
  confidence: number;
  dataSource: string;
}
```

---

## 3.3 Recovery Protocol Calculator

### File: `/lib/inference/recovery-protocol.ts` (NEW)

**Purpose:** Generate recovery strategies based on training load and recovery metrics

**Checklist:**

- [ ] **Recovery Metrics Analysis**
  - [ ] Whoop recovery score trends
  - [ ] HRV patterns (Oura/Whoop)
  - [ ] Resting heart rate trends
  - [ ] Sleep quality impact on recovery

- [ ] **Active Recovery Recommendations**
  - [ ] Light activity on rest days
  - [ ] Mobility/flexibility work frequency
  - [ ] Recovery modalities (foam rolling, stretching, etc.)

- [ ] **Nutrition for Recovery**
  - [ ] Anti-inflammatory foods
  - [ ] Sleep-supporting nutrition
  - [ ] Protein timing for recovery
  - [ ] Hydration for recovery

- [ ] **Sleep Optimization**
  - [ ] Sleep duration targets (athletes need 8-10h)
  - [ ] Sleep quality improvement strategies
  - [ ] Napping recommendations for high-volume training

- [ ] **Deload Recommendations**
  - [ ] When to implement deload week
  - [ ] Deload structure (volume reduction)
  - [ ] Nutrition adjustments during deload

**Output Structure:**
```typescript
interface RecoveryProtocol {
  currentRecoveryStatus: {
    score: number; // 0-100
    status: 'excellent' | 'good' | 'moderate' | 'poor';
    trend: 'improving' | 'stable' | 'declining';
    limitingFactors: string[];
  };
  activeRecovery: {
    frequency: string; // e.g., '2-3 times per week'
    activities: string[]; // e.g., ['Light walking', 'Yoga', 'Swimming']
    duration: string; // e.g., '20-30 minutes'
  };
  nutritionStrategy: {
    antiInflammatory: string[];
    sleepSupport: string[];
    proteinTiming: string;
  };
  sleepOptimization: {
    targetHours: number;
    sleepQualityStrategies: string[];
    nappingRecommended: boolean;
  };
  deloadRecommendation: {
    needed: boolean;
    timing: string; // e.g., 'Within next 2 weeks'
    structure: string; // e.g., '50% volume reduction, maintain intensity'
  };
  confidence: number;
  insights: string[];
  recommendations: string[];
}
```

---

## 3.4 Workout Programming Engine

### File: `/lib/inference/workout-programming.ts` (NEW)

**Purpose:** Generate weekly workout structure based on goals and current training

**Checklist:**

- [ ] **Goal-Based Programming**
  - [ ] Strength gain: 3-5 days strength + 1-2 cardio
  - [ ] Endurance: 4-6 days endurance + 1-2 strength
  - [ ] Fat loss: 3-4 days mixed + 2-3 cardio
  - [ ] Performance: Sport-specific periodization

- [ ] **Workout Distribution**
  - [ ] Weekly schedule (which days for which workouts)
  - [ ] Intensity distribution (hard/moderate/easy days)
  - [ ] Recovery day placement

- [ ] **Progressive Overload**
  - [ ] Volume progression (weekly increase guidelines)
  - [ ] Intensity progression
  - [ ] Deload week frequency

- [ ] **Integration with Calendar**
  - [ ] Use Gmail calendar patterns to suggest workout times
  - [ ] Avoid scheduling hard workouts on high-stress days
  - [ ] Optimize around work meetings

**Output Structure:**
```typescript
interface WorkoutProgramming {
  weeklyStructure: Array<{
    day: string; // 'Monday', 'Tuesday', etc.
    workoutType: string; // 'Strength - Upper', 'Cardio - Endurance Run', etc.
    duration: number; // minutes
    intensity: 'high' | 'moderate' | 'low';
    suggestedTime: string; // Based on calendar
    nutritionFocus: string; // Pre/post workout nutrition
  }>;
  progressionPlan: {
    volumeIncrease: string; // e.g., '5-10% per week'
    intensityProgression: string;
    deloadFrequency: string; // e.g., 'Every 4 weeks'
  };
  confidence: number;
  insights: string[];
}
```

---

## 3.5 Forge Hybrid Engine

### File: `/lib/inference/forge-hybrid-engine.ts` (NEW)

**Purpose:** Orchestrate all Forge inference modules (similar to Sage's hybrid-engine.ts)

**Checklist:**

- [ ] **Parallel Execution**
  - [ ] Run all Forge inference modules in parallel
  - [ ] Advanced training protocol
  - [ ] Performance nutrition
  - [ ] Recovery protocol
  - [ ] Workout programming
  - [ ] (Reuse) Stress calculator
  - [ ] (Reuse) Sleep quality assessor

- [ ] **Aggregate Results**
  - [ ] Combine insights from all modules
  - [ ] Calculate overall confidence
  - [ ] Identify data gaps
  - [ ] Generate top recommendations

- [ ] **Confidence Weighting** (Forge-specific)
  - [ ] Training protocol: 30%
  - [ ] Performance nutrition: 25%
  - [ ] Recovery protocol: 20%
  - [ ] Sleep quality: 15%
  - [ ] Stress assessment: 10%

- [ ] **Cross-Module Insights**
  - [ ] High stress + heavy training = prioritize recovery
  - [ ] Poor sleep + high training load = reduce volume
  - [ ] Low recovery score + planned hard workout = suggest rest day

**Output Structure:**
```typescript
interface ForgeHybridInferenceResult {
  training: ForgeTrainingProtocol;
  nutrition: PerformanceNutrition;
  recovery: RecoveryProtocol;
  programming: WorkoutProgramming;
  sleep: SleepQualityResult; // Reused from Sage
  stress: StressInferenceResult; // Reused from Sage

  overallConfidence: number;
  dataSourcesUsed: string[];
  dataGaps: string[];
  insights: string[];
  topRecommendations: string[];
  inferredAt: string;
}
```

---

# PHASE 4: FORGE PLAN GENERATION INTEGRATION

**Priority:** HIGH
**Effort:** 1 day
**Dependencies:** Phase 3, Existing plan generation

## 4.1 Forge Inference Enhancer

### File: `/lib/services/forge-inference-enhancer.ts` (NEW)

**Purpose:** Integrate Forge hybrid inference into plan generation (similar to Sage's inference-enhancer.ts)

**Checklist:**

- [ ] **Map Forge Onboarding to Questionnaire**
  - [ ] Training goals (muscle gain, endurance, performance, fat loss)
  - [ ] Training frequency and type
  - [ ] Training experience level
  - [ ] Available equipment
  - [ ] Time availability

- [ ] **Enhance Context with Forge Inference**
  - [ ] Run Forge hybrid inference
  - [ ] Format results for AI prompt
  - [ ] Generate confidence transparency

- [ ] **Forge-Specific Prompt Formatting**
  - [ ] Training protocol analysis section
  - [ ] Performance nutrition recommendations
  - [ ] Recovery protocol section
  - [ ] Workout programming structure
  - [ ] Weekly training schedule

**Prompt Format Example:**
```markdown
## FORGE DATA-DRIVEN INSIGHTS (Hybrid Inference Engine)

**Overall Confidence:** 82% (excellent data quality)
**Data Sources:** Strava, Whoop, Oura Ring, Blood Biomarkers

**Training Protocol Analysis:**
- Weekly Volume: 450 minutes (optimal, trending stable)
- Workout Distribution: 3x strength, 2x cardio, 1x HIIT, 1x flexibility
- Intensity: 15% Zone 1, 45% Zone 2, 25% Zone 3, 10% Zone 4, 5% Zone 5
- Performance Trend: Improving (recent PRs in squat, deadlift)
- Overtraining Risk: Low
- Confidence: 90%

**Performance Nutrition Strategy:**
- High Training Days (Mon, Wed, Fri): 6-7g/kg carbs (420-490g)
- Moderate Training Days (Tue, Thu): 4-5g/kg carbs (280-350g)
- Rest Days (Sat, Sun): 2-3g/kg carbs (140-210g)
- Daily Protein: 2.0g/kg (140g total)
- Pre-Workout: 30-40g carbs + 15-20g protein, 60-90 min before
- Post-Workout: 30-40g fast carbs + 25-30g protein, within 30 min
- Confidence: 75%

**Recovery Protocol:**
- Current Recovery: Good (avg score 75/100, stable trend)
- HRV Trend: Improving (baseline 62ms → current 68ms)
- Recommended Rest Days: 2 per week (optimally Sat-Sun or Wed+Sun)
- Active Recovery: 2x per week (yoga, light walking)
- Deload Needed: Yes, within next 2 weeks (50% volume reduction)
- Sleep Target: 8-9 hours (athlete requirement)
- Confidence: 85%

**Workout Programming:**
Weekly Structure:
- Monday: Strength - Lower Body (60 min, high intensity, 07:00)
- Tuesday: Cardio - Endurance Run (45 min, moderate, 06:30)
- Wednesday: Strength - Upper Body (60 min, high intensity, 18:00)
- Thursday: HIIT - Intervals (30 min, high, 17:30)
- Friday: Strength - Full Body (60 min, moderate, 07:00)
- Saturday: Active Recovery - Yoga (30 min, low, 10:00)
- Sunday: Rest Day
Confidence: 70%

**Priority Recommendations:**
1. Implement carbohydrate periodization: High carbs on strength days, moderate on cardio, low on rest
2. Increase protein to 2.0g/kg (140g daily) distributed across 5 meals
3. Schedule deload week in next 2 weeks: 50% volume reduction, maintain intensity
4. Prioritize sleep: Aim for 8-9 hours, especially after high-intensity days
5. Pre-workout nutrition: Banana + Greek yogurt 60 min before morning workouts

**INSTRUCTION:** Use the above training-optimized insights to create a Forge performance plan.
Prioritize workout fueling (82% confidence) over generic nutrition. Reference specific training
sessions, recovery metrics, and performance goals.
```

---

## 4.2 Integrate into Forge Plan Generation

### File: `/app/api/generate-forge-plan/route.ts` (UPDATE)

**Integration Steps:**

```typescript
// After fetching onboarding data and unified context

// NEW: Step 2.6 - Run Forge hybrid inference
console.log(`[2.6/5] Running Forge hybrid inference engine...`);
let forgeEnhancedContext = null;
let forgeInferenceSection = '';

try {
  forgeEnhancedContext = await enhanceForgeContextWithInference(
    userEmail,
    formData,
    'forge'
  );

  if (forgeEnhancedContext) {
    console.log(`[OK] Forge inference complete with ${forgeEnhancedContext.confidenceMetrics.overall}% confidence`);
    console.log(`[OK] Training Volume: ${forgeEnhancedContext.inference.training.trainingVolume.weeklyMinutes} min/week`);
    console.log(`[OK] Recovery Score: ${forgeEnhancedContext.inference.recovery.currentRecoveryStatus.score}`);
    console.log(`[OK] Overtraining Risk: ${forgeEnhancedContext.inference.training.recovery.overtrainingRisk}`);

    forgeInferenceSection = formatForgeInferenceForPrompt(forgeEnhancedContext);
  }
} catch (error) {
  console.error('[WARN] Error running Forge inference:', error);
}

// Inject Forge inference into system prompt
if (forgeInferenceSection) {
  systemPrompt += '\n\n' + forgeInferenceSection;
}

// After plan generation, add Forge confidence metadata
if (forgeEnhancedContext) {
  planData.forgeInferenceMetadata = {
    overallConfidence: forgeEnhancedContext.confidenceMetrics.overall,
    trainingVolume: forgeEnhancedContext.inference.training.trainingVolume.weeklyMinutes,
    recoveryScore: forgeEnhancedContext.inference.recovery.currentRecoveryStatus.score,
    overtrainingRisk: forgeEnhancedContext.inference.training.recovery.overtrainingRisk,
    dataSources: forgeEnhancedContext.dataQualityReport.sourcesUsed,
    dataQuality: forgeEnhancedContext.dataQualityReport.qualityLevel,
  };
}
```

**Checklist:**
- [ ] Import Forge inference enhancer
- [ ] Add Forge inference step after unified context
- [ ] Inject Forge inference into system prompt
- [ ] Add Forge-specific confidence metadata
- [ ] Test with various training levels
- [ ] Verify workout programming accuracy

---

# PHASE 5: FORGE-SPECIFIC FEATURES

**Priority:** MEDIUM
**Effort:** 1 day
**Dependencies:** Phase 4

## 5.1 Exercise Library Integration

### File: `/lib/data/exercise-library.ts` (NEW)

**Purpose:** Structured exercise database for workout programming

**Checklist:**

- [ ] **Exercise Categories**
  - [ ] Strength exercises (squat, deadlift, bench, etc.)
  - [ ] Cardio exercises (run, bike, swim, row)
  - [ ] HIIT protocols (Tabata, EMOM, AMRAP)
  - [ ] Mobility/flexibility exercises

- [ ] **Exercise Metadata**
  - [ ] Muscle groups targeted
  - [ ] Equipment required
  - [ ] Difficulty level
  - [ ] Exercise demo links/descriptions

- [ ] **Progressive Overload Tracking**
  - [ ] Suggested rep ranges
  - [ ] Intensity progressions
  - [ ] Volume progressions

---

## 5.2 Meal Timing for Training

### File: `/lib/inference/forge-meal-timing.ts` (NEW - Training-optimized version)

**Purpose:** Optimize meal timing around workouts (enhanced version of Sage's meal-timing.ts)

**Key Differences from Sage:**
- Sage: Meal timing around work schedule
- Forge: Meal timing around workout schedule

**Checklist:**

- [ ] **Pre-Workout Meals**
  - [ ] Timing based on workout time and type
  - [ ] Carb amount based on workout duration/intensity
  - [ ] Protein for muscle protection
  - [ ] Easy-to-digest recommendations

- [ ] **Intra-Workout Nutrition**
  - [ ] Only for sessions >90 minutes
  - [ ] Carb recommendations (30-60g/hour)
  - [ ] Electrolyte needs for long sessions

- [ ] **Post-Workout Meals**
  - [ ] Timing: Within 30-60 minutes
  - [ ] Fast-digesting carbs + protein
  - [ ] Amount based on workout type/duration

- [ ] **Non-Training Day Meals**
  - [ ] Lower carb approach
  - [ ] Protein distribution maintained
  - [ ] Focus on nutrient density

**Output Structure:**
```typescript
interface ForgeMealTiming {
  trainingDays: {
    preWorkout: MealWindow & {
      macros: { carbs: string; protein: string };
      examples: string[];
    };
    intraWorkout?: {
      when: string;
      what: string;
      amount: string;
    };
    postWorkout: MealWindow & {
      macros: { carbs: string; protein: string };
      examples: string[];
    };
    remainingMeals: MealWindow[];
  };
  restDays: {
    meals: MealWindow[];
    carbReduction: string;
    focus: string;
  };
  confidence: number;
}
```

---

# PHASE 6: TESTING & REFINEMENT

**Priority:** HIGH
**Effort:** 0.5 days
**Dependencies:** All previous phases

## 6.1 Integration Testing

**Checklist:**

- [ ] **End-to-End Testing**
  - [ ] Test with Strava-connected user
  - [ ] Test with Whoop-connected user
  - [ ] Test with Fitbit-connected user
  - [ ] Test with no wearables (questionnaire fallback)

- [ ] **Data Quality Verification**
  - [ ] Verify workout parsing accuracy
  - [ ] Check training volume calculations
  - [ ] Validate intensity distribution
  - [ ] Confirm recovery score accuracy

- [ ] **Inference Accuracy**
  - [ ] Review training protocol recommendations
  - [ ] Validate nutrition timing suggestions
  - [ ] Check recovery protocol appropriateness
  - [ ] Verify workout programming logic

- [ ] **Prompt Quality**
  - [ ] Review AI-generated Forge plans
  - [ ] Check for training-specific personalization
  - [ ] Verify nutrition aligns with training
  - [ ] Confirm workout programming makes sense

- [ ] **Confidence Transparency**
  - [ ] Verify confidence scores are accurate
  - [ ] Check data source attribution
  - [ ] Validate data gap identification

---

# IMPLEMENTATION TIMELINE

## Week 1: Data Infrastructure (Days 1-2)
- **Day 1 Morning:** Database migrations (Phase 1)
- **Day 1 Afternoon:** Strava fetch endpoint (Phase 2.1)
- **Day 2 Morning:** Whoop/Fitbit fetch endpoints (Phase 2.2)
- **Day 2 Afternoon:** Update MCP sync service (Phase 2.3)

## Week 1: Inference Modules (Days 3-4)
- **Day 3 Morning:** Advanced training protocol (Phase 3.1)
- **Day 3 Afternoon:** Performance nutrition optimizer (Phase 3.2)
- **Day 4 Morning:** Recovery protocol calculator (Phase 3.3)
- **Day 4 Afternoon:** Workout programming engine (Phase 3.4)

## Week 2: Integration & Refinement (Days 5-6)
- **Day 5 Morning:** Forge hybrid engine (Phase 3.5)
- **Day 5 Afternoon:** Forge inference enhancer (Phase 4.1)
- **Day 6 Morning:** Integrate into Forge plan generation (Phase 4.2)
- **Day 6 Afternoon:** Testing & refinement (Phase 6)

**Total Estimated Time:** 6 days (3-4 days with focused effort)

---

# SUCCESS METRICS

## Data Quality
- [ ] 90%+ confidence with Strava + Whoop connected
- [ ] Accurate training volume calculations
- [ ] Valid intensity distribution analysis
- [ ] Appropriate recovery recommendations

## User Experience
- [ ] Workout-specific nutrition recommendations
- [ ] Personalized training schedule
- [ ] Recovery-aware programming
- [ ] Clear confidence transparency

## Technical Quality
- [ ] No TypeScript errors
- [ ] All inference modules integrated
- [ ] Proper error handling
- [ ] Efficient data syncing

---

# FORGE VS SAGE COMPARISON

| Aspect | Sage (Nutrition) | Forge (Training) |
|--------|-----------------|------------------|
| **Primary Focus** | Meal timing, stress, nutrition | Workout programming, performance |
| **Key Data Sources** | Gmail (calendar), Oura (sleep), Labs | Strava (workouts), Whoop (recovery) |
| **Main Inference** | Stress, meal timing, sleep | Training volume, intensity, recovery |
| **Nutrition Goal** | Optimize eating for lifestyle | Fuel performance & recovery |
| **User Persona** | Busy professional optimizing health | Athlete optimizing performance |
| **Confidence Weights** | Stress 25%, Meals 25%, Sleep 25% | Training 30%, Nutrition 25%, Recovery 20% |
| **Unique Features** | Calendar-aware meal windows | Workout programming, periodization |

---

# REUSABLE COMPONENTS FROM SAGE

✅ **Can be reused as-is:**
- Token management system (`/lib/services/token-manager.ts`)
- MCP sync service architecture (`/lib/services/mcp-sync.ts`)
- Ecosystem fetcher (`/lib/services/ecosystem-fetcher.ts`)
- Stress calculator (`/lib/inference/stress-calculator.ts`)
- Sleep quality assessor (`/lib/inference/sleep-quality.ts`)
- Base meal timing logic (`/lib/inference/meal-timing.ts`)

🔧 **Needs Forge-specific adaptation:**
- Training protocol (enhance from basic to data-driven)
- Meal timing (adapt for workout timing vs work schedule)
- Prompt builder (training-focused vs nutrition-focused)

🆕 **Forge-specific new modules:**
- Advanced training protocol with workout data
- Performance nutrition optimizer
- Recovery protocol calculator
- Workout programming engine
- Exercise library

---

# NEXT STEPS AFTER FORGE IMPLEMENTATION

1. **Cross-System Integration**
   - Allow users to have both Sage + Forge plans
   - Ensure nutrition plans (Sage) align with training plans (Forge)
   - Unified confidence scoring across both systems

2. **Advanced Features**
   - Race/competition prep protocols
   - Injury recovery protocols
   - Deload week automation
   - Training block periodization (build/peak/taper)

3. **Additional Integrations**
   - Garmin Connect
   - Polar Flow
   - Apple Health (workouts)
   - TrainingPeaks

---

# CONCLUSION

Forge MCP implementation leverages 70% of the Sage infrastructure while adding training-specific intelligence. The focus shifts from "when to eat for work schedule" to "how to train and fuel performance."

**Key Advantages:**
- Reuse proven architecture from Sage
- Focus on training-specific inference
- Wearable data-driven recommendations
- Performance nutrition optimization
- Recovery-aware programming

**Estimated Effort:** 3-4 focused days
**Value Delivered:** Performance-optimized training + nutrition plans with 80%+ confidence when wearables are connected

---

**Status:** Ready for Implementation ✅
**Next Action:** Begin Phase 1 - Database migrations

-- Forge Fitness Profiles
-- Stores user workout preferences and onboarding data

CREATE TABLE IF NOT EXISTS forge_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL UNIQUE,

    -- Core preferences
    primary_goal TEXT NOT NULL,
    experience_level TEXT NOT NULL,
    training_days_per_week INTEGER NOT NULL DEFAULT 3 CHECK (training_days_per_week >= 1 AND training_days_per_week <= 7),
    session_length_minutes INTEGER NOT NULL DEFAULT 45 CHECK (session_length_minutes >= 15 AND session_length_minutes <= 120),

    -- Equipment and exercise preferences (stored as JSON arrays)
    equipment JSONB DEFAULT '[]'::jsonb,
    preferred_exercises JSONB DEFAULT '[]'::jsonb,
    injuries JSONB DEFAULT '[]'::jsonb,

    -- Additional
    additional_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forge_profiles_user_email ON forge_profiles(user_email);
CREATE INDEX IF NOT EXISTS idx_forge_profiles_primary_goal ON forge_profiles(primary_goal);

-- Enable RLS
ALTER TABLE forge_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own forge profile" ON forge_profiles;
DROP POLICY IF EXISTS "Users can insert own forge profile" ON forge_profiles;
DROP POLICY IF EXISTS "Users can update own forge profile" ON forge_profiles;
DROP POLICY IF EXISTS "Service role manages forge profiles" ON forge_profiles;

-- RLS Policies
CREATE POLICY "Users can view own forge profile"
    ON forge_profiles FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own forge profile"
    ON forge_profiles FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own forge profile"
    ON forge_profiles FOR UPDATE
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role manages forge profiles"
    ON forge_profiles FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Grants
GRANT SELECT, INSERT, UPDATE ON forge_profiles TO authenticated;

-- =====================================================
-- Exercise Database (foundation for workout plans)
-- =====================================================

CREATE TABLE IF NOT EXISTS forge_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,

    -- Categorization
    exercise_type TEXT NOT NULL, -- weightTraining, hiit, cardio, yoga, pilates, calisthenics, crossfit, running
    muscle_groups JSONB DEFAULT '[]'::jsonb, -- ['chest', 'shoulders', 'triceps']
    equipment_required JSONB DEFAULT '[]'::jsonb, -- ['barbell', 'bench']

    -- Difficulty and alternatives
    difficulty_level TEXT NOT NULL DEFAULT 'intermediate', -- beginner, intermediate, advanced
    alternatives JSONB DEFAULT '[]'::jsonb, -- Exercise IDs that can substitute

    -- Instructions
    instructions JSONB DEFAULT '[]'::jsonb, -- Step by step instructions
    tips JSONB DEFAULT '[]'::jsonb, -- Form tips
    common_mistakes JSONB DEFAULT '[]'::jsonb,

    -- Media
    video_url TEXT,
    image_url TEXT,
    thumbnail_url TEXT,

    -- Metrics
    is_compound BOOLEAN DEFAULT false, -- True for compound movements
    is_unilateral BOOLEAN DEFAULT false, -- True for single-arm/leg exercises
    calories_per_minute DECIMAL(4,1), -- Approximate calorie burn

    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for exercise queries
CREATE INDEX IF NOT EXISTS idx_forge_exercises_type ON forge_exercises(exercise_type);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_difficulty ON forge_exercises(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_active ON forge_exercises(is_active);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_muscle_groups ON forge_exercises USING GIN(muscle_groups);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_equipment ON forge_exercises USING GIN(equipment_required);

-- Enable RLS (public read for exercises)
ALTER TABLE forge_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view exercises" ON forge_exercises;
DROP POLICY IF EXISTS "Service role manages exercises" ON forge_exercises;

CREATE POLICY "Anyone can view exercises"
    ON forge_exercises FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role manages exercises"
    ON forge_exercises FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

GRANT SELECT ON forge_exercises TO authenticated;
GRANT SELECT ON forge_exercises TO anon;

-- =====================================================
-- Workout Plans (generated from profile)
-- =====================================================

CREATE TABLE IF NOT EXISTS forge_workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Plan structure
    duration_weeks INTEGER DEFAULT 4,
    days_per_week INTEGER NOT NULL,

    -- The actual plan (JSON structure)
    -- { "week1": { "day1": { "name": "Push Day", "exercises": [...] }, ... } }
    plan_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    based_on_goal TEXT,
    based_on_level TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forge_workout_plans_user ON forge_workout_plans(user_email);
CREATE INDEX IF NOT EXISTS idx_forge_workout_plans_active ON forge_workout_plans(user_email, is_active);

ALTER TABLE forge_workout_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workout plans" ON forge_workout_plans;
DROP POLICY IF EXISTS "Users can insert own workout plans" ON forge_workout_plans;
DROP POLICY IF EXISTS "Users can update own workout plans" ON forge_workout_plans;
DROP POLICY IF EXISTS "Service role manages workout plans" ON forge_workout_plans;

CREATE POLICY "Users can view own workout plans"
    ON forge_workout_plans FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own workout plans"
    ON forge_workout_plans FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own workout plans"
    ON forge_workout_plans FOR UPDATE
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role manages workout plans"
    ON forge_workout_plans FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

GRANT SELECT, INSERT, UPDATE ON forge_workout_plans TO authenticated;

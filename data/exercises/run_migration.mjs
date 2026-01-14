/**
 * Run migration for forge_exercises table
 *
 * Usage (from project root):
 *   node --env-file=.env.local data/exercises/run_migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Read the migration SQL
const migrationPath = join(__dirname, '../../supabase/migrations/062_forge_profiles.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

async function runMigration() {
  console.log('🔧 Running forge_exercises migration...\n');

  // Execute the migration using the REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: migrationSQL })
  });

  if (!response.ok) {
    // RPC doesn't exist, try the SQL endpoint
    console.log('ℹ️ exec_sql RPC not available. Migration must be run via Supabase dashboard.\n');
    console.log('📋 Steps to run the migration:');
    console.log('   1. Go to your Supabase project dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Create a new query');
    console.log('   4. Copy and paste the contents of:');
    console.log('      supabase/migrations/062_forge_profiles.sql');
    console.log('   5. Click "Run"');
    console.log('\n   After running the migration, run:');
    console.log('   node --env-file=.env.local data/exercises/seed_exercises.mjs');
    return;
  }

  console.log('✅ Migration completed successfully!');
}

// Alternative: Check if table exists
async function checkTable() {
  const { data, error } = await supabase
    .from('forge_exercises')
    .select('id')
    .limit(1);

  if (error && error.message.includes('not find the table')) {
    console.log('❌ forge_exercises table does not exist.\n');
    console.log('📋 To create it, run this SQL in your Supabase dashboard SQL Editor:\n');
    console.log('---');

    // Print a simplified version of just the forge_exercises table
    const forgeExercisesSql = `
-- Create forge_exercises table
CREATE TABLE IF NOT EXISTS forge_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    exercise_type TEXT NOT NULL,
    muscle_groups JSONB DEFAULT '[]'::jsonb,
    equipment_required JSONB DEFAULT '[]'::jsonb,
    difficulty_level TEXT NOT NULL DEFAULT 'intermediate',
    alternatives JSONB DEFAULT '[]'::jsonb,
    instructions JSONB DEFAULT '[]'::jsonb,
    tips JSONB DEFAULT '[]'::jsonb,
    common_mistakes JSONB DEFAULT '[]'::jsonb,
    video_url TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    is_compound BOOLEAN DEFAULT false,
    is_unilateral BOOLEAN DEFAULT false,
    calories_per_minute DECIMAL(4,1),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forge_exercises_type ON forge_exercises(exercise_type);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_difficulty ON forge_exercises(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_active ON forge_exercises(is_active);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_muscle_groups ON forge_exercises USING GIN(muscle_groups);
CREATE INDEX IF NOT EXISTS idx_forge_exercises_equipment ON forge_exercises USING GIN(equipment_required);

-- RLS
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
`;

    console.log(forgeExercisesSql);
    console.log('---\n');
    console.log('After running the SQL above, run:');
    console.log('node --env-file=.env.local data/exercises/seed_exercises.mjs');
  } else if (!error) {
    console.log('✅ forge_exercises table exists!');
    console.log('You can now run the seed script:');
    console.log('node --env-file=.env.local data/exercises/seed_exercises.mjs');
  } else {
    console.log('Error:', error.message);
  }
}

checkTable();

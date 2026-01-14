/**
 * Seed script for forge_exercises table
 *
 * Usage:
 *   SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node seed_exercises.js
 *
 * Or with .env.local:
 *   node -r dotenv/config seed_exercises.js dotenv_config_path=../../.env.local
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nUsage:');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node seed_exercises.js');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Load exercises from master file
const masterFile = path.join(__dirname, 'exercises_master.json');
const masterData = JSON.parse(fs.readFileSync(masterFile, 'utf8'));

async function seedExercises() {
  console.log('Starting exercise seed...');
  console.log(`Total exercises to seed: ${masterData.exercises.length}`);

  // First, check if exercises already exist
  const { count, error: countError } = await supabase
    .from('forge_exercises')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error checking existing exercises:', countError);
    process.exit(1);
  }

  if (count > 0) {
    console.log(`\nFound ${count} existing exercises in database.`);
    console.log('Options:');
    console.log('  1. Delete existing and re-seed (run with --force flag)');
    console.log('  2. Skip exercises that already exist by name (run with --upsert flag)');

    const args = process.argv.slice(2);

    if (args.includes('--force')) {
      console.log('\n--force flag detected. Deleting existing exercises...');
      const { error: deleteError } = await supabase
        .from('forge_exercises')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) {
        console.error('Error deleting exercises:', deleteError);
        process.exit(1);
      }
      console.log('Existing exercises deleted.');
    } else if (!args.includes('--upsert')) {
      console.log('\nRun with --force to delete and re-seed, or --upsert to add missing exercises.');
      process.exit(0);
    }
  }

  // Transform exercises to match database schema
  const exercisesToInsert = masterData.exercises.map(exercise => ({
    name: exercise.name,
    description: exercise.description || null,
    exercise_type: exercise.exercise_type,
    muscle_groups: exercise.muscle_groups || [],
    equipment_required: exercise.equipment_required || [],
    difficulty_level: exercise.difficulty_level || 'intermediate',
    alternatives: exercise.alternatives || [],
    instructions: exercise.instructions || [],
    tips: exercise.tips || [],
    common_mistakes: exercise.common_mistakes || [],
    video_url: null,
    image_url: null,
    thumbnail_url: null,
    is_compound: exercise.is_compound || false,
    is_unilateral: exercise.is_unilateral || false,
    calories_per_minute: exercise.calories_per_minute || null,
    is_active: true
  }));

  // Insert in batches of 50 to avoid timeout
  const batchSize = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < exercisesToInsert.length; i += batchSize) {
    const batch = exercisesToInsert.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('forge_exercises')
      .insert(batch)
      .select('id, name');

    if (error) {
      console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += data.length;
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}: ${data.length} exercises (${inserted}/${exercisesToInsert.length})`);
    }
  }

  console.log('\n========================================');
  console.log('Seed complete!');
  console.log(`Successfully inserted: ${inserted} exercises`);
  if (errors > 0) {
    console.log(`Failed: ${errors} exercises`);
  }
  console.log('========================================');

  // Show breakdown by type
  const typeBreakdown = {};
  masterData.exercises.forEach(ex => {
    typeBreakdown[ex.exercise_type] = (typeBreakdown[ex.exercise_type] || 0) + 1;
  });
  console.log('\nExercises by type:');
  Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
}

seedExercises().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

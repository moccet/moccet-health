/**
 * Run a migration directly against Supabase
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env.local');
const envFile = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('Running migration: 065_morning_briefing_recommendation_column.sql\n');

  // Step 1: Add column
  console.log('Step 1: Adding wellness_recommendation column...');
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE morning_briefings ADD COLUMN IF NOT EXISTS wellness_recommendation TEXT;`
  }).maybeSingle();

  if (e1) {
    // Try direct approach - the rpc might not exist
    console.log('  RPC not available, trying direct query via raw SQL approach...');

    // Check if column already exists
    const { data: cols } = await supabase
      .from('morning_briefings')
      .select('*')
      .limit(1);

    if (cols && cols[0] && 'wellness_recommendation' in cols[0]) {
      console.log('  Column already exists!');
    } else {
      console.log('  Column does not exist. Please run this SQL in Supabase dashboard:');
      console.log('');
      console.log('  ALTER TABLE morning_briefings');
      console.log('  ADD COLUMN IF NOT EXISTS wellness_recommendation TEXT;');
      console.log('');
      console.log('  CREATE INDEX IF NOT EXISTS idx_morning_briefings_recommendation');
      console.log('    ON morning_briefings(user_email, wellness_recommendation, generated_at DESC);');
      console.log('');
      console.log('  UPDATE morning_briefings');
      console.log('  SET wellness_recommendation = wellness_data->>\'recommendation\'');
      console.log('  WHERE wellness_recommendation IS NULL');
      console.log('    AND wellness_data->>\'recommendation\' IS NOT NULL;');
      return;
    }
  } else {
    console.log('  Done!');
  }

  console.log('\nMigration complete!');
}

runMigration().catch(console.error);

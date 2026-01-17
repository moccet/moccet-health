/**
 * Test script for unified health data queries
 * Usage: npx tsx scripts/test-unified-query.ts
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

async function test() {
  const email = process.argv[2] || 'sofian@moccet.com';

  console.log('=== UNIFIED HEALTH DATA (latest per provider) ===\n');

  const { data: unified } = await supabase
    .from('unified_health_data')
    .select('provider, data_type, stress_score, email_count, recovery_score, sleep_score, recorded_at')
    .eq('email', email)
    .order('recorded_at', { ascending: false })
    .limit(10);

  const seen = new Set();
  unified?.forEach(r => {
    const key = r.provider + '/' + r.data_type;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(r.provider + '/' + r.data_type + ':');
      console.log('  stress_score:', r.stress_score);
      console.log('  email_count:', r.email_count);
      console.log('  recovery_score:', r.recovery_score);
      console.log('  sleep_score:', r.sleep_score);
      console.log('  recorded_at:', r.recorded_at);
      console.log('');
    }
  });

  console.log('=== UNIFIED HEALTH DAILY (last 7 days) ===\n');

  const { data: daily } = await supabase
    .from('unified_health_daily')
    .select('date, providers_reporting, stress_score, recovery_score, sleep_score, overall_status')
    .eq('email', email)
    .order('date', { ascending: false })
    .limit(7);

  daily?.forEach(r => {
    console.log(r.date + ' (' + r.overall_status + '):');
    console.log('  providers:', r.providers_reporting?.join(', '));
    console.log('  stress:', r.stress_score, '| recovery:', r.recovery_score, '| sleep:', r.sleep_score);
    console.log('');
  });
}

test().catch(console.error);

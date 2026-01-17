/**
 * Check actual column names in notification tables
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

async function check() {
  // Check notification_daily_themes columns
  console.log('=== notification_daily_themes ===');
  const { data: themes, error: e1 } = await supabase
    .from('notification_daily_themes')
    .select('*')
    .limit(1);
  if (e1) console.log('Error:', e1.message);
  else if (themes && themes[0]) console.log('Columns:', Object.keys(themes[0]).join(', '));
  else console.log('Table empty - checking with insert test');

  // Check morning_briefings columns
  console.log('\n=== morning_briefings ===');
  const { data: briefings, error: e2 } = await supabase
    .from('morning_briefings')
    .select('*')
    .limit(1);
  if (e2) console.log('Error:', e2.message);
  else if (briefings && briefings[0]) console.log('Columns:', Object.keys(briefings[0]).join(', '));
  else console.log('Table empty');
}

check().catch(console.error);

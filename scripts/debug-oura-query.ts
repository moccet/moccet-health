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

async function debug() {
  const email = 'hvdvpjyp2z@privaterelay.appleid.com';

  // Check what's actually in oura_data
  const { data: allOura } = await supabase
    .from('oura_data')
    .select('email, sync_date, start_date, end_date')
    .eq('email', email)
    .order('sync_date', { ascending: false })
    .limit(5);

  console.log('All oura_data records:');
  console.log(JSON.stringify(allOura, null, 2));

  // Try the exact query from fetchOuraData
  const end = new Date();
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  console.log('\nQuery parameters:');
  console.log(`  start: ${start.toISOString().split('T')[0]}`);
  console.log(`  end: ${end.toISOString().split('T')[0]}`);

  const { data, error } = await supabase
    .from('oura_data')
    .select('*')
    .eq('email', email)
    .gte('start_date', start.toISOString().split('T')[0])
    .lte('end_date', end.toISOString().split('T')[0])
    .order('sync_date', { ascending: false })
    .limit(1);

  console.log('\nQuery result:');
  console.log(`  Found: ${data?.length || 0} records`);
  if (error) console.log(`  Error: ${error.message}`);

  // Try without date filters
  const { data: noFilter } = await supabase
    .from('oura_data')
    .select('*')
    .eq('email', email)
    .order('sync_date', { ascending: false })
    .limit(1);

  console.log('\nWithout date filter:');
  console.log(`  Found: ${noFilter?.length || 0} records`);
  if (noFilter?.length) {
    console.log(`  Latest sync: ${noFilter[0].sync_date}`);
    console.log(`  Has sleep_data: ${!!noFilter[0].sleep_data}`);
    console.log(`  Has readiness_data: ${!!noFilter[0].readiness_data}`);
  }
}

debug().catch(console.error);

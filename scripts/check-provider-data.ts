/**
 * Check provider_data JSONB content in unified_health_data
 * Usage: npx tsx scripts/check-provider-data.ts [email] [provider1,provider2]
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
  const email = process.argv[2] || 'sofian@moccet.com';
  const providers = (process.argv[3] || 'gmail,slack').split(',');

  const { data } = await supabase
    .from('unified_health_data')
    .select('provider, provider_data')
    .eq('email', email)
    .in('provider', providers)
    .order('created_at', { ascending: false })
    .limit(providers.length);

  data?.forEach(r => {
    console.log('=== ' + r.provider.toUpperCase() + ' provider_data ===');
    console.log(JSON.stringify(r.provider_data, null, 2));
    console.log('');
  });
}

check().catch(console.error);

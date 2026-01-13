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

async function addFriend() {
  const requester = 'hvdvpjyp2z@privaterelay.appleid.com';
  const addressee = 'sofian@moccet.com';

  console.log(`Adding friend connection: ${requester} -> ${addressee}`);

  // Insert the connection as accepted
  const { data, error } = await supabase
    .from('user_connections')
    .upsert({
      requester_email: requester,
      addressee_email: addressee,
      status: 'accepted',
      connection_level: 'health_sharing',
      accepted_at: new Date().toISOString(),
    }, {
      onConflict: 'requester_email,addressee_email'
    })
    .select();

  if (error) {
    console.error('Error creating connection:', error);
    return;
  }

  console.log('✅ Friend connection created:');
  console.log(data);

  // Also create connection preferences for both users
  const { error: prefError } = await supabase.from('connection_preferences').upsert([
    {
      user_email: requester,
      friend_email: addressee,
      share_activity: true,
      share_sleep: true,
      share_stress: true,
    },
    {
      user_email: addressee,
      friend_email: requester,
      share_activity: true,
      share_sleep: true,
      share_stress: true,
    }
  ], { onConflict: 'user_email,friend_email' });

  if (prefError) {
    console.error('Error creating preferences:', prefError);
  } else {
    console.log('✅ Connection preferences created for both users');
  }
}

addFriend().catch(console.error);

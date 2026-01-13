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
  const email = 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(60));
  console.log(`OURA CONNECTION ANALYSIS: ${email}`);
  console.log('═'.repeat(60));

  // Check integration_tokens (direct OAuth)
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('*')
    .eq('user_email', email)
    .eq('provider', 'oura');

  console.log('\n1. integration_tokens (Direct OAuth):');
  if (tokens?.length) {
    tokens.forEach(t => {
      console.log(`   Provider: ${t.provider}`);
      console.log(`   Active: ${t.is_active}`);
      console.log(`   Has access token: ${!!t.access_token}`);
      console.log(`   Has refresh token: ${!!t.refresh_token}`);
      console.log(`   Expires: ${t.expires_at}`);
    });
  } else {
    console.log('   None found');
  }

  // Check user_connectors (Vital)
  const { data: connectors } = await supabase
    .from('user_connectors')
    .select('*')
    .eq('user_email', email);

  console.log('\n2. user_connectors (Vital):');
  if (connectors?.length) {
    connectors.forEach(c => {
      console.log(`   Connector: ${c.connector_name}`);
      console.log(`   Connected: ${c.is_connected}`);
    });
  } else {
    console.log('   None found');
  }

  // Check oura_data table
  const { data: ouraData } = await supabase
    .from('oura_data')
    .select('*')
    .eq('email', email)
    .order('sync_date', { ascending: false })
    .limit(3);

  console.log('\n3. oura_data table:');
  if (ouraData?.length) {
    ouraData.forEach(o => {
      console.log(`   Sync: ${o.sync_date}`);
      console.log(`   Period: ${o.start_date} to ${o.end_date}`);
    });
  } else {
    console.log('   No data stored');
  }

  // Compare with sofian
  console.log('\n' + '─'.repeat(60));
  console.log('COMPARISON WITH sofian@moccet.com:');
  console.log('─'.repeat(60));

  const { data: sofianTokens } = await supabase
    .from('integration_tokens')
    .select('provider, is_active')
    .eq('user_email', 'sofian@moccet.com');

  console.log('\nSofian integration_tokens:', sofianTokens?.map(t => `${t.provider}(${t.is_active ? 'active' : 'inactive'})`).join(', '));

  const { data: sofianConnectors } = await supabase
    .from('user_connectors')
    .select('connector_name, is_connected')
    .eq('user_email', 'sofian@moccet.com');

  console.log('Sofian user_connectors:', sofianConnectors?.map(c => `${c.connector_name}(${c.is_connected})`).join(', '));

  // Check vital_webhook_events for both users
  console.log('\n' + '─'.repeat(60));
  console.log('VITAL WEBHOOK EVENTS:');
  console.log('─'.repeat(60));

  const { data: vitalEvents } = await supabase
    .from('vital_webhook_events')
    .select('user_email, event_type, provider, received_at')
    .order('received_at', { ascending: false })
    .limit(10);

  if (vitalEvents?.length) {
    vitalEvents.forEach(e => {
      console.log(`   ${e.user_email}: ${e.event_type} (${e.provider}) - ${new Date(e.received_at).toLocaleString()}`);
    });
  } else {
    console.log('   No recent events');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('DIAGNOSIS:');
  console.log('═'.repeat(60));

  if (tokens?.length && !connectors?.length) {
    console.log('\n⚠️  User has Oura via DIRECT OAuth (integration_tokens)');
    console.log('   but fetchOuraData() only checks Vital connections (user_connectors)!');
    console.log('\n   SOLUTION: Need to either:');
    console.log('   1. Add direct Oura API fetcher for integration_tokens');
    console.log('   2. Or migrate user to Vital connection');
  }
}

check().catch(console.error);

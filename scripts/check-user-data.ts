#!/usr/bin/env npx tsx
/**
 * Check all data for a specific user
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    console.warn('Warning: Could not load .env.local file');
  }
}

loadEnv();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const email = process.argv[2] || 'sofian@moccet.com';

async function checkData() {
  console.log(`\n🔍 Checking all data for: ${email}\n`);
  console.log('='.repeat(70));

  // 1. Integration Tokens
  console.log('\n📱 INTEGRATION TOKENS (what\'s connected)');
  console.log('-'.repeat(50));
  const { data: tokens, error: tokensErr } = await supabase
    .from('integration_tokens')
    .select('provider, is_active, created_at, updated_at')
    .eq('user_email', email);

  if (tokensErr) console.log('  Error:', tokensErr.message);
  else if (!tokens?.length) console.log('  No tokens found');
  else {
    for (const t of tokens) {
      console.log(`  ${t.is_active ? '✅' : '❌'} ${t.provider.padEnd(12)} | Created: ${new Date(t.created_at).toLocaleDateString()} | Updated: ${new Date(t.updated_at).toLocaleDateString()}`);
    }
  }

  // 2. Whoop data - check multiple tables
  console.log('\n💪 WHOOP DATA');
  console.log('-'.repeat(50));

  // whoop_cycles
  const { data: whoopCycles, count: whoopCyclesCount } = await supabase
    .from('whoop_cycles')
    .select('*', { count: 'exact' })
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(3);
  console.log(`  whoop_cycles: ${whoopCyclesCount ?? 0} records`);
  if (whoopCycles?.length) {
    console.log(`    Latest: ${JSON.stringify(whoopCycles[0], null, 2).substring(0, 200)}...`);
  }

  // forge_training_data (provider=whoop)
  const { data: forgeWhoop, count: forgeWhoopCount } = await supabase
    .from('forge_training_data')
    .select('*', { count: 'exact' })
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('created_at', { ascending: false })
    .limit(1);
  console.log(`  forge_training_data (whoop): ${forgeWhoopCount ?? 0} records`);
  if (forgeWhoop?.length) {
    console.log(`    Latest: recovery_score=${forgeWhoop[0].recovery_score}, data_points=${forgeWhoop[0].data_points_analyzed}`);
  }

  // whoop_webhook_events
  const { count: webhookCount } = await supabase
    .from('whoop_webhook_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', email);
  console.log(`  whoop_webhook_events: ${webhookCount ?? 0} records`);

  // 3. Gmail data
  console.log('\n📧 GMAIL DATA');
  console.log('-'.repeat(50));

  const { data: behavioralGmail, count: behavioralGmailCount } = await supabase
    .from('behavioral_patterns')
    .select('*', { count: 'exact' })
    .eq('email', email)
    .eq('source', 'gmail')
    .order('created_at', { ascending: false })
    .limit(1);
  console.log(`  behavioral_patterns (gmail): ${behavioralGmailCount ?? 0} records`);
  if (behavioralGmail?.length) {
    console.log(`    Latest: ${new Date(behavioralGmail[0].created_at).toLocaleString()}`);
    console.log(`    Data: ${JSON.stringify(behavioralGmail[0].patterns || behavioralGmail[0]).substring(0, 300)}...`);
  }

  // 4. Slack data
  console.log('\n💬 SLACK DATA');
  console.log('-'.repeat(50));

  const { data: behavioralSlack, count: behavioralSlackCount } = await supabase
    .from('behavioral_patterns')
    .select('*', { count: 'exact' })
    .eq('email', email)
    .eq('source', 'slack')
    .order('created_at', { ascending: false })
    .limit(1);
  console.log(`  behavioral_patterns (slack): ${behavioralSlackCount ?? 0} records`);
  if (behavioralSlack?.length) {
    console.log(`    Latest: ${new Date(behavioralSlack[0].created_at).toLocaleString()}`);
    console.log(`    Data: ${JSON.stringify(behavioralSlack[0].patterns || behavioralSlack[0]).substring(0, 300)}...`);
  }

  // 5. Outlook data
  console.log('\n📬 OUTLOOK DATA');
  console.log('-'.repeat(50));

  const { data: behavioralOutlook, count: behavioralOutlookCount } = await supabase
    .from('behavioral_patterns')
    .select('*', { count: 'exact' })
    .eq('email', email)
    .eq('source', 'outlook')
    .order('created_at', { ascending: false })
    .limit(1);
  console.log(`  behavioral_patterns (outlook): ${behavioralOutlookCount ?? 0} records`);
  if (behavioralOutlook?.length) {
    console.log(`    Latest: ${new Date(behavioralOutlook[0].created_at).toLocaleString()}`);
  }

  // 6. Spotify data
  console.log('\n🎵 SPOTIFY DATA');
  console.log('-'.repeat(50));

  // Check multiple possible tables
  const spotifyTables = ['spotify_data', 'spotify_listening', 'behavioral_patterns'];

  for (const table of spotifyTables) {
    try {
      if (table === 'behavioral_patterns') {
        const { data, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .eq('email', email)
          .eq('source', 'spotify')
          .limit(1);
        console.log(`  ${table} (spotify): ${count ?? 0} records`);
        if (data?.length) {
          console.log(`    Data: ${JSON.stringify(data[0]).substring(0, 200)}...`);
        }
      } else {
        const { data, count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .eq('email', email)
          .limit(1);
        if (!error) {
          console.log(`  ${table}: ${count ?? 0} records`);
          if (data?.length) {
            console.log(`    Data: ${JSON.stringify(data[0]).substring(0, 200)}...`);
          }
        }
      }
    } catch (e) {
      // Table might not exist
    }
  }

  // 7. Check all behavioral_patterns sources
  console.log('\n📊 ALL BEHAVIORAL PATTERNS');
  console.log('-'.repeat(50));

  const { data: allPatterns } = await supabase
    .from('behavioral_patterns')
    .select('source, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false });

  if (allPatterns?.length) {
    const bySrc: Record<string, number> = {};
    for (const p of allPatterns) {
      bySrc[p.source] = (bySrc[p.source] || 0) + 1;
    }
    for (const [src, cnt] of Object.entries(bySrc)) {
      console.log(`  ${src}: ${cnt} records`);
    }
  } else {
    console.log('  No behavioral patterns found');
  }

  // 8. Check ecosystem cache
  console.log('\n🗄️ ECOSYSTEM CACHE');
  console.log('-'.repeat(50));

  const { data: ecosystemCache } = await supabase
    .from('ecosystem_context_cache')
    .select('*')
    .eq('email', email)
    .single();

  if (ecosystemCache) {
    console.log(`  Cache exists: ✅`);
    console.log(`  Last updated: ${ecosystemCache.updated_at}`);
    console.log(`  Is valid: ${ecosystemCache.is_valid}`);
    console.log(`  Context preview: ${JSON.stringify(ecosystemCache.context_data || {}).substring(0, 300)}...`);
  } else {
    console.log('  No ecosystem cache found');
  }

  // 9. Sync status
  console.log('\n🔄 SYNC STATUS');
  console.log('-'.repeat(50));

  const { data: onboardingData } = await supabase
    .from('sage_onboarding_data')
    .select('last_ecosystem_sync, ecosystem_context_cache')
    .eq('email', email)
    .single();

  if (onboardingData) {
    console.log(`  last_ecosystem_sync: ${onboardingData.last_ecosystem_sync || 'NULL'}`);
    console.log(`  has ecosystem_context_cache: ${onboardingData.ecosystem_context_cache ? 'Yes' : 'No'}`);
  }

  const { data: forgeOnboarding } = await supabase
    .from('forge_onboarding_data')
    .select('last_ecosystem_sync')
    .eq('email', email)
    .single();

  if (forgeOnboarding) {
    console.log(`  forge last_ecosystem_sync: ${forgeOnboarding.last_ecosystem_sync || 'NULL'}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('Done!\n');
}

checkData().catch(console.error);

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

async function checkDeepData() {
  const email = 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(70));
  console.log(`DEEP DATA CHECK: ${email}`);
  console.log('═'.repeat(70));

  // 1. Apple Health
  console.log('\n🍎 APPLE HEALTH DATA:');
  console.log('─'.repeat(70));

  const { data: appleHealth } = await supabase
    .from('user_health_data')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(5);

  if (appleHealth?.length) {
    console.log(`Found ${appleHealth.length} records`);
    appleHealth.forEach(h => {
      console.log(`\n  Date: ${new Date(h.created_at).toLocaleString()}`);
      console.log(`  Steps: ${h.steps || 'N/A'}`);
      console.log(`  Sleep: ${h.sleep_hours || 'N/A'} hours`);
      console.log(`  HRV: ${h.hrv || 'N/A'}`);
      console.log(`  Active calories: ${h.active_calories || 'N/A'}`);
    });
  } else {
    console.log('❌ No Apple Health data found');

    // Check if they have Apple Health connected
    const { data: appleToken } = await supabase
      .from('integration_tokens')
      .select('*')
      .eq('user_email', email)
      .ilike('provider', '%apple%');

    console.log(`   Apple Health token: ${appleToken?.length ? 'Found' : 'Not connected'}`);
  }

  // 2. Deep Content Analysis (Slack)
  console.log('\n\n📧 DEEP CONTENT ANALYSIS:');
  console.log('─'.repeat(70));

  const { data: deepContent } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(3);

  if (deepContent?.length) {
    deepContent.forEach(d => {
      console.log(`\nSource: ${d.source} | ${new Date(d.created_at).toLocaleString()}`);
      console.log(`  Pending tasks: ${d.pending_tasks?.length || 0}`);
      console.log(`  Response debt: ${d.response_debt?.count || 0}`);
      console.log(`  Key people: ${d.key_people?.length || 0}`);
      if (d.pending_tasks?.length) {
        console.log('  Sample tasks:');
        d.pending_tasks.slice(0, 3).forEach((t: any) => {
          console.log(`    - ${t.description?.substring(0, 50)}...`);
        });
      }
    });
  } else {
    console.log('❌ No deep content analysis stored');
  }

  // 3. Check behavioral patterns freshness
  console.log('\n\n📊 BEHAVIORAL PATTERNS FRESHNESS:');
  console.log('─'.repeat(70));

  const { data: patterns } = await supabase
    .from('behavioral_patterns')
    .select('source, sync_date, data_period_start, data_period_end, data_points_analyzed')
    .eq('email', email)
    .order('sync_date', { ascending: false });

  if (patterns?.length) {
    const now = new Date();
    patterns.forEach(p => {
      const syncDate = new Date(p.sync_date);
      const hoursSince = Math.round((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60));
      const status = hoursSince < 24 ? '✅' : hoursSince < 48 ? '🟡' : '🔴';
      console.log(`\n${status} ${p.source.toUpperCase()}`);
      console.log(`   Last sync: ${syncDate.toLocaleString()} (${hoursSince} hours ago)`);
      console.log(`   Data period: ${p.data_period_start} to ${p.data_period_end}`);
      console.log(`   Points analyzed: ${p.data_points_analyzed}`);
    });
  }

  // 4. Check what the cron fetches
  console.log('\n\n🔄 DATA SYNC STATUS:');
  console.log('─'.repeat(70));

  // Gmail fetch endpoint status
  const { data: gmailToken } = await supabase
    .from('integration_tokens')
    .select('updated_at, expires_at, is_active')
    .eq('user_email', email)
    .eq('provider', 'gmail')
    .single();

  if (gmailToken) {
    const expires = new Date(gmailToken.expires_at);
    const isExpired = expires < new Date();
    console.log(`\nGmail token: ${gmailToken.is_active ? '🟢 Active' : '🔴 Inactive'}`);
    console.log(`  Expires: ${expires.toLocaleString()} ${isExpired ? '❌ EXPIRED' : '✅'}`);
  }

  const { data: slackToken } = await supabase
    .from('integration_tokens')
    .select('updated_at, expires_at, is_active')
    .eq('user_email', email)
    .eq('provider', 'slack')
    .single();

  if (slackToken) {
    console.log(`\nSlack token: ${slackToken.is_active ? '🟢 Active' : '🔴 Inactive'}`);
    console.log(`  Expires: ${slackToken.expires_at || 'Never'}`);
  }

  // 5. Compare with sofian
  console.log('\n\n📈 COMPARISON WITH sofian@moccet.com:');
  console.log('─'.repeat(70));

  const { data: sofianPatterns } = await supabase
    .from('behavioral_patterns')
    .select('source, sync_date')
    .eq('email', 'sofian@moccet.com')
    .order('sync_date', { ascending: false })
    .limit(2);

  if (sofianPatterns?.length) {
    sofianPatterns.forEach(p => {
      const hoursSince = Math.round((new Date().getTime() - new Date(p.sync_date).getTime()) / (1000 * 60 * 60));
      console.log(`  ${p.source}: synced ${hoursSince} hours ago`);
    });
  }

  const { data: sofianDeep } = await supabase
    .from('deep_content_analysis')
    .select('source, created_at')
    .eq('email', 'sofian@moccet.com')
    .order('created_at', { ascending: false })
    .limit(2);

  console.log(`  Deep content: ${sofianDeep?.length || 0} records`);

  console.log('\n' + '═'.repeat(70));
}

checkDeepData().catch(console.error);

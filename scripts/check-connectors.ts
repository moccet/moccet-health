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

async function checkConnectors() {
  const email = process.argv[2] || 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(80));
  console.log(`DEEP DATA & CONNECTOR ANALYSIS FOR: ${email}`);
  console.log('═'.repeat(80));

  // 1. Check integration tokens
  console.log('\n📡 INTEGRATION TOKENS:');
  console.log('─'.repeat(80));

  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('*')
    .eq('user_email', email);

  if (tokens?.length) {
    for (const t of tokens) {
      const status = t.is_active ? '🟢 Active' : '🔴 Inactive';
      const expires = t.expires_at ? new Date(t.expires_at).toLocaleString() : 'No expiry';
      const updated = t.updated_at ? new Date(t.updated_at).toLocaleString() : 'Never';
      console.log(`\n${status} ${t.provider.toUpperCase()}`);
      console.log(`   Token expires: ${expires}`);
      console.log(`   Last updated: ${updated}`);
      console.log(`   Has refresh token: ${t.refresh_token ? 'Yes' : 'No'}`);
    }
  } else {
    console.log('No integration tokens found');
  }

  // 2. Check behavioral patterns (Slack/Gmail data)
  console.log('\n\n📊 BEHAVIORAL PATTERNS (Slack/Gmail):');
  console.log('─'.repeat(80));

  const { data: patterns } = await supabase
    .from('behavioral_patterns')
    .select('*')
    .eq('email', email)
    .order('sync_date', { ascending: false });

  if (patterns?.length) {
    for (const p of patterns) {
      const syncDate = new Date(p.sync_date).toLocaleString();
      const dataStart = p.data_period_start;
      const dataEnd = p.data_period_end;
      console.log(`\n🔹 ${p.source.toUpperCase()}`);
      console.log(`   Last sync: ${syncDate}`);
      console.log(`   Data period: ${dataStart} to ${dataEnd}`);
      console.log(`   Data points analyzed: ${p.data_points_analyzed}`);
      console.log(`   Metrics: ${JSON.stringify(p.metrics)}`);
      if (p.patterns?.insights?.length) {
        console.log(`   Key insights:`);
        p.patterns.insights.slice(0, 3).forEach((i: string) => console.log(`     - ${i}`));
      }
    }
  } else {
    console.log('No behavioral patterns found');
  }

  // 3. Check Oura/Vital data
  console.log('\n\n🔮 OURA / VITAL DATA:');
  console.log('─'.repeat(80));

  const { data: vitalData } = await supabase
    .from('vital_data')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(5);

  if (vitalData?.length) {
    vitalData.forEach(v => {
      console.log(`\n${v.provider}: ${new Date(v.created_at).toLocaleString()}`);
      console.log(`   Data: ${JSON.stringify(v.data).substring(0, 200)}...`);
    });
  } else {
    console.log('No Vital data found');
  }

  // Check user_health_data (Apple Health / Oura)
  const { data: healthData } = await supabase
    .from('user_health_data')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n\n🍎 APPLE HEALTH / USER HEALTH DATA:');
  console.log('─'.repeat(80));

  if (healthData?.length) {
    healthData.forEach(h => {
      console.log(`\nDate: ${new Date(h.created_at).toLocaleString()}`);
      console.log(`   Steps: ${h.steps || 'N/A'}`);
      console.log(`   Sleep: ${h.sleep_hours || 'N/A'} hours`);
      console.log(`   HRV: ${h.hrv || 'N/A'}`);
    });
  } else {
    console.log('No Apple Health data found');
  }

  // 4. Check Whoop data
  console.log('\n\n💪 WHOOP DATA:');
  console.log('─'.repeat(80));

  const { data: whoopData } = await supabase
    .from('forge_training_data')
    .select('*')
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('sync_date', { ascending: false })
    .limit(3);

  if (whoopData?.length) {
    whoopData.forEach(w => {
      console.log(`\nSync date: ${new Date(w.sync_date).toLocaleString()}`);
      console.log(`   Recovery: ${JSON.stringify(w.recovery_score)}`);
      console.log(`   HRV: ${JSON.stringify(w.hrv_trends)}`);
    });
  } else {
    console.log('No Whoop data found');
  }

  // 5. Check Spotify data
  console.log('\n\n🎵 SPOTIFY DATA:');
  console.log('─'.repeat(80));

  const { data: spotifyData } = await supabase
    .from('spotify_data')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(3);

  if (spotifyData?.length) {
    spotifyData.forEach(s => {
      console.log(`\nDate: ${new Date(s.created_at).toLocaleString()}`);
      console.log(`   Data: ${JSON.stringify(s).substring(0, 200)}...`);
    });
  } else {
    console.log('No Spotify data found');
  }

  // 6. Check deep content analysis
  console.log('\n\n🔍 DEEP CONTENT ANALYSIS:');
  console.log('─'.repeat(80));

  const { data: deepContent } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(3);

  if (deepContent?.length) {
    deepContent.forEach(d => {
      console.log(`\nSource: ${d.source} | Date: ${new Date(d.created_at).toLocaleString()}`);
      console.log(`   Pending tasks: ${d.pending_tasks?.length || 0}`);
      console.log(`   Response debt: ${d.response_debt?.count || 0}`);
      console.log(`   Key people: ${d.key_people?.length || 0}`);
    });
  } else {
    console.log('No deep content analysis found');
  }

  // 7. Check lab results
  console.log('\n\n🧪 LAB RESULTS:');
  console.log('─'.repeat(80));

  const { data: onboarding } = await supabase
    .from('sage_onboarding_data')
    .select('lab_file_analysis, updated_at')
    .eq('email', email)
    .maybeSingle();

  if (onboarding?.lab_file_analysis) {
    const labs = onboarding.lab_file_analysis;
    console.log(`Last updated: ${onboarding.updated_at ? new Date(onboarding.updated_at).toLocaleString() : 'Unknown'}`);
    console.log(`Biomarkers: ${labs.biomarkers?.length || 0}`);
    if (labs.biomarkers?.length) {
      console.log('\nKey biomarkers:');
      labs.biomarkers.slice(0, 10).forEach((b: any) => {
        const status = b.status === 'high' ? '↑' : b.status === 'low' ? '↓' : '✓';
        console.log(`   ${status} ${b.name}: ${b.value} ${b.unit || ''}`);
      });
    }
  } else {
    console.log('No lab results found');
  }

  // 8. Summary
  console.log('\n\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));

  const activeTokens = tokens?.filter(t => t.is_active) || [];
  console.log(`\n✅ Active integrations: ${activeTokens.map(t => t.provider).join(', ') || 'None'}`);
  console.log(`📊 Behavioral patterns: ${patterns?.length || 0} records`);
  console.log(`🍎 Health data records: ${healthData?.length || 0}`);
  console.log(`💪 Whoop records: ${whoopData?.length || 0}`);
  console.log(`🎵 Spotify records: ${spotifyData?.length || 0}`);
  console.log(`🔍 Deep content: ${deepContent?.length || 0} analyses`);
  console.log(`🧪 Biomarkers: ${onboarding?.lab_file_analysis?.biomarkers?.length || 0}`);

  // Check data freshness
  console.log('\n⏰ DATA FRESHNESS:');
  const now = new Date();

  if (patterns?.length) {
    const latestPattern = new Date(patterns[0].sync_date);
    const hoursSince = Math.round((now.getTime() - latestPattern.getTime()) / (1000 * 60 * 60));
    console.log(`   Behavioral patterns: ${hoursSince} hours ago`);
  }

  // Check for issues
  console.log('\n⚠️  POTENTIAL ISSUES:');

  if (!healthData?.length) {
    console.log('   - No Apple Health / Oura data synced');
  }
  if (!whoopData?.length) {
    console.log('   - No Whoop data (not connected or no sync)');
  }
  if (!spotifyData?.length) {
    console.log('   - No Spotify data synced');
  }
  if (!deepContent?.length) {
    console.log('   - No deep content analysis stored');
  }

  // Check token expiry
  const expiredTokens = tokens?.filter(t => {
    if (!t.expires_at) return false;
    return new Date(t.expires_at) < now;
  }) || [];

  if (expiredTokens.length) {
    console.log(`   - Expired tokens: ${expiredTokens.map(t => t.provider).join(', ')}`);
  }

  console.log('\n' + '═'.repeat(80));
}

checkConnectors().catch(console.error);

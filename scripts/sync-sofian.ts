import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envFile = readFileSync(envPath, 'utf-8');

envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
  }
});

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = 'https://www.moccet.ai';

async function syncSofian() {
  const email = 'sofian@moccet.com';

  console.log('═'.repeat(70));
  console.log(`SYNC & CHECK FOR: ${email}`);
  console.log('═'.repeat(70));

  // Check current deep content state
  console.log('\n📊 CURRENT DEEP CONTENT:');
  const { data: currentDeep } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('user_email', email)
    .order('analyzed_at', { ascending: false });

  if (currentDeep?.length) {
    currentDeep.forEach(d => {
      console.log(`\n   ${d.source.toUpperCase()}:`);
      console.log(`   Last analyzed: ${d.analyzed_at}`);
      console.log(`   Pending tasks: ${d.pending_tasks?.length || 0}`);
      console.log(`   Response debt: ${d.response_debt?.count || 0}`);
      console.log(`   Urgent messages: ${d.urgent_messages?.length || 0}`);
      if (d.urgent_messages?.length) {
        console.log('   Urgent:');
        d.urgent_messages.slice(0, 3).forEach((m: any) => {
          console.log(`     - ${m.summary?.substring(0, 60) || m.from}...`);
        });
      }
    });
  }

  // Check subscription tier
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('tier, status')
    .eq('user_email', email)
    .maybeSingle();

  console.log(`\n📋 Subscription: ${sub?.tier || 'free'} (${sub?.status || 'none'})`);

  // Sync Slack
  console.log('\n📡 Syncing Slack...');
  try {
    const slackRes = await fetch(`${BASE_URL}/api/slack/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const slackData = await slackRes.json();
    console.log(`   Status: ${slackRes.status}`);
    if (slackData.patterns) {
      console.log(`   Data points: ${slackData.patterns.dataPointsAnalyzed}`);
    }
    if (slackData.deepAnalysis) {
      console.log(`   Deep: ${slackData.deepAnalysis.pendingTasks?.length || 0} tasks, ${slackData.deepAnalysis.urgentMessages?.length || 0} urgent`);
    }
    if (slackData.error) console.log(`   Error: ${slackData.error}`);
  } catch (e: any) {
    console.log(`   Error: ${e.message}`);
  }

  // Sync Gmail
  console.log('\n📧 Syncing Gmail...');
  try {
    const gmailRes = await fetch(`${BASE_URL}/api/gmail/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const gmailData = await gmailRes.json();
    console.log(`   Status: ${gmailRes.status}`);
    if (gmailData.patterns) {
      console.log(`   Data points: ${gmailData.patterns.dataPointsAnalyzed}`);
    }
    if (gmailData.deepAnalysis) {
      console.log(`   Deep: ${gmailData.deepAnalysis.pendingTasks?.length || 0} tasks, ${gmailData.deepAnalysis.urgentMessages?.length || 0} urgent`);
    }
    if (gmailData.error) console.log(`   Error: ${gmailData.error}`);
  } catch (e: any) {
    console.log(`   Error: ${e.message}`);
  }

  // Check updated deep content
  console.log('\n📊 UPDATED DEEP CONTENT:');
  const { data: newDeep } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('user_email', email)
    .order('analyzed_at', { ascending: false });

  if (newDeep?.length) {
    newDeep.forEach(d => {
      console.log(`\n   ${d.source.toUpperCase()}:`);
      console.log(`   Last analyzed: ${d.analyzed_at}`);
      console.log(`   Pending tasks: ${d.pending_tasks?.length || 0}`);
      console.log(`   Urgent messages: ${d.urgent_messages?.length || 0}`);
      if (d.pending_tasks?.length) {
        console.log('   Tasks:');
        d.pending_tasks.slice(0, 5).forEach((t: any) => {
          console.log(`     - [${t.urgency}] ${t.description?.substring(0, 50)}...`);
        });
      }
      if (d.urgent_messages?.length) {
        console.log('   Urgent:');
        d.urgent_messages.slice(0, 5).forEach((m: any) => {
          console.log(`     - ${m.summary?.substring(0, 60) || m.from}...`);
        });
      }
    });
  }

  // Search for "flu" in recent messages or analysis
  console.log('\n🔍 Searching for "flu" in content...');
  const { data: allDeep } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('user_email', email);

  let foundFlu = false;
  allDeep?.forEach(d => {
    const content = JSON.stringify(d).toLowerCase();
    if (content.includes('flu') || content.includes('sick') || content.includes('ill')) {
      foundFlu = true;
      console.log(`   Found health-related content in ${d.source}!`);
    }
  });

  if (!foundFlu) {
    console.log('   No "flu" or health-related content found in deep analysis');
  }

  console.log('\n' + '═'.repeat(70));
}

syncSofian().catch(console.error);

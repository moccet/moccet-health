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
const searchEmail = 'hvdvpjyp2z';

async function findUser() {
  // Search sage_onboarding_data with LIKE
  const { data: onboarding } = await supabase
    .from('sage_onboarding_data')
    .select('email, subscription_tier, subscription_status, lab_file_analysis')
    .ilike('email', `%${searchEmail}%`);

  console.log('=== SAGE_ONBOARDING (like search) ===');
  if (onboarding?.length) {
    onboarding.forEach(o => {
      console.log('Email:', o.email);
      console.log('Subscription tier:', o.subscription_tier);
      console.log('Subscription status:', o.subscription_status);
      console.log('Has labs:', !!o.lab_file_analysis);
      if (o.lab_file_analysis?.biomarkers) {
        console.log('Biomarkers:', o.lab_file_analysis.biomarkers.length);
      }
      console.log('---');
    });
  } else {
    console.log('Not found');
  }

  // Check integration_tokens
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('user_email, provider, is_active')
    .ilike('user_email', `%${searchEmail}%`);

  console.log('\n=== INTEGRATION TOKENS ===');
  if (tokens?.length) {
    tokens.forEach(t => {
      console.log('Email:', t.user_email);
      console.log('Provider:', t.provider, '| Active:', t.is_active);
    });
  } else {
    console.log('Not found');
  }

  // Check behavioral_patterns
  const { data: behavioral } = await supabase
    .from('behavioral_patterns')
    .select('email, pattern_type, pattern_data, updated_at')
    .ilike('email', `%${searchEmail}%`);

  console.log('\n=== BEHAVIORAL PATTERNS ===');
  if (behavioral?.length) {
    behavioral.forEach(b => {
      console.log('Type:', b.pattern_type);
      console.log('Data:', JSON.stringify(b.pattern_data).substring(0, 200));
    });
  } else {
    console.log('Not found');
  }

  // Check real_time_insights
  const { data: insights } = await supabase
    .from('real_time_insights')
    .select('*')
    .ilike('email', `%${searchEmail}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n=== RECENT INSIGHTS (last 10) ===');
  if (insights?.length) {
    insights.forEach((i, idx) => {
      console.log(`\n${idx + 1}. [${i.insight_type}] ${i.title}`);
      console.log(`   Source: ${i.source_provider} | Severity: ${i.severity}`);
      console.log(`   Created: ${new Date(i.created_at).toLocaleString()}`);
      console.log(`   Message: ${i.message?.substring(0, 200)}...`);
      if (i.actionable_recommendation) {
        console.log(`   Action: ${i.actionable_recommendation.substring(0, 150)}...`);
      }
      if (i.context_data) {
        console.log(`   Context: ${JSON.stringify(i.context_data).substring(0, 150)}...`);
      }
    });
  } else {
    console.log('Not found');
  }

  // Check users table too
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .ilike('email', `%${searchEmail}%`);

  console.log('\n=== USERS TABLE ===');
  if (users?.length) {
    users.forEach(u => {
      console.log('User ID:', u.id);
      console.log('Email:', u.email);
      console.log('Subscription tier:', u.subscription_tier);
      console.log('Subscription status:', u.subscription_status);
    });
  } else {
    console.log('Not found in users table');
  }

  // Check subscriptions table
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
    .ilike('user_email', `%${searchEmail}%`);

  console.log('\n=== SUBSCRIPTIONS TABLE ===');
  if (subs?.length) {
    subs.forEach(s => {
      console.log(JSON.stringify(s, null, 2));
    });
  } else {
    console.log('Not found');
  }

  // Check revenuecat_subscriptions
  const { data: rc } = await supabase
    .from('revenuecat_subscriptions')
    .select('*')
    .ilike('app_user_id', `%${searchEmail}%`);

  console.log('\n=== REVENUECAT SUBSCRIPTIONS ===');
  if (rc?.length) {
    rc.forEach(s => {
      console.log(JSON.stringify(s, null, 2));
    });
  } else {
    console.log('Not found');
  }

  // Check user_subscriptions table (the correct one!)
  const { data: userSubs } = await supabase
    .from('user_subscriptions')
    .select('*')
    .ilike('user_email', `%${searchEmail}%`);

  console.log('\n=== USER_SUBSCRIPTIONS TABLE ===');
  if (userSubs?.length) {
    userSubs.forEach(s => {
      console.log(JSON.stringify(s, null, 2));
    });
  } else {
    console.log('Not found');
  }

  // Check all user_subscriptions to see who has gold/max
  const { data: allSubs } = await supabase
    .from('user_subscriptions')
    .select('user_email, tier, status, current_period_end')
    .in('tier', ['max', 'gold', 'pro'])
    .eq('status', 'active')
    .limit(10);

  console.log('\n=== SAMPLE ACTIVE PRO/MAX SUBSCRIPTIONS ===');
  if (allSubs?.length) {
    allSubs.forEach(s => {
      console.log(`${s.user_email} | tier: ${s.tier} | status: ${s.status} | ends: ${s.current_period_end}`);
    });
  } else {
    console.log('No pro/max subscriptions found');
  }
}

findUser().catch(console.error);

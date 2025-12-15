/**
 * Data Source Diagnostic Tool
 * Checks what health data is available for a user
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE credentials not found in .env.local');
  console.error('Expected:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDataSources(email: string) {
  console.log(`\n🔍 Checking data sources for ${email}...\n`);
  console.log('━'.repeat(60));

  // Check Whoop data
  const { data: whoopData, error: whoopError } = await supabase
    .from('forge_training_data')
    .select('*')
    .eq('email', email)
    .eq('provider', 'whoop');

  const whoopStatus = whoopData && whoopData.length > 0 ? '✅' : '❌';
  console.log(`${whoopStatus} Whoop Data: ${whoopData?.length || 0} records`);
  if (whoopError) console.log(`   Error: ${whoopError.message}`);

  // Check blood tests
  const { data: bloodData, error: bloodError } = await supabase
    .from('sage_onboarding_data')
    .select('lab_file_analysis, email')
    .eq('email', email)
    .single();

  const hasBloodData = bloodData?.lab_file_analysis != null;
  const bloodStatus = hasBloodData ? '✅' : '❌';
  console.log(`${bloodStatus} Blood Tests: ${hasBloodData ? 'Available' : 'Not found'}`);
  if (bloodError && bloodError.code !== 'PGRST116') {
    console.log(`   Error: ${bloodError.message}`);
  }
  if (hasBloodData) {
    const biomarkers = (bloodData.lab_file_analysis as any)?.biomarkers || [];
    console.log(`   → ${biomarkers.length} biomarkers analyzed`);
  }

  // Check Oura (Apple Health alternative)
  const { data: ouraData } = await supabase
    .from('user_health_data')
    .select('*')
    .eq('email', email)
    .limit(1);

  const ouraStatus = ouraData && ouraData.length > 0 ? '✅' : '❌';
  console.log(`${ouraStatus} Apple Health/Oura: ${ouraData && ouraData.length > 0 ? 'Available' : 'Not found'}`);

  // Check Vital webhooks
  const { data: vitalEvents } = await supabase
    .from('vital_webhook_events')
    .select('event_type, provider, received_at')
    .order('received_at', { ascending: false })
    .limit(5);

  console.log(`\n📡 Recent Vital Webhooks: ${vitalEvents?.length || 0} events`);
  vitalEvents?.forEach(event => {
    const date = new Date(event.received_at).toLocaleString();
    console.log(`   - ${event.event_type} (${event.provider}) at ${date}`);
  });

  // Check integration tokens
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('provider, is_active, created_at')
    .eq('user_email', email);

  console.log(`\n🔗 Connected Integrations:`);
  if (tokens && tokens.length > 0) {
    tokens.forEach(t => {
      const status = t.is_active ? '🟢' : '🔴';
      console.log(`   ${status} ${t.provider}`);
    });
  } else {
    console.log('   No integrations found');
  }

  // Check recent insights
  const { data: insights } = await supabase
    .from('real_time_insights')
    .select('insight_type, source_provider, severity, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\n💡 Recent Insights Generated: ${insights?.length || 0}`);
  if (insights && insights.length > 0) {
    const sourceBreakdown = insights.reduce((acc, i) => {
      acc[i.source_provider] = (acc[i.source_provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      console.log(`   - ${source}: ${count} insights`);
    });
  } else {
    console.log('   No insights found');
  }

  console.log('\n' + '━'.repeat(60));
  console.log('\n📋 Summary:\n');

  if (!hasBloodData) {
    console.log('❌ Blood Test Missing:');
    console.log('   → Upload blood test PDF via app or API');
    console.log('   → Or insert sample data for testing\n');
  }

  if (!whoopData || whoopData.length === 0) {
    console.log('❌ Whoop Data Missing:');
    console.log('   → Connect Whoop via Vital integration');
    console.log('   → Verify Vital webhook is configured');
    console.log('   → Or insert sample data for testing\n');
  }

  if (hasBloodData && whoopData && whoopData.length > 0) {
    console.log('✅ All data sources connected!\n');
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'your-email@example.com';

checkDataSources(email)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });

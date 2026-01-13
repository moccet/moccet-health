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

async function checkMagnesium() {
  const email = 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(80));
  console.log(`ALL-TIME INSIGHTS FOR: ${email}`);
  console.log('═'.repeat(80));

  // Get ALL insights for this user
  const { data: allInsights, error } = await supabase
    .from('real_time_insights')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\nTotal insights (all time): ${allInsights?.length || 0}`);

  if (!allInsights?.length) {
    console.log('No insights found');
    return;
  }

  // Group by title
  const byTitle: Record<string, any[]> = {};
  allInsights.forEach(i => {
    const title = i.title || 'Unknown';
    if (!byTitle[title]) byTitle[title] = [];
    byTitle[title].push(i);
  });

  console.log('\n📊 ALL Insight Titles (with counts):');
  Object.entries(byTitle)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([title, insights]) => {
      const dates = insights.map(i => new Date(i.created_at).toLocaleDateString()).join(', ');
      console.log(`\n   "${title}" - ${insights.length} times`);
      console.log(`   Dates: ${dates}`);
      console.log(`   Source: ${insights[0].source_provider}`);
    });

  // Check for magnesium-related
  const magnesiumInsights = allInsights.filter(i =>
    i.title?.toLowerCase().includes('magnesium') ||
    i.message?.toLowerCase().includes('magnesium')
  );

  console.log('\n' + '─'.repeat(80));
  console.log('⚠️  MAGNESIUM-RELATED INSIGHTS:');
  console.log('─'.repeat(80));

  if (magnesiumInsights.length) {
    console.log(`Found ${magnesiumInsights.length} magnesium insights:\n`);
    magnesiumInsights.forEach((i, idx) => {
      console.log(`${idx + 1}. [${new Date(i.created_at).toLocaleString()}]`);
      console.log(`   Title: ${i.title}`);
      console.log(`   Type: ${i.insight_type} | Source: ${i.source_provider}`);
      console.log(`   Message: ${i.message?.substring(0, 200)}...`);
      console.log('');
    });
  } else {
    console.log('No magnesium insights found in database');
  }

  // Compare data availability
  console.log('\n' + '─'.repeat(80));
  console.log('DATA AVAILABILITY COMPARISON:');
  console.log('─'.repeat(80));

  // Check what data sources are available for both users
  for (const userEmail of [email, 'sofian@moccet.com']) {
    console.log(`\n${userEmail}:`);

    // Whoop
    const { data: whoop } = await supabase
      .from('forge_training_data')
      .select('id')
      .eq('email', userEmail)
      .eq('provider', 'whoop');
    console.log(`   Whoop records: ${whoop?.length || 0}`);

    // Behavioral patterns
    const { data: behavioral } = await supabase
      .from('behavioral_patterns')
      .select('source')
      .eq('email', userEmail);
    console.log(`   Behavioral patterns: ${behavioral?.length || 0} (${behavioral?.map(b => b.source).join(', ') || 'none'})`);

    // Lab results
    const { data: onboarding } = await supabase
      .from('sage_onboarding_data')
      .select('lab_file_analysis')
      .eq('email', userEmail)
      .maybeSingle();
    const biomarkers = onboarding?.lab_file_analysis?.biomarkers?.length || 0;
    console.log(`   Biomarkers: ${biomarkers}`);

    // Insights by source
    const { data: insights } = await supabase
      .from('real_time_insights')
      .select('source_provider')
      .eq('email', userEmail);

    const sources: Record<string, number> = {};
    insights?.forEach(i => {
      sources[i.source_provider] = (sources[i.source_provider] || 0) + 1;
    });
    console.log(`   Insight sources: ${JSON.stringify(sources)}`);
  }
}

checkMagnesium().catch(console.error);

/**
 * Test Insights Generation Script
 * Generates and displays insights for a user WITHOUT sending notifications
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import OpenAI from 'openai';

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

// Set env vars for OpenAI
process.env.OPENAI_API_KEY = envVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE credentials not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI();

// Tier configuration
const INSIGHT_TIER_CONFIG = {
  free: {
    insightCount: 2,
    includeDeepAnalysis: false,
    includeCorrelations: false,
    includePredictions: false,
    includeActionPlan: false,
    maxTokens: 800,
    model: 'gpt-4o-mini',
  },
  pro: {
    insightCount: 4,
    includeDeepAnalysis: true,
    includeCorrelations: true,
    includePredictions: true,
    includeActionPlan: true,
    maxTokens: 2000,
    model: 'gpt-4o',
  },
  max: {
    insightCount: 6,
    includeDeepAnalysis: true,
    includeCorrelations: true,
    includePredictions: true,
    includeActionPlan: true,
    maxTokens: 4000,
    model: 'gpt-4o',
  },
};

async function getUserSubscriptionTier(email: string): Promise<'free' | 'pro' | 'max'> {
  // Check user_subscriptions table (the correct one!)
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('tier, status, current_period_end')
    .eq('user_email', email)
    .maybeSingle();

  // If found and active with valid period, use it
  if (data?.tier && data?.status === 'active') {
    const periodEnd = data.current_period_end ? new Date(data.current_period_end) : null;
    if (!periodEnd || periodEnd > new Date()) {
      const tier = data.tier.toLowerCase();
      if (tier === 'max' || tier === 'gold') return 'max';
      if (tier === 'pro') return 'pro';
      return 'free';
    }
  }

  return 'free';
}

async function getExistingInsights(email: string) {
  const { data } = await supabase
    .from('real_time_insights')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(20);

  return data || [];
}

async function getUserContext(email: string) {
  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  // Get onboarding data (includes lab results)
  const { data: onboarding } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .eq('email', email)
    .single();

  // Get conversation history
  const { data: conversations } = await supabase
    .from('conversations')
    .select('messages')
    .eq('user_id', profile?.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Get integration tokens
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('provider, is_active')
    .eq('user_email', email);

  // Get learned facts
  const { data: facts } = await supabase
    .from('user_learned_facts')
    .select('*')
    .eq('user_email', email);

  return {
    profile,
    onboarding,
    labResults: onboarding?.lab_file_analysis?.biomarkers || [],
    conversations,
    tokens: tokens || [],
    learnedFacts: facts || [],
  };
}

async function getEcosystemData(email: string) {
  const data: Record<string, any> = {};

  // Get Apple Health data
  const { data: healthData } = await supabase
    .from('user_health_data')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(7);

  if (healthData?.length) {
    data.appleHealth = healthData;
  }

  // Get Whoop data
  const { data: whoopData } = await supabase
    .from('forge_training_data')
    .select('*')
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('created_at', { ascending: false })
    .limit(7);

  if (whoopData?.length) {
    data.whoop = whoopData;
  }

  // Get behavioral patterns
  const { data: behavioral } = await supabase
    .from('behavioral_patterns')
    .select('*')
    .eq('email', email)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (behavioral?.length) {
    data.behavioral = behavioral;
  }

  // Get Slack patterns
  const { data: slackData } = await supabase
    .from('slack_patterns')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (slackData?.length) {
    data.slack = slackData[0];
  }

  // Get Gmail patterns
  const { data: gmailData } = await supabase
    .from('gmail_patterns')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (gmailData?.length) {
    data.gmail = gmailData[0];
  }

  // Get Oura data (via integration_tokens + vital)
  const { data: ouraData } = await supabase
    .from('vital_data')
    .select('*')
    .eq('email', email)
    .eq('provider', 'oura')
    .order('created_at', { ascending: false })
    .limit(7);

  if (ouraData?.length) {
    data.oura = ouraData;
  }

  // Get Spotify data
  const { data: spotifyData } = await supabase
    .from('spotify_data')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(5);

  if (spotifyData?.length) {
    data.spotify = spotifyData;
  }

  // Get conversation history (for context)
  const { data: conversations } = await supabase
    .from('conversations')
    .select('messages, created_at')
    .eq('user_email', email)
    .order('created_at', { ascending: false })
    .limit(3);

  if (conversations?.length) {
    data.conversationHistory = conversations;
  }

  return data;
}

async function generateTestInsights(email: string, tier: 'free' | 'pro' | 'max', context: any, ecosystemData: any) {
  const config = INSIGHT_TIER_CONFIG[tier];

  console.log('\n🤖 Generating AI insights...\n');

  const systemPrompt = tier === 'free'
    ? `You are a supportive health coach. Generate ${config.insightCount} personalized insights based on the user's health data. Focus on positive, empowering language.`
    : `You are an expert wellness advisor with deep knowledge of health optimization. Generate ${config.insightCount} diverse, personalized insights.

CRITICAL: Insight Diversity Requirements
You MUST generate insights across DIFFERENT categories from this list:
1. Biometric & Physiological (HRV, recovery, strain)
2. Sleep & Recovery (sleep quality, duration, efficiency)
3. Activity & Movement (steps, workouts, exercise)
4. Stress & Resilience (stress indicators, mental load)
5. Mental Health & Cognitive (mood, focus, cognitive function)
6. Work-Life Integration (work patterns, calendar, communication)
7. Social & Relationship (social connections, communication patterns)
8. Nutrition & Metabolic (glucose, diet, energy levels)

For each insight include:
- Multi-source correlations connecting different data points
- Scientific basis for recommendations
- Specific, actionable steps with timing
- Predicted impact of following the recommendation

Frame all recommendations positively - focus on "unlocking potential" not "fixing problems".`;

  const userDataSummary = `
USER PROFILE:
${context.profile ? `Name: ${context.profile.first_name || 'Unknown'} ${context.profile.last_name || ''}
Email: ${email}
Subscription: ${tier.toUpperCase()}` : 'Profile not found'}

LAB RESULTS (${context.labResults?.length || 0} biomarkers):
${context.labResults?.slice(0, tier === 'max' ? 30 : 10).map((b: any) =>
  `- ${b.name}: ${b.value} ${b.unit || ''} (${b.status || 'normal'})`
).join('\n') || 'No lab results'}

LEARNED FACTS:
${context.learnedFacts?.map((f: any) => `- ${f.fact_value}`).join('\n') || 'None'}

CONNECTED INTEGRATIONS:
${context.tokens?.filter((t: any) => t.is_active).map((t: any) => `- ${t.provider}`).join('\n') || 'None'}

ECOSYSTEM DATA:
${ecosystemData.appleHealth ? `Apple Health: ${ecosystemData.appleHealth.length} days of data` : 'Apple Health: Not connected'}
${ecosystemData.whoop ? `Whoop: ${ecosystemData.whoop.length} records` : 'Whoop: Not connected'}
${ecosystemData.behavioral ? `Behavioral patterns: ${ecosystemData.behavioral.length} entries` : 'Behavioral: No data'}
${ecosystemData.slack ? `Slack: Connected with patterns` : 'Slack: Not connected'}
${ecosystemData.gmail ? `Gmail: Connected with patterns` : 'Gmail: Not connected'}

RECENT HEALTH DATA:
${JSON.stringify(ecosystemData.appleHealth?.slice(0, 3) || [], null, 2)}
${JSON.stringify(ecosystemData.whoop?.slice(0, 2) || [], null, 2)}
${ecosystemData.behavioral ? JSON.stringify(ecosystemData.behavioral.slice(0, 2), null, 2) : ''}
`;

  console.log('\n📋 User Data Summary being sent to AI:');
  console.log('─'.repeat(50));
  console.log(userDataSummary);
  console.log('─'.repeat(50));

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate ${config.insightCount} personalized health insights for this user:\n\n${userDataSummary}\n\nReturn as JSON object with format: {"insights": [{"title": "...", "message": "...", "category": "...", "severity": "high|medium|low", "actionable_recommendation": "..."}]}` }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    console.log('\n🤖 Raw AI Response:');
    console.log(content?.substring(0, 500) + '...');

    if (content) {
      const parsed = JSON.parse(content);
      return parsed.insights || [];
    }
  } catch (error: any) {
    console.error('Error generating insights:', error.message);
    console.error('Full error:', error);
  }

  return [];
}

async function main() {
  const email = process.argv[2] || 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('\n' + '═'.repeat(70));
  console.log('  MOCCET INSIGHTS TEST');
  console.log('  User: ' + email);
  console.log('═'.repeat(70));

  // Check subscription tier
  const tier = await getUserSubscriptionTier(email);
  console.log(`\n📊 Subscription Tier: ${tier.toUpperCase()}`);
  console.log(`   Config: ${JSON.stringify(INSIGHT_TIER_CONFIG[tier], null, 2)}`);

  // Get user context
  console.log('\n🔍 Fetching user context...');
  const context = await getUserContext(email);

  console.log(`   ✓ Profile: ${context.profile ? 'Found' : 'Not found'}`);
  console.log(`   ✓ Lab Results: ${context.labResults?.length || 0} biomarkers`);
  console.log(`   ✓ Integrations: ${context.tokens?.filter((t: any) => t.is_active).length || 0} active`);
  console.log(`   ✓ Learned Facts: ${context.learnedFacts?.length || 0}`);

  // Get ecosystem data
  console.log('\n📡 Fetching ecosystem data...');
  const ecosystemData = await getEcosystemData(email);

  Object.entries(ecosystemData).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      console.log(`   ✓ ${key}: ${value.length} records`);
    } else {
      console.log(`   ✓ ${key}: Available`);
    }
  });

  // Get existing insights
  console.log('\n💡 Existing Insights (last 20):');
  const existingInsights = await getExistingInsights(email);

  if (existingInsights.length === 0) {
    console.log('   No existing insights found');
  } else {
    existingInsights.forEach((insight, i) => {
      const date = new Date(insight.created_at).toLocaleDateString();
      const severity = insight.severity === 'high' ? '🔴' : insight.severity === 'medium' ? '🟡' : '🟢';
      console.log(`\n   ${i + 1}. ${severity} [${insight.insight_type}] ${insight.title}`);
      console.log(`      Source: ${insight.source_provider} | Date: ${date}`);
      console.log(`      Message: ${insight.message?.substring(0, 150)}...`);
      if (insight.actionable_recommendation) {
        console.log(`      Action: ${insight.actionable_recommendation.substring(0, 100)}...`);
      }
    });
  }

  // Generate new test insights
  console.log('\n' + '─'.repeat(70));
  console.log('GENERATING NEW INSIGHTS (NOT SAVING TO DB)');
  console.log('─'.repeat(70));

  const newInsights = await generateTestInsights(email, tier, context, ecosystemData);

  if (Array.isArray(newInsights) && newInsights.length > 0) {
    console.log(`\n✨ Generated ${newInsights.length} new insights:\n`);
    newInsights.forEach((insight: any, i: number) => {
      const severity = insight.severity === 'high' ? '🔴' : insight.severity === 'medium' ? '🟡' : '🟢';
      console.log(`${i + 1}. ${severity} [${insight.category || 'general'}] ${insight.title}`);
      console.log(`   ${insight.message}`);
      if (insight.actionable_recommendation) {
        console.log(`   💡 Action: ${insight.actionable_recommendation}`);
      }
      console.log('');
    });
  } else {
    console.log('\n❌ Failed to generate new insights');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  TEST COMPLETE - No notifications sent, no data saved');
  console.log('═'.repeat(70) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });

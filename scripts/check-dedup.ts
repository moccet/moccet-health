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

async function checkDedup() {
  const email = process.argv[2] || 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(80));
  console.log(`DEDUPLICATION ANALYSIS FOR: ${email}`);
  console.log('═'.repeat(80));

  // Get insights from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: insights } = await supabase
    .from('real_time_insights')
    .select('*')
    .eq('email', email)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });

  console.log(`\nInsights in last 7 days: ${insights?.length || 0}`);
  console.log(`Insights in last 3 days: ${insights?.filter(i => i.created_at >= threeDaysAgo).length || 0}`);

  // Category map (same as in the code)
  const categoryMap: Record<string, string> = {
    sleep_alert: 'sleep_recovery', sleep_improvement: 'sleep_recovery', sleep_recovery: 'sleep_recovery',
    recovery_low: 'sleep_recovery', recovery_high: 'sleep_recovery', recovery_insight: 'sleep_recovery',
    activity_anomaly: 'activity_movement', workout_completed: 'activity_movement',
    workout_recommendation: 'activity_movement', activity_movement: 'activity_movement',
    stress_indicator: 'stress_resilience', stress_recovery_pattern: 'stress_resilience', stress_resilience: 'stress_resilience',
    mood_indicator: 'cognitive_wellbeing', cognitive_wellbeing: 'cognitive_wellbeing', deep_focus_window: 'cognitive_wellbeing',
    email_overload: 'work_life_balance', calendar_conflict: 'work_life_balance',
    work_sleep_impact: 'work_life_balance', work_life_balance: 'work_life_balance',
    glucose_spike: 'metabolic_health', biomarker_trend: 'metabolic_health',
    nutrition_reminder: 'metabolic_health', metabolic_health: 'metabolic_health',
    social_health: 'social_health', communication_pattern: 'social_health',
  };

  // Group by category
  const byCategory: Record<string, any[]> = {};
  insights?.forEach(i => {
    const cat = categoryMap[i.insight_type] || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(i);
  });

  console.log('\n📊 INSIGHTS BY CATEGORY (last 7 days):');
  console.log('─'.repeat(80));

  for (const [category, catInsights] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
    const recent = catInsights.filter(i => i.created_at >= threeDaysAgo).length;
    console.log(`\n${category.toUpperCase()} (${catInsights.length} total, ${recent} in last 3 days):`);

    catInsights.slice(0, 5).forEach(i => {
      const date = new Date(i.created_at).toLocaleDateString();
      const isRecent = i.created_at >= threeDaysAgo ? '🔴' : '⚪';
      console.log(`  ${isRecent} [${date}] ${i.title}`);
      console.log(`     Type: ${i.insight_type} | Source: ${i.source_provider}`);
    });

    if (catInsights.length > 5) {
      console.log(`  ... and ${catInsights.length - 5} more`);
    }
  }

  // Check what would be blocked with current settings
  console.log('\n' + '─'.repeat(80));
  console.log('🔒 CATEGORIES WITH RECENT (3-DAY) INSIGHTS (would block new same-category):');
  console.log('─'.repeat(80));

  const recentCategories = new Set<string>();
  insights?.filter(i => i.created_at >= threeDaysAgo).forEach(i => {
    const cat = categoryMap[i.insight_type] || 'general';
    recentCategories.add(cat);
  });

  if (recentCategories.size === 0) {
    console.log('✅ No recent categories - all categories should be allowed!');
  } else {
    console.log(`Blocked categories: ${Array.from(recentCategories).join(', ')}`);

    const allCategories = ['sleep_recovery', 'activity_movement', 'stress_resilience', 'cognitive_wellbeing',
                          'work_life_balance', 'metabolic_health', 'social_health', 'general'];
    const availableCategories = allCategories.filter(c => !recentCategories.has(c));
    console.log(`\n✅ Available categories for new insights: ${availableCategories.join(', ') || 'NONE'}`);
  }

  console.log('\n' + '═'.repeat(80));
}

checkDedup().catch(console.error);

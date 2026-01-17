/**
 * Check notification and insight history for a user
 * Usage: npx tsx scripts/check-notification-history.ts [email]
 */
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
  const email = process.argv[2] || 'sofian@moccet.com';
  const today = new Date().toISOString().split('T')[0];

  console.log('Checking notification/insight tracking for:', email);
  console.log('Today:', today);
  console.log('');

  // 1. Check notification_daily_themes (today's themes)
  console.log('=== 1. NOTIFICATION DAILY THEMES (today) ===\n');
  const { data: themes, error: themesError } = await supabase
    .from('notification_daily_themes')
    .select('theme, notification_type, sent_at')
    .eq('email', email)
    .gte('sent_at', today + 'T00:00:00')
    .order('sent_at', { ascending: false });

  if (themesError) {
    console.log('  Error or table not found:', themesError.message);
  } else if (themes && themes.length > 0) {
    themes.forEach(t => {
      console.log(`  - ${t.theme} (${t.notification_type}) at ${t.sent_at}`);
    });
  } else {
    console.log('  No themes sent today');
  }
  console.log('');

  // 2. Check insight_history (recent insights)
  console.log('=== 2. INSIGHT HISTORY (last 7 days) ===\n');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: insights, error: insightsError } = await supabase
    .from('insight_history')
    .select('category, title, shown_at')
    .eq('email', email)
    .gte('shown_at', sevenDaysAgo)
    .order('shown_at', { ascending: false })
    .limit(20);

  if (insightsError) {
    console.log('  Error or table not found:', insightsError.message);
  } else if (insights && insights.length > 0) {
    insights.forEach(i => {
      const date = new Date(i.shown_at).toLocaleDateString();
      console.log(`  - [${i.category}] ${i.title?.slice(0, 50)}... (${date})`);
    });
    console.log(`\n  Total: ${insights.length} insights in last 7 days`);
  } else {
    console.log('  No insights in last 7 days');
  }
  console.log('');

  // 3. Check insight categories (for deduplication context)
  console.log('=== 3. INSIGHT CATEGORY COUNTS (all time) ===\n');
  const { data: allInsights } = await supabase
    .from('insight_history')
    .select('category')
    .eq('email', email);

  if (allInsights && allInsights.length > 0) {
    const categoryCounts: Record<string, number> = {};
    allInsights.forEach(i => {
      categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
    });
    Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
    console.log(`\n  Total insights: ${allInsights.length}`);
  } else {
    console.log('  No insights found');
  }
  console.log('');

  // 4. Check morning_briefings
  console.log('=== 4. MORNING BRIEFINGS (last 7 days) ===\n');
  const { data: briefings, error: briefingsError } = await supabase
    .from('morning_briefings')
    .select('generated_at, notification_sent, total_action_items, wellness_recommendation')
    .eq('user_email', email)
    .gte('generated_at', sevenDaysAgo)
    .order('generated_at', { ascending: false })
    .limit(7);

  if (briefingsError) {
    console.log('  Error or table not found:', briefingsError.message);
  } else if (briefings && briefings.length > 0) {
    briefings.forEach(b => {
      const date = new Date(b.generated_at).toLocaleDateString();
      const rec = b.wellness_recommendation?.slice(0, 60) || 'N/A';
      console.log(`  ${date}: ${b.notification_sent ? 'SENT' : 'not sent'} (${b.total_action_items} items)`);
      console.log(`    "${rec}..."`);
    });
    console.log(`\n  Dedup: recommendations stored to prevent repeats`);
  } else {
    console.log('  No briefings found');
  }
  console.log('');

  // 5. Summary
  console.log('=== DEDUPLICATION SUMMARY ===\n');
  console.log('Notifications:');
  console.log('  - notification_daily_themes: prevents same theme twice/day');
  console.log('  - NotificationCoordinator: global 6/day limit, per-service limits');
  console.log('  - Category saturation: max 2/category/day');
  console.log('  - Quiet hours: 11pm-7am blocked for medium/low severity');
  console.log('');
  console.log('Insights:');
  console.log('  - insight_history: stores all generated insights');
  console.log('  - context-builder: loads last 100 insights for AI context');
  console.log('  - AI receives history to avoid repetitive recommendations');
  console.log('');
  console.log('Morning Briefings:');
  console.log('  - morning_briefings: stores wellness_recommendation');
  console.log('  - getRecentRecommendations(): checks last 7 days');
  console.log('  - pickUnseenRecommendation(): avoids repeats');
}

check().catch(console.error);

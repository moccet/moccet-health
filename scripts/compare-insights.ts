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

async function compareInsights() {
  const user1 = 'hvdvpjyp2z@privaterelay.appleid.com';
  const user2 = 'sofian@moccet.com';

  console.log('═'.repeat(80));
  console.log('INSIGHTS COMPARISON');
  console.log('═'.repeat(80));

  for (const email of [user1, user2]) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`USER: ${email}`);
    console.log('─'.repeat(80));

    // Get subscription tier
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('tier, status')
      .eq('user_email', email)
      .maybeSingle();

    console.log(`Tier: ${sub?.tier || 'free'} (${sub?.status || 'no subscription'})`);

    // Get all insights for this user (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: insights } = await supabase
      .from('real_time_insights')
      .select('insight_type, title, message, severity, source_provider, created_at')
      .eq('email', email)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    console.log(`\nTotal insights (last 30 days): ${insights?.length || 0}`);

    if (insights?.length) {
      // Group by insight_type
      const byType: Record<string, number> = {};
      const byTitle: Record<string, number> = {};
      const bySource: Record<string, number> = {};

      insights.forEach(i => {
        byType[i.insight_type] = (byType[i.insight_type] || 0) + 1;
        byTitle[i.title] = (byTitle[i.title] || 0) + 1;
        bySource[i.source_provider] = (bySource[i.source_provider] || 0) + 1;
      });

      console.log('\n📊 By Insight Type:');
      Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`);
        });

      console.log('\n📊 By Source Provider:');
      Object.entries(bySource)
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
          console.log(`   ${source}: ${count}`);
        });

      console.log('\n📊 Repeated Titles (duplicates):');
      const repeated = Object.entries(byTitle)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

      if (repeated.length) {
        repeated.forEach(([title, count]) => {
          console.log(`   "${title}" - ${count} times`);
        });
      } else {
        console.log('   No repeated titles');
      }

      // Check for magnesium-related insights
      const magnesiumInsights = insights.filter(i =>
        i.title?.toLowerCase().includes('magnesium') ||
        i.message?.toLowerCase().includes('magnesium')
      );

      if (magnesiumInsights.length) {
        console.log(`\n⚠️  MAGNESIUM INSIGHTS: ${magnesiumInsights.length} found`);
        magnesiumInsights.forEach(i => {
          console.log(`   - ${new Date(i.created_at).toLocaleDateString()}: ${i.title}`);
        });
      }

      console.log('\n📋 Last 10 Insights:');
      insights.slice(0, 10).forEach((i, idx) => {
        const date = new Date(i.created_at).toLocaleDateString();
        const sev = i.severity === 'high' ? '🔴' : i.severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${idx + 1}. ${sev} [${date}] ${i.title}`);
        console.log(`      Type: ${i.insight_type} | Source: ${i.source_provider}`);
      });
    }
  }

  console.log('\n' + '═'.repeat(80));
}

compareInsights().catch(console.error);

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

const BASE_URL = 'https://www.moccet.ai';

async function syncAndTest() {
  const email = 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(70));
  console.log(`SYNC & TEST FOR: ${email}`);
  console.log('═'.repeat(70));

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
    console.log(`   Data points: ${slackData.patterns?.dataPointsAnalyzed || 'N/A'}`);
    if (slackData.deepAnalysis) {
      console.log(`   Deep analysis: ${slackData.deepAnalysis.pendingTasks?.length || 0} tasks`);
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
    console.log(`   Data points: ${gmailData.patterns?.dataPointsAnalyzed || 'N/A'}`);
    if (gmailData.deepAnalysis) {
      console.log(`   Deep analysis: ${gmailData.deepAnalysis.pendingTasks?.length || 0} tasks`);
    }
    if (gmailData.error) console.log(`   Error: ${gmailData.error}`);
  } catch (e: any) {
    console.log(`   Error: ${e.message}`);
  }

  // Now run insights locally with fresh data
  console.log('\n' + '─'.repeat(70));
  console.log('🧠 GENERATING INSIGHTS WITH NEW 30 CATEGORIES...');
  console.log('─'.repeat(70));

  const { processAllProviders } = await import('../lib/services/insight-trigger-service');

  try {
    const result = await processAllProviders(email);

    console.log(`\n✅ Generated: ${result.insights.length} insights`);
    console.log(`   Stored: ${result.insights_generated}`);

    if (result.insights.length > 0) {
      console.log('\n📋 INSIGHTS BY CATEGORY:');

      // Group by category
      const byCategory: Record<string, any[]> = {};
      result.insights.forEach(i => {
        const cat = i.insight_type || 'unknown';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(i);
      });

      Object.entries(byCategory).forEach(([cat, insights]) => {
        console.log(`\n   📌 ${cat.toUpperCase()}:`);
        insights.forEach(i => {
          const sev = i.severity === 'high' ? '🔴' : i.severity === 'medium' ? '🟡' : '🟢';
          console.log(`      ${sev} ${i.title}`);
          console.log(`         Source: ${i.source_provider}`);
        });
      });
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message}`);
  }

  console.log('\n' + '═'.repeat(70));
}

syncAndTest().catch(console.error);

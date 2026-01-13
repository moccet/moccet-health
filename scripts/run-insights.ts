/**
 * Run the actual processAllProviders function for a user
 * This mimics what the cron job does
 */

// Set up environment FIRST before any imports
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envFile = readFileSync(envPath, 'utf-8');

envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      process.env[key] = value;
    }
  }
});

// Dynamic imports after env is set up
const main = async () => {
  const { processAllProviders } = await import('../lib/services/insight-trigger-service');
  const { fetchGmailPatterns, fetchSlackPatterns } = await import('../lib/services/ecosystem-fetcher');
  const { getUserContext, getUserSubscriptionTier } = await import('../lib/services/user-context-service');

  const email = process.argv[2] || 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(70));
  console.log(`RUNNING REAL processAllProviders FOR: ${email}`);
  console.log('═'.repeat(70));

  // First, check what data is available
  console.log('\n1. Checking subscription tier...');
  const tier = await getUserSubscriptionTier(email);
  console.log(`   Tier: ${tier}`);

  console.log('\n2. Fetching ecosystem data individually...');

  const gmail = await fetchGmailPatterns(email);
  console.log(`   Gmail: available=${gmail.available}, recordCount=${gmail.recordCount || 0}`);
  if (gmail.error) console.log(`   Gmail error: ${gmail.error}`);

  const slack = await fetchSlackPatterns(email);
  console.log(`   Slack: available=${slack.available}, recordCount=${slack.recordCount || 0}`);
  if (slack.error) console.log(`   Slack error: ${slack.error}`);

  console.log('\n3. Fetching user context...');
  const context = await getUserContext(email, 'generate health insights', {
    subscriptionTier: tier,
    includeConversation: true,
    useAISelection: false,
  }).catch((e: any) => {
    console.log(`   Error: ${e.message}`);
    return null;
  });

  if (context) {
    console.log(`   Profile: ${context.profile ? 'Found' : 'Not found'}`);
    console.log(`   Lab results: ${context.labResults?.length || 0}`);
    console.log(`   Learned facts: ${context.learnedFacts?.length || 0}`);
  }

  console.log('\n4. Running processAllProviders (this will save to DB)...');
  console.log('─'.repeat(70));

  try {
    const result = await processAllProviders(email);

    console.log('─'.repeat(70));
    console.log('\n✅ RESULT:');
    console.log(`   Insights generated: ${result.insights_generated}`);
    console.log(`   Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}`);

    if (result.insights.length > 0) {
      console.log('\n📋 Generated Insights:');
      result.insights.forEach((insight, i) => {
        const sev = insight.severity === 'high' ? '🔴' : insight.severity === 'medium' ? '🟡' : '🟢';
        console.log(`\n   ${i + 1}. ${sev} [${insight.insight_type}] ${insight.title}`);
        console.log(`      Source: ${insight.source_provider}`);
        console.log(`      Message: ${insight.message?.substring(0, 150)}...`);
      });
    } else {
      console.log('\n❌ No insights were generated');
    }
  } catch (error: any) {
    console.log(`\n❌ ERROR: ${error.message}`);
    console.log(error.stack);
  }

  console.log('\n' + '═'.repeat(70));
};

main().catch(console.error);

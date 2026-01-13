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

async function test() {
  const { getValidatedAccessToken, refreshToken } = await import('../lib/services/token-manager');

  const email = 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(60));
  console.log(`TOKEN REFRESH TEST: ${email}`);
  console.log('═'.repeat(60));

  // Test Gmail
  console.log('\n📧 GMAIL TOKEN:');
  const gmailResult = await getValidatedAccessToken(email, 'gmail');
  if (gmailResult.error) {
    console.log(`   Error: ${gmailResult.error}`);
    console.log('\n   Attempting manual refresh...');
    const refreshResult = await refreshToken(email, 'gmail');
    console.log(`   Refresh result: ${refreshResult.success ? '✅ Success' : '❌ Failed'}`);
    if (refreshResult.error) console.log(`   Error: ${refreshResult.error}`);
  } else {
    console.log(`   ✅ Valid token obtained`);
  }

  // Test Slack
  console.log('\n💬 SLACK TOKEN:');
  const slackResult = await getValidatedAccessToken(email, 'slack');
  if (slackResult.error) {
    console.log(`   Error: ${slackResult.error}`);
  } else {
    console.log(`   ✅ Valid token obtained`);
  }

  // Test Oura
  console.log('\n💍 OURA TOKEN:');
  const ouraResult = await getValidatedAccessToken(email, 'oura');
  if (ouraResult.error) {
    console.log(`   Error: ${ouraResult.error}`);
  } else {
    console.log(`   ✅ Valid token obtained`);
  }

  console.log('\n' + '═'.repeat(60));
}

test().catch(console.error);

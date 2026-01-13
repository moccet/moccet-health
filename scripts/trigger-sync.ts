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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function triggerSync() {
  const email = process.argv[2] || 'hvdvpjyp2z@privaterelay.appleid.com';

  console.log('═'.repeat(60));
  console.log(`TRIGGERING DATA SYNC FOR: ${email}`);
  console.log('═'.repeat(60));

  const endpoints = [
    { name: 'Slack', path: '/api/slack/fetch-data' },
    { name: 'Gmail', path: '/api/gmail/fetch-data' },
  ];

  for (const ep of endpoints) {
    console.log(`\n📡 Syncing ${ep.name}...`);

    try {
      const response = await fetch(`${BASE_URL}${ep.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`   ✅ Success`);
        if (data.patterns) {
          console.log(`   Data points: ${data.patterns.dataPointsAnalyzed || 'N/A'}`);
        }
        if (data.deepAnalysis) {
          console.log(`   Deep analysis: ${data.deepAnalysis.pendingTasks?.length || 0} tasks`);
        }
      } else {
        console.log(`   ❌ Failed: ${data.error || response.statusText}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.message.includes('ECONNREFUSED')) {
        console.log('   (Server not running - start with: npm run dev)');
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
}

triggerSync().catch(console.error);

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
  const { fetchDeepContentData } = await import('../lib/services/ecosystem-fetcher');

  console.log('═'.repeat(60));
  console.log('TESTING fetchDeepContentData');
  console.log('═'.repeat(60));

  for (const email of ['hvdvpjyp2z@privaterelay.appleid.com', 'sofian@moccet.com']) {
    console.log(`\n${email}:`);

    const result = await fetchDeepContentData(email);

    console.log(`  Available: ${result.available}`);
    console.log(`  Last analyzed: ${result.lastAnalyzed || 'N/A'}`);

    if (result.slack) {
      console.log(`  Slack: ${result.slack.pendingTasks.length} tasks, ${result.slack.responseDebt.count} debt`);
    } else {
      console.log(`  Slack: No data`);
    }

    if (result.gmail) {
      console.log(`  Gmail: ${result.gmail.pendingTasks.length} tasks, ${result.gmail.responseDebt.count} debt`);
    } else {
      console.log(`  Gmail: No data`);
    }
  }

  console.log('\n' + '═'.repeat(60));
}

test().catch(console.error);

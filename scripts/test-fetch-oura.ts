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
  const { fetchOuraData } = await import('../lib/services/ecosystem-fetcher');

  const email = 'hvdvpjyp2z@privaterelay.appleid.com';
  console.log(`Testing fetchOuraData for ${email}...\n`);

  const result = await fetchOuraData(email);

  console.log('Result:');
  console.log(`  Available: ${result.available}`);
  console.log(`  Error: ${result.error || 'None'}`);
  console.log(`  Data: ${result.data ? 'Present' : 'None'}`);

  if (result.data) {
    const data = result.data as any;
    console.log(`\n  avgSleepHours: ${data.avgSleepHours}`);
    console.log(`  avgReadinessScore: ${data.avgReadinessScore}`);
    console.log(`  avgHRV: ${data.avgHRV}`);
  }
}

test().catch(console.error);

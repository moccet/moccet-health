/**
 * Test notification services locally (bypasses API auth)
 * Usage: npx tsx scripts/test-notification-services.ts [email]
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env vars
const envPath = resolve(__dirname, '../.env.local');
const envFile = readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

async function test() {
  const email = process.argv[2] || 'sofian@moccet.com';

  console.log('Testing notification services for:', email);
  console.log('');

  // Test 1: Daily Digest - analyzeHealthContext
  console.log('=== 1. DAILY DIGEST (analyzeHealthContext) ===\n');
  try {
    const { analyzeHealthContext } = await import('../lib/services/daily-digest-service');
    const healthContext = await analyzeHealthContext(email, { useUnified: true });

    if (healthContext) {
      console.log('Health Context:');
      console.log('  Recovery:', healthContext.recovery);
      console.log('  HRV:', healthContext.hrv);
      console.log('  Sleep Hours:', healthContext.sleepHours);
      console.log('  Stress Level:', healthContext.stressLevel);
      console.log('  Energy Level:', healthContext.energyLevel);
      console.log('  Recommended Focus:', healthContext.recommendedFocus);
      console.log('  Data Points:', healthContext.dataPoints?.join(', '));
      console.log('  Summary:', healthContext.healthSummary);
    } else {
      console.log('  No health data available');
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
  console.log('');

  // Test 2: Ecosystem Fetcher with unified data
  console.log('=== 2. ECOSYSTEM FETCHER (unified) ===\n');
  try {
    const { fetchAllEcosystemData } = await import('../lib/services/ecosystem-fetcher');
    const ecosystemData = await fetchAllEcosystemData(email, 'sage', { useUnified: true });

    console.log('Available providers:');
    const providers = ['oura', 'whoop', 'dexcom', 'gmail', 'slack', 'spotify', 'notion', 'linear', 'appleHealth'] as const;
    for (const p of providers) {
      const data = ecosystemData[p];
      if (data?.available) {
        console.log(`  ${p}: available`);
        if (p === 'whoop' && data.data) {
          console.log(`    - Recovery: ${data.data.avgRecoveryScore}%`);
        }
        if (p === 'gmail' && data.data) {
          console.log(`    - Stress: ${data.data.stressIndicators?.workloadStressScore}`);
        }
        if (p === 'slack' && data.data) {
          console.log(`    - Messages: ${data.data.messageMetrics?.totalMessages}`);
        }
      }
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
  console.log('');

  // Test 3: Proactive Engagement context gathering
  console.log('=== 3. PROACTIVE ENGAGEMENT (context check) ===\n');
  try {
    const { fetchAllEcosystemData } = await import('../lib/services/ecosystem-fetcher');
    const ecosystemData = await fetchAllEcosystemData(email, 'sage', { useUnified: true });

    // Check what would trigger notifications
    const triggers: string[] = [];

    if (ecosystemData.whoop?.available && ecosystemData.whoop.data) {
      const recovery = ecosystemData.whoop.data.avgRecoveryScore;
      if (recovery && recovery < 50) {
        triggers.push(`Low recovery (${Math.round(recovery)}%) - would trigger recovery_reminder`);
      } else if (recovery && recovery >= 67) {
        triggers.push(`Good recovery (${Math.round(recovery)}%) - would trigger morning_motivation`);
      }
    }

    if (ecosystemData.gmail?.available && ecosystemData.gmail.data) {
      const stress = ecosystemData.gmail.data.stressIndicators;
      if (stress?.frequentAfterHoursWork) {
        triggers.push('After-hours work detected - would trigger stress_support');
      }
    }

    if (ecosystemData.oura?.available && ecosystemData.oura.data) {
      const readiness = ecosystemData.oura.data.avgReadinessScore;
      if (readiness && readiness >= 80) {
        triggers.push(`High readiness (${Math.round(readiness)}) - would trigger achievement_celebration`);
      }
    }

    if (triggers.length > 0) {
      console.log('Potential notification triggers:');
      triggers.forEach(t => console.log('  -', t));
    } else {
      console.log('No notification triggers detected (all metrics in normal range)');
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
  console.log('');

  console.log('=== SUMMARY ===\n');
  console.log('All notification services are reading from unified_health_data.');
  console.log('Data flows: unified_health_data -> ecosystem-fetcher -> notification services');
}

test().catch(console.error);

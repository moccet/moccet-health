#!/usr/bin/env npx ts-node

/**
 * Backfill Script: Unified Health Data
 *
 * Populates the unified_health_data table from existing provider tables:
 * - oura_data -> sleep, readiness, activity
 * - forge_training_data (whoop) -> recovery
 * - behavioral_patterns (gmail/slack) -> behavioral/stress
 * - behavioral_patterns (notion) -> productivity
 * - behavioral_patterns (linear) -> productivity
 * - dexcom_data -> glucose
 * - sage_onboarding_data (apple_health) -> sleep, activity
 *
 * Note: Spotify data is fetched live from API and not stored, so cannot be backfilled.
 *
 * Usage:
 *   npx tsx scripts/backfill-unified-data.ts
 *   npx tsx scripts/backfill-unified-data.ts --email=user@example.com
 *   npx tsx scripts/backfill-unified-data.ts --dry-run
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types (simplified for script)
interface UnifiedHealthRecord {
  email: string;
  recorded_at: string;
  provider: string;
  data_type: string;
  sleep_duration_hours?: number;
  sleep_score?: number;
  deep_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  light_sleep_minutes?: number;
  awake_minutes?: number;
  sleep_efficiency?: number;
  recovery_score?: number;
  readiness_score?: number;
  strain_score?: number;
  hrv_avg?: number;
  hrv_rmssd?: number;
  resting_hr?: number;
  respiratory_rate?: number;
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  active_minutes?: number;
  glucose_avg?: number;
  time_in_range_percent?: number;
  stress_score?: number;
  meeting_count?: number;
  meeting_minutes?: number;
  email_count?: number;
  after_hours_activity?: boolean;
  // Mood fields (Spotify)
  mood_type?: string;
  mood_confidence?: number;
  energy_level?: number;
  valence_score?: number;
  late_night_activity?: boolean;
  // Productivity fields (Notion/Linear)
  open_tasks?: number;
  overdue_tasks?: number;
  tasks_due_soon?: number;
  urgent_issues?: number;
  high_priority_items?: number;
  task_completion_rate?: number;
  provider_data?: Record<string, unknown>;
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const emailArg = args.find((a) => a.startsWith('--email='));
const targetEmail = emailArg ? emailArg.split('=')[1] : null;

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Stats tracking
const stats = {
  oura: { processed: 0, written: 0, errors: 0 },
  whoop: { processed: 0, written: 0, errors: 0 },
  gmail: { processed: 0, written: 0, errors: 0 },
  slack: { processed: 0, written: 0, errors: 0 },
  dexcom: { processed: 0, written: 0, errors: 0 },
  apple_health: { processed: 0, written: 0, errors: 0 },
  notion: { processed: 0, written: 0, errors: 0 },
  linear: { processed: 0, written: 0, errors: 0 },
};

/**
 * Deduplicate records by keeping the latest one for each unique key
 */
function deduplicateRecords(records: UnifiedHealthRecord[]): UnifiedHealthRecord[] {
  const seen = new Map<string, UnifiedHealthRecord>();
  for (const record of records) {
    const key = `${record.email}|${record.provider}|${record.data_type}|${record.recorded_at}`;
    seen.set(key, record); // Last one wins
  }
  return Array.from(seen.values());
}

/**
 * Write records to unified_health_data table
 */
async function writeRecords(records: UnifiedHealthRecord[]): Promise<number> {
  if (records.length === 0) return 0;

  // Deduplicate to avoid "cannot affect row a second time" error
  const dedupedRecords = deduplicateRecords(records);

  if (isDryRun) {
    console.log(`[DRY RUN] Would write ${dedupedRecords.length} records (${records.length - dedupedRecords.length} duplicates removed)`);
    return dedupedRecords.length;
  }

  try {
    const { error, count } = await supabase
      .from('unified_health_data')
      .upsert(dedupedRecords, {
        onConflict: 'email,provider,data_type,recorded_at',
        ignoreDuplicates: false,
        count: 'exact',
      });

    if (error) {
      console.error(`Error writing records:`, error.message);
      return 0;
    }

    return count || dedupedRecords.length;
  } catch (error) {
    console.error(`Exception writing records:`, error);
    return 0;
  }
}

/**
 * Backfill from oura_data table
 */
async function backfillOura(): Promise<void> {
  console.log('\n=== Backfilling Oura data ===');

  let query = supabase
    .from('oura_data')
    .select('*')
    .order('sync_date', { ascending: false });

  if (targetEmail) {
    query = query.eq('email', targetEmail);
  }

  const { data: ouraRecords, error } = await query;

  if (error) {
    console.error('Error fetching Oura data:', error.message);
    return;
  }

  if (!ouraRecords || ouraRecords.length === 0) {
    console.log('No Oura records found');
    return;
  }

  console.log(`Found ${ouraRecords.length} Oura sync records`);

  // Collect ALL records first, then dedupe and write
  const allUnifiedRecords: UnifiedHealthRecord[] = [];

  for (const ouraSync of ouraRecords) {
    const email = ouraSync.email;

    // Process sleep data
    const sleepData = ouraSync.sleep_data || [];
    for (const sleep of sleepData) {
      if (!sleep.day) continue;

      allUnifiedRecords.push({
        email,
        provider: 'oura',
        data_type: 'sleep',
        recorded_at: new Date(sleep.day).toISOString(),
        sleep_duration_hours: sleep.total_sleep_duration
          ? Number((sleep.total_sleep_duration / 3600).toFixed(2))
          : undefined,
        sleep_score: sleep.score,
        deep_sleep_minutes: sleep.deep_sleep_duration
          ? Math.round(sleep.deep_sleep_duration / 60)
          : undefined,
        rem_sleep_minutes: sleep.rem_sleep_duration
          ? Math.round(sleep.rem_sleep_duration / 60)
          : undefined,
        light_sleep_minutes: sleep.light_sleep_duration
          ? Math.round(sleep.light_sleep_duration / 60)
          : undefined,
        awake_minutes: sleep.awake_time
          ? Math.round(sleep.awake_time / 60)
          : undefined,
        sleep_efficiency: sleep.efficiency,
        hrv_avg: sleep.hrv?.average,
        resting_hr: sleep.heart_rate?.average,
        provider_data: sleep,
      });
      stats.oura.processed++;
    }

    // Process readiness data
    const readinessData = ouraSync.readiness_data || [];
    for (const readiness of readinessData) {
      if (!readiness.day) continue;

      allUnifiedRecords.push({
        email,
        provider: 'oura',
        data_type: 'recovery',
        recorded_at: new Date(readiness.day).toISOString(),
        readiness_score: readiness.score,
        resting_hr: readiness.resting_heart_rate,
        hrv_avg: readiness.hrv_balance?.value,
        provider_data: readiness,
      });
      stats.oura.processed++;
    }

    // Process activity data
    const activityData = ouraSync.activity_data || [];
    for (const activity of activityData) {
      if (!activity.day) continue;

      const activeMinutes =
        ((activity.high_activity_time || 0) + (activity.medium_activity_time || 0)) / 60;

      allUnifiedRecords.push({
        email,
        provider: 'oura',
        data_type: 'activity',
        recorded_at: new Date(activity.day).toISOString(),
        steps: activity.steps,
        active_calories: activity.active_calories,
        total_calories: activity.total_calories,
        active_minutes: Math.round(activeMinutes),
        provider_data: activity,
      });
      stats.oura.processed++;
    }
  }

  // Write all records at once (deduplication happens in writeRecords)
  if (allUnifiedRecords.length > 0) {
    console.log(`  Processing ${allUnifiedRecords.length} total Oura records...`);
    const written = await writeRecords(allUnifiedRecords);
    stats.oura.written += written;
    console.log(`  Oura: ${written} unique records written`);
  }
}

/**
 * Backfill from forge_training_data (Whoop)
 */
async function backfillWhoop(): Promise<void> {
  console.log('\n=== Backfilling Whoop data ===');

  let query = supabase
    .from('forge_training_data')
    .select('*')
    .eq('provider', 'whoop')
    .order('sync_date', { ascending: false });

  if (targetEmail) {
    query = query.eq('email', targetEmail);
  }

  const { data: whoopRecords, error } = await query;

  if (error) {
    console.error('Error fetching Whoop data:', error.message);
    return;
  }

  if (!whoopRecords || whoopRecords.length === 0) {
    console.log('No Whoop records found');
    return;
  }

  console.log(`Found ${whoopRecords.length} Whoop sync records`);

  for (const whoopSync of whoopRecords) {
    const unifiedRecords: UnifiedHealthRecord[] = [];
    const email = whoopSync.email;

    // Whoop stores aggregated data, so we create a recovery record per sync
    const recoveryScore = whoopSync.recovery_score;
    const hrvTrends = whoopSync.hrv_trends;
    const restingHRTrends = whoopSync.resting_hr_trends;

    if (recoveryScore || hrvTrends) {
      unifiedRecords.push({
        email,
        provider: 'whoop',
        data_type: 'recovery',
        recorded_at: whoopSync.sync_date || new Date().toISOString(),
        recovery_score: recoveryScore?.avgRecoveryScore,
        strain_score: recoveryScore?.avgDailyStrain,
        hrv_avg: hrvTrends?.avgHRV,
        resting_hr: restingHRTrends?.avg,
        provider_data: whoopSync,
      });
      stats.whoop.processed++;
    }

    // Write batch
    if (unifiedRecords.length > 0) {
      const written = await writeRecords(unifiedRecords);
      stats.whoop.written += written;
      console.log(`  ${email}: ${written} records written`);
    }
  }
}

/**
 * Backfill from behavioral_patterns (Gmail/Slack/Notion/Linear)
 */
async function backfillBehavioral(): Promise<void> {
  console.log('\n=== Backfilling Behavioral patterns (Gmail/Slack/Notion/Linear) ===');

  let query = supabase
    .from('behavioral_patterns')
    .select('*')
    .order('sync_date', { ascending: false });

  if (targetEmail) {
    query = query.eq('email', targetEmail);
  }

  const { data: behavioralRecords, error } = await query;

  if (error) {
    console.error('Error fetching behavioral data:', error.message);
    return;
  }

  if (!behavioralRecords || behavioralRecords.length === 0) {
    console.log('No behavioral records found');
    return;
  }

  console.log(`Found ${behavioralRecords.length} behavioral records`);

  for (const record of behavioralRecords) {
    const unifiedRecords: UnifiedHealthRecord[] = [];
    const email = record.email;
    const source = record.source?.toLowerCase() || 'unknown';
    const patterns = record.patterns || {};
    const data = record.data || {};

    if (source === 'gmail' || source === 'google') {
      unifiedRecords.push({
        email,
        provider: 'gmail',
        data_type: 'behavioral',
        recorded_at: record.sync_date || new Date().toISOString(),
        stress_score: patterns.metrics?.stressScore,
        meeting_count: patterns.meetingDensity?.avgMeetingsPerDay
          ? Math.round(patterns.meetingDensity.avgMeetingsPerDay)
          : undefined,
        meeting_minutes: patterns.meetingDensity?.totalMeetingMinutes,
        email_count: patterns.emailVolume?.total,
        after_hours_activity:
          patterns.emailVolume?.afterHoursPercentage !== undefined
            ? patterns.emailVolume.afterHoursPercentage > 20
            : undefined,
        provider_data: record,
      });
      stats.gmail.processed++;
      stats.gmail.written++;
    } else if (source === 'slack') {
      unifiedRecords.push({
        email,
        provider: 'slack',
        data_type: 'behavioral',
        recorded_at: record.sync_date || new Date().toISOString(),
        after_hours_activity: patterns.afterHoursMessages
          ? patterns.afterHoursMessages > 10
          : undefined,
        provider_data: record,
      });
      stats.slack.processed++;
      stats.slack.written++;
    } else if (source === 'notion') {
      // Notion productivity data
      const notionOverview = data.notion_overview || {};
      const totalTasks = notionOverview.total_tasks || 0;
      const openTasks = notionOverview.open_tasks || 0;
      const completionRate = totalTasks > 0
        ? Math.round(((totalTasks - openTasks) / totalTasks) * 100)
        : undefined;

      unifiedRecords.push({
        email,
        provider: 'notion',
        data_type: 'productivity',
        recorded_at: record.sync_date || new Date().toISOString(),
        open_tasks: openTasks,
        overdue_tasks: notionOverview.overdue_tasks,
        tasks_due_soon: notionOverview.tasks_due_soon,
        task_completion_rate: completionRate,
        // Map overdue tasks to stress score
        stress_score: notionOverview.overdue_tasks > 0
          ? Math.min(100, notionOverview.overdue_tasks * 10 + (notionOverview.tasks_due_soon || 0) * 5)
          : undefined,
        provider_data: record,
      });
      stats.notion.processed++;
      stats.notion.written++;
    } else if (source === 'linear') {
      // Linear productivity data
      const linearOverview = data.linear_overview || {};
      const totalIssues = linearOverview.total_issues || 0;
      const openIssues = linearOverview.open_issues || 0;
      const completionRate = totalIssues > 0
        ? Math.round(((totalIssues - openIssues) / totalIssues) * 100)
        : undefined;

      unifiedRecords.push({
        email,
        provider: 'linear',
        data_type: 'productivity',
        recorded_at: record.sync_date || new Date().toISOString(),
        open_tasks: openIssues,
        overdue_tasks: linearOverview.overdue_issues,
        tasks_due_soon: linearOverview.due_soon_issues,
        urgent_issues: linearOverview.urgent_issues,
        high_priority_items: linearOverview.high_priority_issues,
        task_completion_rate: completionRate,
        // Map urgent + overdue issues to stress score
        stress_score: (linearOverview.urgent_issues > 0 || linearOverview.overdue_issues > 0)
          ? Math.min(100, (linearOverview.urgent_issues || 0) * 15 + (linearOverview.overdue_issues || 0) * 10 + (linearOverview.due_soon_issues || 0) * 3)
          : undefined,
        provider_data: record,
      });
      stats.linear.processed++;
      stats.linear.written++;
    }

    // Write batch
    if (unifiedRecords.length > 0) {
      const written = await writeRecords(unifiedRecords);
      console.log(`  ${email} (${source}): ${written} records written`);
    }
  }
}

/**
 * Backfill from dexcom_data
 */
async function backfillDexcom(): Promise<void> {
  console.log('\n=== Backfilling Dexcom data ===');

  // Query all columns without ordering by timestamp (column may not exist)
  let query = supabase
    .from('dexcom_data')
    .select('*');

  if (targetEmail) {
    query = query.eq('user_email', targetEmail);
  }

  const { data: dexcomRecords, error } = await query;

  if (error) {
    console.error('Error fetching Dexcom data:', error.message);
    return;
  }

  if (!dexcomRecords || dexcomRecords.length === 0) {
    console.log('No Dexcom records found');
    return;
  }

  console.log(`Found ${dexcomRecords.length} Dexcom records`);

  const allUnifiedRecords: UnifiedHealthRecord[] = [];

  for (const record of dexcomRecords) {
    // Handle different possible column names
    const email = record.user_email || record.email;
    const analysis = record.analysis || {};
    const recordedAt = record.timestamp || record.created_at || new Date().toISOString();

    if (!email) continue;

    allUnifiedRecords.push({
      email,
      provider: 'dexcom',
      data_type: 'glucose',
      recorded_at: recordedAt,
      glucose_avg: analysis.avgGlucose,
      time_in_range_percent: analysis.timeInRange,
      provider_data: record,
    });
    stats.dexcom.processed++;
  }

  // Write all records at once
  if (allUnifiedRecords.length > 0) {
    const written = await writeRecords(allUnifiedRecords);
    stats.dexcom.written += written;
    console.log(`  Dexcom: ${written} records written`);
  }
}

/**
 * Backfill from sage_onboarding_data (Apple Health)
 */
async function backfillAppleHealth(): Promise<void> {
  console.log('\n=== Backfilling Apple Health data ===');

  let query = supabase
    .from('sage_onboarding_data')
    .select('email, apple_health_data')
    .not('apple_health_data', 'is', null);

  if (targetEmail) {
    query = query.eq('email', targetEmail);
  }

  const { data: appleRecords, error } = await query;

  if (error) {
    console.error('Error fetching Apple Health data:', error.message);
    return;
  }

  if (!appleRecords || appleRecords.length === 0) {
    console.log('No Apple Health records found');
    return;
  }

  console.log(`Found ${appleRecords.length} users with Apple Health data`);

  for (const record of appleRecords) {
    const unifiedRecords: UnifiedHealthRecord[] = [];
    const email = record.email;
    const healthData = record.apple_health_data;

    if (!healthData) continue;

    // Process sleep data
    const sleepRecords = healthData.sleep || [];
    for (const sleep of sleepRecords) {
      if (!sleep.date) continue;

      unifiedRecords.push({
        email,
        provider: 'apple_health',
        data_type: 'sleep',
        recorded_at: new Date(sleep.date).toISOString(),
        sleep_duration_hours: sleep.totalDuration || sleep.duration_hours,
        deep_sleep_minutes: sleep.deepSleep
          ? Math.round(sleep.deepSleep * 60)
          : undefined,
        rem_sleep_minutes: sleep.remSleep
          ? Math.round(sleep.remSleep * 60)
          : undefined,
        sleep_efficiency: sleep.efficiency,
        provider_data: sleep,
      });
      stats.apple_health.processed++;
    }

    // Process steps data
    const stepsRecords = healthData.steps || [];
    for (const step of stepsRecords) {
      if (!step.date) continue;

      unifiedRecords.push({
        email,
        provider: 'apple_health',
        data_type: 'activity',
        recorded_at: new Date(step.date).toISOString(),
        steps: step.total || step.steps,
        provider_data: step,
      });
      stats.apple_health.processed++;
    }

    // Write batch
    if (unifiedRecords.length > 0) {
      const written = await writeRecords(unifiedRecords);
      stats.apple_health.written += written;
      console.log(`  ${email}: ${written} records written`);
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('=== Unified Health Data Backfill ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  if (targetEmail) {
    console.log(`Target email: ${targetEmail}`);
  }
  console.log('');

  // Run all backfill operations
  await backfillOura();
  await backfillWhoop();
  await backfillBehavioral();
  await backfillDexcom();
  await backfillAppleHealth();

  // Print summary
  console.log('\n=== Backfill Summary ===');
  console.log(`Oura:         ${stats.oura.written} written / ${stats.oura.processed} processed`);
  console.log(`Whoop:        ${stats.whoop.written} written / ${stats.whoop.processed} processed`);
  console.log(`Gmail:        ${stats.gmail.written} written / ${stats.gmail.processed} processed`);
  console.log(`Slack:        ${stats.slack.written} written / ${stats.slack.processed} processed`);
  console.log(`Notion:       ${stats.notion.written} written / ${stats.notion.processed} processed`);
  console.log(`Linear:       ${stats.linear.written} written / ${stats.linear.processed} processed`);
  console.log(`Dexcom:       ${stats.dexcom.written} written / ${stats.dexcom.processed} processed`);
  console.log(`Apple Health: ${stats.apple_health.written} written / ${stats.apple_health.processed} processed`);

  const totalWritten =
    stats.oura.written +
    stats.whoop.written +
    stats.gmail.written +
    stats.slack.written +
    stats.notion.written +
    stats.linear.written +
    stats.dexcom.written +
    stats.apple_health.written;

  const totalProcessed =
    stats.oura.processed +
    stats.whoop.processed +
    stats.gmail.processed +
    stats.slack.processed +
    stats.notion.processed +
    stats.linear.processed +
    stats.dexcom.processed +
    stats.apple_health.processed;

  console.log(`\nTotal: ${totalWritten} written / ${totalProcessed} processed`);

  if (isDryRun) {
    console.log('\n[DRY RUN] No data was actually written. Remove --dry-run to execute.');
  }
}

// Run
main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});

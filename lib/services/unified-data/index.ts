/**
 * Unified Health Data Service
 *
 * Provides a unified interface for health data from all providers.
 * Consolidates data into a single schema for easy querying and analysis.
 *
 * Usage:
 * ```typescript
 * import { transformOuraSleep, writeUnifiedRecord, getUnifiedHealthDaily } from '@/lib/services/unified-data';
 *
 * // Transform and write Oura sleep data
 * const unifiedRecord = transformOuraSleep(email, ouraSleepData);
 * await writeUnifiedRecord(unifiedRecord);
 *
 * // Get user's health context
 * const dailyData = await getUnifiedHealthDaily(email, { days: 30 });
 * ```
 */

// Types
export * from './types';

// Adapters
export {
  // Oura
  transformOuraSleep,
  transformOuraReadiness,
  transformOuraActivity,
  transformOuraSleepBatch,
  // Whoop
  transformWhoopRecovery,
  transformWhoopSleep,
  transformWhoopWorkout,
  transformWhoopRecoveryBatch,
  // Gmail/Slack/Outlook/Teams
  transformGmailPatterns,
  transformSlackPatterns,
  transformOutlookPatterns,
  transformTeamsPatterns,
  // Dexcom
  transformDexcomGlucose,
  // Apple Health
  transformAppleHealthSleep,
  transformAppleHealthActivity,
  transformAppleHealthWorkout,
  // Strava
  transformStravaActivity,
  transformStravaActivityBatch,
  // Fitbit
  transformFitbitActivity,
  transformFitbitSleep,
  // Spotify
  transformSpotifyMood,
  // Notion
  transformNotionProductivity,
  // Linear
  transformLinearProductivity,
} from './adapters';

// Writer
export {
  writeUnifiedRecord,
  writeUnifiedRecords,
  dualWriteUnifiedRecord,
  dualWriteUnifiedRecords,
  getUnifiedHealthData,
  getUnifiedHealthDaily,
  getLatestHealthContext,
  updateDailyRollup,
  groupByProvider,
} from './writer';

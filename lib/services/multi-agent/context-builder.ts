/**
 * Context Builder - Fetches all user data from database to build UserContext
 */

import { createAdminClient } from '@/lib/supabase/server';
import { DataSource, UserContext, UserPreferences, LearnedPattern, PatternType, DeepContentContext } from './types';
import { getCombinedDeepAnalysis } from '@/lib/services/deep-content-analyzer';

/**
 * Build UserContext by fetching all available data for a user
 */
export async function buildUserContext(email: string, userId?: string): Promise<UserContext> {
  const supabase = createAdminClient();
  const availableDataSources: DataSource[] = [];

  const context: UserContext = {
    email,
    userId,
    availableDataSources: [],
  };

  // Fetch Whoop data
  try {
    const { data: whoopData } = await supabase
      .from('forge_training_data')
      .select('*')
      .eq('email', email)
      .eq('provider', 'whoop')
      .order('sync_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (whoopData) {
      // Map the database columns to our expected format
      // recovery_score contains: { avgRecoveryScore, trend, greenDays, yellowDays, redDays }
      // hrv_trends contains: { avgHRV, trend, baseline }
      const rs = whoopData.recovery_score || {};
      const hrv = whoopData.hrv_trends || {};
      const rhr = whoopData.resting_hr_trends || {};

      context.whoop = {
        avgRecoveryScore: rs.avgRecoveryScore,
        avgStrainScore: rs.avgDailyStrain,
        avgHRV: hrv.avgHRV,
        avgRestingHR: rhr.avg,
        recoveryTrend: rs.trend,
        strainTrend: rs.strainTrend,
        recoveryZones: {
          greenDays: rs.greenDays || 0,
          yellowDays: rs.yellowDays || 0,
          redDays: rs.redDays || 0,
        },
        hrvPatterns: {
          baseline: hrv.baseline,
          currentWeekAvg: hrv.avgHRV,
          trend: hrv.trend,
        },
      };
      availableDataSources.push('whoop');
      console.log('[ContextBuilder] Found Whoop data:', JSON.stringify(context.whoop));
    }
  } catch (e) {
    console.log('[ContextBuilder] No Whoop data:', e);
  }

  // Fetch Oura data from oura_data table (where sync stores it)
  try {
    const { data: ouraData } = await supabase
      .from('oura_data')
      .select('*')
      .eq('email', email)
      .order('sync_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ouraData) {
      // Extract metrics from sleep_data, readiness_data arrays
      const sleepData = ouraData.sleep_data || [];
      const readinessData = ouraData.readiness_data || [];

      // Calculate averages from recent data
      const avgSleepScore = average(sleepData.map((d: { score?: number }) => d.score).filter(Boolean));
      const avgReadinessScore = average(readinessData.map((d: { score?: number }) => d.score).filter(Boolean));
      const avgHRV = average(readinessData.map((d: { contributors?: { hrv_balance?: number } }) =>
        d.contributors?.hrv_balance).filter(Boolean));

      context.oura = {
        avgSleepScore,
        avgReadinessScore,
        avgHRV,
        sleepData: sleepData.slice(0, 7), // Last 7 days
        readinessData: readinessData.slice(0, 7),
      };
      availableDataSources.push('oura');
      console.log('[ContextBuilder] Found Oura data:', {
        sleepRecords: sleepData.length,
        readinessRecords: readinessData.length,
        avgSleepScore,
        avgReadinessScore,
      });
    }
  } catch (e) {
    console.log('[ContextBuilder] No Oura data:', e);
  }

  // Fetch Gmail patterns
  try {
    const { data: gmailData } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'gmail')
      .order('sync_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (gmailData?.patterns) {
      context.gmail = gmailData.patterns;
      availableDataSources.push('gmail');
      console.log('[ContextBuilder] Found Gmail patterns');
    }
  } catch (e) {
    console.log('[ContextBuilder] No Gmail data:', e);
  }

  // Fetch Slack patterns
  try {
    const { data: slackData } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'slack')
      .order('sync_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (slackData?.patterns) {
      context.slack = slackData.patterns;
      availableDataSources.push('slack');
      console.log('[ContextBuilder] Found Slack patterns');
    }
  } catch (e) {
    console.log('[ContextBuilder] No Slack data:', e);
  }

  // Fetch Dexcom data
  try {
    const { data: dexcomData } = await supabase
      .from('dexcom_data')
      .select('*')
      .eq('user_email', email)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dexcomData?.analysis) {
      context.dexcom = dexcomData.analysis;
      availableDataSources.push('dexcom');
      console.log('[ContextBuilder] Found Dexcom data');
    }
  } catch (e) {
    console.log('[ContextBuilder] No Dexcom data:', e);
  }

  // Fetch Blood biomarkers
  try {
    const { data: bloodData } = await supabase
      .from('sage_onboarding_data')
      .select('lab_file_analysis')
      .eq('email', email)
      .maybeSingle();

    if (bloodData?.lab_file_analysis) {
      context.bloodBiomarkers = bloodData.lab_file_analysis;
      availableDataSources.push('blood_biomarkers');
      console.log('[ContextBuilder] Found blood biomarkers');
    }
  } catch (e) {
    console.log('[ContextBuilder] No blood data:', e);
  }

  // Fetch Apple Health data (synced via /api/health/sync)
  try {
    const { data: healthData } = await supabase
      .from('apple_health_data')
      .select('*')
      .eq('user_email', email)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (healthData?.data) {
      context.appleHealth = healthData.data;
      availableDataSources.push('apple_health');
      console.log('[ContextBuilder] Found Apple Health data');
    }
  } catch (e) {
    console.log('[ContextBuilder] No Apple Health data:', e);
  }

  // Fetch Life Context (for deep analysis)
  try {
    const { data: lifeContextData } = await supabase
      .from('user_life_context')
      .select('*')
      .eq('user_email', email)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lifeContextData) {
      context.lifeContext = {
        upcomingEvents: lifeContextData.upcoming_events,
        activePatterns: lifeContextData.active_patterns,
        workContext: lifeContextData.work_context,
      };
      console.log('[ContextBuilder] Found life context');
    }
  } catch (e) {
    console.log('[ContextBuilder] No life context:', e);
  }

  context.availableDataSources = availableDataSources;

  // Fetch learned patterns from user feedback
  try {
    const userPreferences = await fetchUserPreferences(supabase, email);
    if (userPreferences) {
      context.userPreferences = userPreferences;
      console.log('[ContextBuilder] Found user preferences from feedback');
    }
  } catch (e) {
    console.log('[ContextBuilder] No learned patterns:', e);
  }

  // Fetch recent feedback comments for additional context
  try {
    const recentComments = await fetchRecentFeedbackComments(supabase, email);
    if (recentComments.length > 0) {
      context.recentFeedbackComments = recentComments;
      console.log(`[ContextBuilder] Found ${recentComments.length} recent feedback comments`);
    }
  } catch (e) {
    console.log('[ContextBuilder] No recent feedback:', e);
  }

  // Fetch deep content analysis (tasks, urgency, interruptions)
  try {
    console.log(`[ContextBuilder] Fetching deep content for ${email}...`);
    const deepAnalysis = await getCombinedDeepAnalysis(email);
    console.log(`[ContextBuilder] Deep analysis result:`, deepAnalysis ? {
      pendingTasks: deepAnalysis.pendingTasks?.length || 0,
      responseDebtCount: deepAnalysis.responseDebt?.count || 0,
      activeThreads: deepAnalysis.activeThreads?.length || 0,
    } : 'null');

    if (deepAnalysis && (
      deepAnalysis.pendingTasks.length > 0 ||
      deepAnalysis.responseDebt.count > 0 ||
      (deepAnalysis.activeThreads && deepAnalysis.activeThreads.length > 0)
    )) {
      context.deepContent = {
        pendingTasks: deepAnalysis.pendingTasks.map(t => ({
          id: t.id,
          description: t.description,
          source: t.source,
          requester: t.requester,
          requesterRole: t.requesterRole,
          deadline: t.deadline,
          urgency: t.urgency,
          urgencyScore: t.urgencyScore,
          category: t.category,
        })),
        responseDebt: {
          count: deepAnalysis.responseDebt.count,
          highPriorityCount: deepAnalysis.responseDebt.highPriorityCount,
          oldestPending: deepAnalysis.responseDebt.oldestPending,
          messages: deepAnalysis.responseDebt.messages.slice(0, 5),
        },
        interruptionSummary: deepAnalysis.interruptionSummary,
        keyPeople: deepAnalysis.keyPeople.map(p => ({
          name: p.name,
          relationship: p.relationship,
          communicationFrequency: p.communicationFrequency,
          avgUrgencyOfRequests: p.avgUrgencyOfRequests,
        })),
        activeThreads: deepAnalysis.activeThreads.slice(0, 5).map(t => ({
          topic: t.topic,
          urgency: t.urgency,
          participants: t.participants || [],
          pendingActions: t.pendingActions || [],
        })),
        analyzedAt: deepAnalysis.analyzedAt,
      };
      console.log(`[ContextBuilder] Found deep content: ${deepAnalysis.pendingTasks.length} tasks, ${deepAnalysis.responseDebt.count} awaiting response`);
    }
  } catch (e) {
    console.log('[ContextBuilder] No deep content analysis:', e);
  }

  // Fetch Travel Context (detect if user is traveling based on timezone changes)
  try {
    // Get the most recent device context entries
    const { data: deviceContextData } = await supabase
      .from('user_device_context')
      .select('timezone, timezone_offset, travel_detected, synced_at')
      .eq('email', email)
      .order('synced_at', { ascending: false })
      .limit(10);

    if (deviceContextData && deviceContextData.length > 0) {
      const latestContext = deviceContextData[0];

      // Determine home timezone (most common timezone in history, or first one)
      const timezoneCounts: Record<string, number> = {};
      deviceContextData.forEach(dc => {
        timezoneCounts[dc.timezone] = (timezoneCounts[dc.timezone] || 0) + 1;
      });
      const homeTimezone = Object.entries(timezoneCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || latestContext.timezone;

      // Check if currently traveling (different timezone than home)
      const isCurrentlyTraveling = latestContext.timezone !== homeTimezone;

      if (isCurrentlyTraveling || latestContext.travel_detected) {
        // Find when travel started (first different timezone)
        const travelStart = deviceContextData.find(dc => dc.timezone !== homeTimezone);

        context.travelContext = {
          isCurrentlyTraveling: true,
          homeTimezone,
          currentTimezone: latestContext.timezone,
          timezoneOffsetChange: latestContext.timezone_offset - (deviceContextData.find(dc => dc.timezone === homeTimezone)?.timezone_offset || 0),
          travelStartDate: travelStart?.synced_at,
          travelType: Math.abs(latestContext.timezone_offset - (deviceContextData.find(dc => dc.timezone === homeTimezone)?.timezone_offset || 0)) > 3
            ? 'international'
            : 'timezone_shift',
          lastSyncedAt: latestContext.synced_at,
        };
        console.log(`[ContextBuilder] Travel detected: ${homeTimezone} -> ${latestContext.timezone}`);
      }
    }
  } catch (e) {
    console.log('[ContextBuilder] No travel context:', e);
  }

  console.log(`[ContextBuilder] Built context with ${availableDataSources.length} data sources`);

  return context;
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Fetch and process learned patterns into UserPreferences
 */
async function fetchUserPreferences(
  supabase: ReturnType<typeof createAdminClient>,
  email: string
): Promise<UserPreferences | null> {
  // First get the user ID from email
  const { data: userData } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!userData?.id) {
    // Try auth.users table as fallback
    const { data: authData } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!authData?.id) return null;
  }

  const userId = userData?.id;

  // Fetch learned patterns
  const { data: patterns } = await supabase
    .from('learned_patterns')
    .select('*')
    .eq('user_id', userId)
    .gte('confidence', 0.5) // Only patterns with reasonable confidence
    .order('last_updated', { ascending: false });

  if (!patterns || patterns.length === 0) return null;

  // Process patterns into UserPreferences
  const avoidances: UserPreferences['avoidances'] = [];
  const preferences: UserPreferences['preferences'] = [];
  const typicalModifications: UserPreferences['typicalModifications'] = [];
  const constraints: UserPreferences['constraints'] = [];

  for (const pattern of patterns) {
    const patternType = pattern.pattern_type as PatternType;
    const conditions = pattern.conditions as Record<string, unknown>;

    switch (patternType) {
      case 'avoidance':
        avoidances.push({
          taskType: pattern.task_type,
          reason: conditions.reason as string | undefined,
          confidence: pattern.confidence,
        });
        break;

      case 'preference':
        preferences.push({
          taskType: pattern.task_type,
          preferredTime: conditions.preferred_time as string | undefined,
          confidence: pattern.confidence,
        });
        break;

      case 'timing':
        preferences.push({
          taskType: pattern.task_type,
          preferredTime: conditions.preferred_time as string | undefined,
          confidence: pattern.confidence,
        });
        break;

      case 'modification':
        const mods = conditions.modifications as string[] | undefined;
        const commonMods = conditions.common_modifications as Record<string, unknown> | undefined;
        if (mods && mods.length > 0) {
          typicalModifications.push({
            taskType: pattern.task_type,
            modification: mods[mods.length - 1], // Most recent modification
            confidence: pattern.confidence,
          });
        }
        if (commonMods?.common_keywords) {
          typicalModifications.push({
            taskType: pattern.task_type,
            modification: `Common themes: ${(commonMods.common_keywords as string[]).join(', ')}`,
            confidence: pattern.confidence,
          });
        }
        break;
    }
  }

  // Only return if we have meaningful preferences
  if (avoidances.length === 0 && preferences.length === 0 &&
      typicalModifications.length === 0 && constraints.length === 0) {
    return null;
  }

  return {
    avoidances,
    preferences,
    typicalModifications,
    constraints,
  };
}

/**
 * Fetch recent feedback comments that provide context
 */
async function fetchRecentFeedbackComments(
  supabase: ReturnType<typeof createAdminClient>,
  email: string
): Promise<Array<{ taskType: string; action: string; comment: string; timestamp: Date }>> {
  // First get the user ID from email
  const { data: userData } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!userData?.id) return [];

  // Fetch recent feedback with comments
  const { data: feedback } = await supabase
    .from('user_feedback')
    .select('task_type, action, user_comment, timestamp')
    .eq('user_id', userData.id)
    .not('user_comment', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(10);

  if (!feedback) return [];

  return feedback
    .filter((f) => f.user_comment && f.user_comment.trim().length > 0)
    .map((f) => ({
      taskType: f.task_type,
      action: f.action,
      comment: f.user_comment!,
      timestamp: new Date(f.timestamp),
    }));
}

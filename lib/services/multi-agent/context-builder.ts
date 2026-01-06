/**
 * Context Builder - Fetches all user data from database to build UserContext
 */

import { createAdminClient } from '@/lib/supabase/server';
import { DataSource, UserContext } from './types';

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
      .eq('user_email', email)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (whoopData?.analysis_result) {
      context.whoop = whoopData.analysis_result;
      availableDataSources.push('whoop');
      console.log('[ContextBuilder] Found Whoop data');
    }
  } catch (e) {
    console.log('[ContextBuilder] No Whoop data:', e);
  }

  // Fetch Oura data
  try {
    const { data: ouraData } = await supabase
      .from('oura_daily_data')
      .select('*')
      .eq('user_email', email)
      .order('date', { ascending: false })
      .limit(30);

    if (ouraData && ouraData.length > 0) {
      // Aggregate Oura data
      const avgSleepScore = average(ouraData.map((d) => d.sleep_score).filter(Boolean));
      const avgReadinessScore = average(ouraData.map((d) => d.readiness_score).filter(Boolean));
      const avgHRV = average(ouraData.map((d) => d.hrv).filter(Boolean));

      context.oura = {
        avgSleepScore,
        avgReadinessScore,
        avgHRV,
      };
      availableDataSources.push('oura');
      console.log('[ContextBuilder] Found Oura data');
    }
  } catch (e) {
    console.log('[ContextBuilder] No Oura data:', e);
  }

  // Fetch Gmail patterns
  try {
    const { data: gmailData } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('user_email', email)
      .eq('source', 'gmail')
      .order('analyzed_at', { ascending: false })
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
      .eq('user_email', email)
      .eq('source', 'slack')
      .order('analyzed_at', { ascending: false })
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
  console.log(`[ContextBuilder] Built context with ${availableDataSources.length} data sources`);

  return context;
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

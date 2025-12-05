/**
 * MCP Sync Service
 *
 * Orchestrates data synchronization from all connected integrations.
 * Handles parallel fetching, smart scheduling, error tracking, and data quality metrics.
 *
 * @module lib/services/mcp-sync
 */

import { createClient } from '@/lib/supabase/server';
import { getUserIntegrations, type Provider } from '@/lib/services/token-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncConfig {
  provider: Provider;
  endpoint: string;
  interval: number; // minutes
  priority: 'high' | 'medium' | 'low';
  timeout: number; // milliseconds
}

export interface SyncResult {
  provider: Provider;
  success: boolean;
  dataPointsAnalyzed?: number;
  error?: string;
  duration: number; // milliseconds
  syncedAt: string;
}

export interface DataQualityMetrics {
  provider: Provider;
  completeness: number; // 0-100
  freshness: number; // hours since last sync
  confidence: number; // 0-100
  dataGaps: string[];
}

export interface MCPSyncStatus {
  userEmail: string;
  totalIntegrations: number;
  activeIntegrations: number;
  syncResults: SyncResult[];
  dataQuality: DataQualityMetrics[];
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  lastSyncAt: string;
}

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

/**
 * Sync configuration for each provider
 * Defines endpoints, refresh intervals, and priorities
 */
const SYNC_CONFIGS: Record<string, SyncConfig> = {
  // Communication integrations - more frequent updates (SAGE)
  gmail: {
    provider: 'gmail',
    endpoint: '/api/gmail/fetch-data',
    interval: 360, // 6 hours
    priority: 'high',
    timeout: 45000, // 45 seconds
  },
  slack: {
    provider: 'slack',
    endpoint: '/api/slack/fetch-data',
    interval: 360, // 6 hours
    priority: 'high',
    timeout: 45000, // 45 seconds
  },

  // Wearable/health integrations - less frequent for battery/cost (SAGE)
  oura: {
    provider: 'oura',
    endpoint: '/api/oura/sync',
    interval: 1440, // 24 hours (once daily)
    priority: 'medium',
    timeout: 60000, // 60 seconds
  },
  dexcom: {
    provider: 'dexcom',
    endpoint: '/api/dexcom/sync',
    interval: 60, // 1 hour (for CGM real-time data)
    priority: 'high',
    timeout: 30000, // 30 seconds
  },
  fitbit: {
    provider: 'fitbit',
    endpoint: '/api/fitbit/sync',
    interval: 1440, // 24 hours
    priority: 'medium',
    timeout: 60000, // 60 seconds
  },

  // Training/performance integrations (FORGE)
  strava: {
    provider: 'strava',
    endpoint: '/api/strava/fetch-data',
    interval: 1440, // 24 hours (once daily for workouts)
    priority: 'high', // High priority for Forge
    timeout: 60000, // 60 seconds
  },
  whoop: {
    provider: 'whoop',
    endpoint: '/api/whoop/fetch-data',
    interval: 360, // 6 hours (more frequent for recovery tracking)
    priority: 'high', // High priority for Forge recovery data
    timeout: 45000, // 45 seconds
  },
};

// ============================================================================
// SYNC HELPERS
// ============================================================================

/**
 * Check if a provider needs syncing based on last sync time and interval
 */
async function needsSync(
  email: string,
  provider: Provider
): Promise<boolean> {
  const config = SYNC_CONFIGS[provider];
  if (!config) return false;

  const supabase = await createClient();

  // Check behavioral_patterns for communication integrations
  if (provider === 'gmail' || provider === 'slack') {
    const { data } = await supabase
      .from('behavioral_patterns')
      .select('sync_date')
      .eq('email', email)
      .eq('source', provider)
      .order('sync_date', { ascending: false })
      .limit(1)
      .single();

    if (!data) return true; // Never synced

    const lastSync = new Date(data.sync_date);
    const now = new Date();
    const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (60 * 1000);

    return minutesSinceSync >= config.interval;
  }

  // Check specific tables for other integrations
  const tableMap: Record<string, string> = {
    oura: 'oura_data',
    dexcom: 'dexcom_data',
    fitbit: 'fitbit_data',
    vital: 'vital_data',
  };

  // Check Forge training data for Strava/Whoop
  if (provider === 'strava' || provider === 'whoop') {
    const { data } = await supabase
      .from('forge_training_data')
      .select('sync_date')
      .eq('email', email)
      .eq('provider', provider)
      .order('sync_date', { ascending: false })
      .limit(1)
      .single();

    if (!data) return true; // Never synced

    const lastSync = new Date(data.sync_date);
    const now = new Date();
    const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (60 * 1000);

    return minutesSinceSync >= config.interval;
  }

  const tableName = tableMap[provider];
  if (!tableName) return false;

  const { data } = await supabase
    .from(tableName)
    .select('sync_date')
    .eq('email', email)
    .order('sync_date', { ascending: false })
    .limit(1)
    .single();

  if (!data) return true; // Never synced

  const lastSync = new Date(data.sync_date);
  const now = new Date();
  const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (60 * 1000);

  return minutesSinceSync >= config.interval;
}

/**
 * Sync data from a single provider
 */
async function syncProvider(
  email: string,
  provider: Provider,
  baseUrl: string
): Promise<SyncResult> {
  const config = SYNC_CONFIGS[provider];
  if (!config) {
    return {
      provider,
      success: false,
      error: 'Provider not configured',
      duration: 0,
      syncedAt: new Date().toISOString(),
    };
  }

  const startTime = Date.now();
  console.log(`[MCP Sync] Starting sync for ${provider} (${email})`);

  try {
    // Call the provider's sync endpoint
    const response = await fetch(`${baseUrl}${config.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(config.timeout),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[MCP Sync] ${provider} sync failed:`, errorData);

      return {
        provider,
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
        duration,
        syncedAt: new Date().toISOString(),
      };
    }

    const result = await response.json();

    console.log(`[MCP Sync] ${provider} sync completed in ${duration}ms`);

    return {
      provider,
      success: true,
      dataPointsAnalyzed: result.dataPointsAnalyzed || result.recordCount || 0,
      duration,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[MCP Sync] ${provider} sync error:`, error);

    return {
      provider,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      syncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate data quality metrics for a provider
 */
async function calculateDataQuality(
  email: string,
  provider: Provider
): Promise<DataQualityMetrics> {
  const supabase = await createClient();
  let completeness = 0;
  let freshness = 999;
  let confidence = 0;
  const dataGaps: string[] = [];

  try {
    // Check behavioral_patterns for communication integrations
    if (provider === 'gmail' || provider === 'slack') {
      const { data } = await supabase
        .from('behavioral_patterns')
        .select('*')
        .eq('email', email)
        .eq('source', provider)
        .order('sync_date', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const lastSync = new Date(data.sync_date);
        const now = new Date();
        freshness = (now.getTime() - lastSync.getTime()) / (60 * 60 * 1000); // hours

        const dataPoints = data.data_points_analyzed || 0;
        completeness = Math.min(100, (dataPoints / 100) * 100); // Expect ~100+ data points

        // Calculate confidence based on data quality
        if (dataPoints > 200) confidence = 90;
        else if (dataPoints > 100) confidence = 75;
        else if (dataPoints > 50) confidence = 50;
        else confidence = 25;

        if (dataPoints < 50) {
          dataGaps.push('Limited data points for reliable patterns');
        }
        if (freshness > 24) {
          dataGaps.push('Data older than 24 hours');
        }
      } else {
        dataGaps.push('No data available');
      }
    }

    // Check wearable data
    const tableMap: Record<string, string> = {
      oura: 'oura_data',
      dexcom: 'dexcom_data',
      fitbit: 'fitbit_data',
      strava: 'strava_data',
      vital: 'vital_data',
    };

    const tableName = tableMap[provider];
    if (tableName) {
      const { data } = await supabase
        .from(tableName)
        .select('*')
        .eq('email', email)
        .order('sync_date', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const lastSync = new Date(data.sync_date);
        const now = new Date();
        freshness = (now.getTime() - lastSync.getTime()) / (60 * 60 * 1000); // hours

        // Provider-specific completeness checks
        if (provider === 'oura') {
          const sleepDays = (data.sleep_data as Array<unknown> || []).length;
          completeness = Math.min(100, (sleepDays / 30) * 100); // Expect 30 days
          confidence = sleepDays >= 7 ? 80 : 50;
          if (sleepDays < 7) dataGaps.push('Less than 7 days of sleep data');
        } else if (provider === 'dexcom') {
          const readingsCount = (data.egv_data as Array<unknown> || []).length;
          completeness = Math.min(100, (readingsCount / 1000) * 100); // Expect ~1000+ readings/month
          confidence = readingsCount >= 500 ? 85 : 60;
          if (readingsCount < 500) dataGaps.push('Limited glucose readings');
        } else {
          completeness = 70; // Default for other providers
          confidence = 60;
        }

        if (freshness > 48) {
          dataGaps.push('Data older than 48 hours');
        }
      } else {
        dataGaps.push('No data available');
      }
    }
  } catch (error) {
    console.error(`[MCP Sync] Error calculating quality for ${provider}:`, error);
    dataGaps.push('Error accessing data');
  }

  return {
    provider,
    completeness: Math.round(completeness),
    freshness: Math.round(freshness * 10) / 10,
    confidence: Math.round(confidence),
    dataGaps,
  };
}

// ============================================================================
// MAIN SYNC FUNCTIONS
// ============================================================================

/**
 * Sync data from all connected integrations for a user
 * Runs syncs in parallel with appropriate timeouts
 */
export async function syncAllIntegrations(
  email: string,
  options?: {
    forceSync?: boolean; // Skip interval check
    providers?: Provider[]; // Only sync specific providers
    baseUrl?: string; // Base URL for API calls
  }
): Promise<MCPSyncStatus> {
  console.log(`[MCP Sync] Starting sync for ${email}`);

  const startTime = Date.now();
  const baseUrl = options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Get user's active integrations from token manager
  const { integrations, error: integrationsError } = await getUserIntegrations(email);

  if (integrationsError || !integrations) {
    console.error('[MCP Sync] Failed to get user integrations:', integrationsError);
    return {
      userEmail: email,
      totalIntegrations: 0,
      activeIntegrations: 0,
      syncResults: [],
      dataQuality: [],
      overallHealth: 'poor',
      lastSyncAt: new Date().toISOString(),
    };
  }

  // Filter to only configured providers
  const activeProviders = integrations
    .filter(p => SYNC_CONFIGS[p] !== undefined);

  // Further filter if specific providers requested
  const providersToSync = options?.providers
    ? activeProviders.filter(p => options.providers!.includes(p))
    : activeProviders;

  console.log(`[MCP Sync] Found ${providersToSync.length} active integrations:`, providersToSync);

  // Check which providers need syncing
  const syncNeeded = options?.forceSync
    ? providersToSync
    : await Promise.all(
        providersToSync.map(async (provider: Provider) => {
          const needs = await needsSync(email, provider);
          return needs ? provider : null;
        })
      ).then(results => results.filter((p): p is Provider => p !== null));

  console.log(`[MCP Sync] ${syncNeeded.length} providers need syncing:`, syncNeeded);

  // Sync providers in parallel
  const syncResults = await Promise.all(
    syncNeeded.map(provider => syncProvider(email, provider, baseUrl))
  );

  // Calculate data quality for all active providers
  const dataQuality = await Promise.all(
    activeProviders.map((provider: Provider) => calculateDataQuality(email, provider))
  );

  // Calculate overall health
  const avgConfidence = dataQuality.length > 0
    ? dataQuality.reduce((sum, dq) => sum + dq.confidence, 0) / dataQuality.length
    : 0;

  const overallHealth: MCPSyncStatus['overallHealth'] =
    avgConfidence >= 80 ? 'excellent' :
    avgConfidence >= 60 ? 'good' :
    avgConfidence >= 40 ? 'fair' : 'poor';

  const duration = Date.now() - startTime;
  console.log(`[MCP Sync] Completed in ${duration}ms. Overall health: ${overallHealth}`);

  return {
    userEmail: email,
    totalIntegrations: integrations.length,
    activeIntegrations: activeProviders.length,
    syncResults,
    dataQuality,
    overallHealth,
    lastSyncAt: new Date().toISOString(),
  };
}

/**
 * Get sync recommendations for a user
 * Identifies which integrations should be connected for better insights
 */
export async function getSyncRecommendations(email: string): Promise<{
  connected: Provider[];
  recommended: Array<{
    provider: Provider;
    reason: string;
    benefit: string;
  }>;
}> {
  const { integrations } = await getUserIntegrations(email);
  const connected = integrations || [];

  const allProviders: Provider[] = [
    'gmail', 'slack', 'oura', 'dexcom', 'fitbit', 'strava', 'whoop'
  ];

  const notConnected = allProviders.filter(p => !connected.includes(p));

  const recommendations = notConnected.map(provider => {
    const reasons: Record<string, { reason: string; benefit: string }> = {
      gmail: {
        reason: 'Not connected to Google Calendar/Gmail',
        benefit: 'Enable meal timing optimization based on meeting schedule and stress pattern detection'
      },
      slack: {
        reason: 'Not connected to Slack',
        benefit: 'Detect work-life balance issues and collaboration stress patterns'
      },
      oura: {
        reason: 'No sleep tracking data',
        benefit: 'Monitor sleep quality, HRV, and recovery for better plan personalization'
      },
      dexcom: {
        reason: 'No continuous glucose monitoring',
        benefit: 'Track glucose responses to meals and identify optimal timing for nutrition'
      },
      fitbit: {
        reason: 'No fitness tracking data',
        benefit: 'Monitor activity levels and heart rate for workout and nutrition optimization'
      },
      strava: {
        reason: 'No workout tracking',
        benefit: 'Sync training data for better pre/post-workout nutrition timing'
      },
      whoop: {
        reason: 'No recovery tracking',
        benefit: 'Optimize nutrition based on strain and recovery metrics'
      },
    };

    return {
      provider,
      ...reasons[provider]
    };
  });

  return {
    connected,
    recommended: recommendations
  };
}

/**
 * Get sync status for a user without triggering new syncs
 */
export async function getSyncStatus(email: string): Promise<MCPSyncStatus> {
  const { integrations } = await getUserIntegrations(email);
  const activeProviders = (integrations || [])
    .filter(p => SYNC_CONFIGS[p] !== undefined);

  const dataQuality = await Promise.all(
    activeProviders.map((provider: Provider) => calculateDataQuality(email, provider))
  );

  const avgConfidence = dataQuality.length > 0
    ? dataQuality.reduce((sum, dq) => sum + dq.confidence, 0) / dataQuality.length
    : 0;

  const overallHealth: MCPSyncStatus['overallHealth'] =
    avgConfidence >= 80 ? 'excellent' :
    avgConfidence >= 60 ? 'good' :
    avgConfidence >= 40 ? 'fair' : 'poor';

  return {
    userEmail: email,
    totalIntegrations: integrations?.length || 0,
    activeIntegrations: activeProviders.length,
    syncResults: [],
    dataQuality,
    overallHealth,
    lastSyncAt: new Date().toISOString(),
  };
}

/**
 * Context Health Service
 * Tracks data freshness and completeness for all context sources
 * Provides health status to agents so they can acknowledge uncertainty
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type DataSource =
  | 'oura'
  | 'whoop'
  | 'fitbit'
  | 'garmin'
  | 'apple_health'
  | 'dexcom'
  | 'freestyle_libre'
  | 'strava'
  | 'google'
  | 'outlook'
  | 'spotify'
  | 'sage'           // Nutrition data
  | 'forge'          // Training data
  | 'goals'
  | 'interventions'
  | 'memory'
  | 'calendar';

export type StalenessLevel = 'fresh' | 'warning' | 'critical' | 'unavailable';
export type SourceStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface ContextSourceHealth {
  source: DataSource;
  displayName: string;
  status: SourceStatus;
  staleness: StalenessLevel;
  lastSyncAt: string | null;
  timeSinceSync: string | null;       // Human-readable: "2 hours ago"
  dataPoints: number;                  // Approximate data points available
  lastError?: string;
  isRequired: boolean;                 // Is this source required for the query?
}

export interface ContextHealthReport {
  overall: 'healthy' | 'degraded' | 'critical';
  sources: ContextSourceHealth[];
  warnings: string[];
  freshSources: string[];
  staleSources: string[];
  unavailableSources: string[];
  completenessScore: number;           // 0-100%
  generatedAt: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Staleness thresholds by source type (in hours)
const STALENESS_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  // Real-time wearables
  oura: { warning: 6, critical: 24 },
  whoop: { warning: 6, critical: 24 },
  dexcom: { warning: 1, critical: 4 },         // CGM data gets stale fast
  freestyle_libre: { warning: 1, critical: 4 },

  // Hourly sync wearables
  fitbit: { warning: 12, critical: 48 },
  garmin: { warning: 12, critical: 48 },
  strava: { warning: 24, critical: 72 },

  // Daily sync sources
  apple_health: { warning: 24, critical: 72 },

  // Productivity (real-time)
  google: { warning: 1, critical: 6 },
  outlook: { warning: 1, critical: 6 },
  spotify: { warning: 24, critical: 168 },      // Music history less time-sensitive

  // Internal data (always fresh)
  sage: { warning: 168, critical: 720 },        // Nutrition profiles rarely change
  forge: { warning: 168, critical: 720 },
  goals: { warning: 24, critical: 168 },
  interventions: { warning: 24, critical: 168 },
  memory: { warning: 168, critical: 720 },
  calendar: { warning: 1, critical: 6 },
};

const SOURCE_DISPLAY_NAMES: Record<DataSource, string> = {
  oura: 'Oura Ring',
  whoop: 'WHOOP',
  fitbit: 'Fitbit',
  garmin: 'Garmin',
  apple_health: 'Apple Health',
  dexcom: 'Dexcom CGM',
  freestyle_libre: 'Freestyle Libre',
  strava: 'Strava',
  google: 'Google',
  outlook: 'Microsoft Outlook',
  spotify: 'Spotify',
  sage: 'Nutrition Data',
  forge: 'Training Data',
  goals: 'Health Goals',
  interventions: 'Active Interventions',
  memory: 'Conversation Memory',
  calendar: 'Calendar',
};

// Which sources are required for which query types
const QUERY_REQUIRED_SOURCES: Record<string, DataSource[]> = {
  sleep: ['oura', 'whoop', 'fitbit', 'garmin', 'apple_health'],
  glucose: ['dexcom', 'freestyle_libre'],
  nutrition: ['sage', 'dexcom'],
  activity: ['oura', 'whoop', 'fitbit', 'garmin', 'strava', 'apple_health'],
  recovery: ['oura', 'whoop', 'garmin'],
  schedule: ['google', 'outlook', 'calendar'],
  music: ['spotify'],
  goals: ['goals', 'interventions'],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateStaleness(
  lastSyncAt: string | null,
  source: DataSource
): StalenessLevel {
  if (!lastSyncAt) return 'unavailable';

  const thresholds = STALENESS_THRESHOLDS[source] || { warning: 24, critical: 168 };
  const syncDate = new Date(lastSyncAt);
  const hoursSinceSync = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60);

  if (hoursSinceSync <= thresholds.warning) return 'fresh';
  if (hoursSinceSync <= thresholds.critical) return 'warning';
  return 'critical';
}

function formatTimeSince(date: string | null): string | null {
  if (!date) return null;

  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return `${Math.floor(seconds / 604800)} weeks ago`;
}

// =============================================================================
// MAIN SERVICE FUNCTIONS
// =============================================================================

/**
 * Get health status for all context sources for a user
 */
export async function getContextHealth(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<ContextHealthReport> {
  const sources: ContextSourceHealth[] = [];
  const warnings: string[] = [];

  // Get OAuth connections with last sync times
  const { data: connections } = await supabase
    .from('user_oauth_connections')
    .select('provider, connected_at, last_sync, last_error')
    .eq('user_email', userEmail);

  type ConnectionRow = { provider: string; connected_at: string; last_sync?: string; last_error?: string };
  const connectionList = connections as ConnectionRow[] | null;

  const connectionMap = new Map<string, { connected_at: string; last_sync?: string; last_error?: string }>();
  if (connectionList) {
    for (const conn of connectionList) {
      connectionMap.set(conn.provider, {
        connected_at: conn.connected_at,
        last_sync: conn.last_sync,
        last_error: conn.last_error,
      });
    }
  }

  // Check wearable/external sources
  const externalSources: DataSource[] = [
    'oura', 'whoop', 'fitbit', 'garmin', 'apple_health',
    'dexcom', 'freestyle_libre', 'strava', 'google', 'outlook', 'spotify'
  ];

  for (const source of externalSources) {
    const connection = connectionMap.get(source);
    const lastSyncAt = connection?.last_sync || connection?.connected_at || null;
    const staleness = calculateStaleness(lastSyncAt, source);

    const health: ContextSourceHealth = {
      source,
      displayName: SOURCE_DISPLAY_NAMES[source],
      status: connection ? 'connected' : 'disconnected',
      staleness: connection ? staleness : 'unavailable',
      lastSyncAt,
      timeSinceSync: formatTimeSince(lastSyncAt),
      dataPoints: 0, // Will be populated per-source if needed
      lastError: connection?.last_error,
      isRequired: false,
    };

    sources.push(health);

    if (connection && staleness === 'critical') {
      warnings.push(`${SOURCE_DISPLAY_NAMES[source]} data is critically stale (${health.timeSinceSync})`);
    }
  }

  // Check internal data sources
  const internalSources: DataSource[] = ['sage', 'forge', 'goals', 'interventions', 'memory', 'calendar'];

  for (const source of internalSources) {
    let lastSyncAt: string | null = null;
    let dataPoints = 0;

    // Query internal data freshness
    type DateRow = { updated_at?: string; created_at?: string; date?: string };
    switch (source) {
      case 'goals': {
        const { data } = await supabase
          .from('user_health_goals')
          .select('updated_at')
          .eq('user_email', userEmail)
          .order('updated_at', { ascending: false })
          .limit(1);
        const rows = data as DateRow[] | null;
        lastSyncAt = rows?.[0]?.updated_at || null;
        const { count } = await supabase
          .from('user_health_goals')
          .select('*', { count: 'exact', head: true })
          .eq('user_email', userEmail)
          .eq('status', 'active');
        dataPoints = count || 0;
        break;
      }
      case 'interventions': {
        const { data } = await supabase
          .from('user_intervention_experiments')
          .select('updated_at')
          .eq('user_email', userEmail)
          .order('updated_at', { ascending: false })
          .limit(1);
        const rows = data as DateRow[] | null;
        lastSyncAt = rows?.[0]?.updated_at || null;
        const { count } = await supabase
          .from('user_intervention_experiments')
          .select('*', { count: 'exact', head: true })
          .eq('user_email', userEmail)
          .eq('status', 'active');
        dataPoints = count || 0;
        break;
      }
      case 'memory': {
        const { data } = await supabase
          .from('user_memory')
          .select('created_at')
          .eq('user_email', userEmail)
          .order('created_at', { ascending: false })
          .limit(1);
        const rows = data as DateRow[] | null;
        lastSyncAt = rows?.[0]?.created_at || null;
        const { count } = await supabase
          .from('user_memory')
          .select('*', { count: 'exact', head: true })
          .eq('user_email', userEmail);
        dataPoints = count || 0;
        break;
      }
      case 'sage': {
        const { data } = await supabase
          .from('sage_daily_intake')
          .select('date')
          .eq('user_email', userEmail)
          .order('date', { ascending: false })
          .limit(1);
        const rows = data as DateRow[] | null;
        lastSyncAt = rows?.[0]?.date || null;
        const { count } = await supabase
          .from('sage_daily_intake')
          .select('*', { count: 'exact', head: true })
          .eq('user_email', userEmail);
        dataPoints = count || 0;
        break;
      }
      case 'forge': {
        const { data } = await supabase
          .from('forge_workout_logs')
          .select('created_at')
          .eq('user_email', userEmail)
          .order('created_at', { ascending: false })
          .limit(1);
        const rows = data as DateRow[] | null;
        lastSyncAt = rows?.[0]?.created_at || null;
        const { count } = await supabase
          .from('forge_workout_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_email', userEmail);
        dataPoints = count || 0;
        break;
      }
      case 'calendar': {
        // Calendar freshness based on last fetch
        const connection = connectionMap.get('google') || connectionMap.get('outlook');
        lastSyncAt = connection?.last_sync || connection?.connected_at || null;
        dataPoints = connection ? 1 : 0;
        break;
      }
    }

    const staleness = calculateStaleness(lastSyncAt, source);

    sources.push({
      source,
      displayName: SOURCE_DISPLAY_NAMES[source],
      status: dataPoints > 0 || lastSyncAt ? 'connected' : 'disconnected',
      staleness: dataPoints > 0 || lastSyncAt ? staleness : 'unavailable',
      lastSyncAt,
      timeSinceSync: formatTimeSince(lastSyncAt),
      dataPoints,
      isRequired: false,
    });
  }

  // Calculate overall health
  const freshSources = sources.filter(s => s.staleness === 'fresh').map(s => s.displayName);
  const staleSources = sources.filter(s => s.staleness === 'warning' || s.staleness === 'critical').map(s => s.displayName);
  const unavailableSources = sources.filter(s => s.staleness === 'unavailable').map(s => s.displayName);

  const connectedCount = sources.filter(s => s.status === 'connected').length;
  const completenessScore = Math.round((connectedCount / sources.length) * 100);

  let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (staleSources.length > sources.length / 2) overall = 'critical';
  else if (staleSources.length > 0 || unavailableSources.length > 3) overall = 'degraded';

  return {
    overall,
    sources,
    warnings,
    freshSources,
    staleSources,
    unavailableSources,
    completenessScore,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get health for sources relevant to a specific query type
 */
export async function getContextHealthForQuery(
  userEmail: string,
  queryType: string,
  supabase: ReturnType<typeof createClient>
): Promise<ContextHealthReport> {
  const fullReport = await getContextHealth(userEmail, supabase);
  const requiredSources = QUERY_REQUIRED_SOURCES[queryType] || [];

  // Mark which sources are required for this query
  for (const source of fullReport.sources) {
    source.isRequired = requiredSources.includes(source.source);
  }

  // Filter to just required sources for summary
  const requiredSourceHealth = fullReport.sources.filter(s => s.isRequired);
  const freshRequired = requiredSourceHealth.filter(s => s.staleness === 'fresh');

  // Adjust overall health based on required sources
  if (requiredSourceHealth.length > 0) {
    const requiredFreshness = freshRequired.length / requiredSourceHealth.length;
    if (requiredFreshness < 0.3) fullReport.overall = 'critical';
    else if (requiredFreshness < 0.7) fullReport.overall = 'degraded';
  }

  return fullReport;
}

/**
 * Format context health for inclusion in agent prompts
 */
export function formatContextHealthForPrompt(report: ContextHealthReport): string {
  const lines: string[] = ['## Context Data Quality\n'];

  // Overall status
  const statusEmoji = report.overall === 'healthy' ? '✅' : report.overall === 'degraded' ? '⚠️' : '❌';
  lines.push(`**Overall Status**: ${statusEmoji} ${report.overall.toUpperCase()} (${report.completenessScore}% data coverage)\n`);

  // Fresh sources (connected and recent)
  const connectedFresh = report.sources.filter(s => s.status === 'connected' && s.staleness === 'fresh');
  if (connectedFresh.length > 0) {
    lines.push('### ✓ Fresh Data Available');
    for (const s of connectedFresh) {
      const required = s.isRequired ? ' (REQUIRED for this query)' : '';
      lines.push(`- **${s.displayName}**: synced ${s.timeSinceSync}${required}`);
    }
    lines.push('');
  }

  // Stale sources (connected but old)
  const connectedStale = report.sources.filter(
    s => s.status === 'connected' && (s.staleness === 'warning' || s.staleness === 'critical')
  );
  if (connectedStale.length > 0) {
    lines.push('### ⚠️ Stale Data (Use with Caution)');
    for (const s of connectedStale) {
      const level = s.staleness === 'critical' ? '🔴 CRITICAL' : '🟡 WARNING';
      const required = s.isRequired ? ' - REQUIRED for this query' : '';
      lines.push(`- **${s.displayName}**: ${level} - last synced ${s.timeSinceSync}${required}`);
    }
    lines.push('');
  }

  // Disconnected sources
  const disconnected = report.sources.filter(s => s.status === 'disconnected');
  if (disconnected.length > 0) {
    lines.push('### ✗ Not Connected');
    const requiredDisconnected = disconnected.filter(s => s.isRequired);
    const optionalDisconnected = disconnected.filter(s => !s.isRequired);

    if (requiredDisconnected.length > 0) {
      lines.push('**Required for this query (missing):**');
      for (const s of requiredDisconnected) {
        lines.push(`- ${s.displayName}`);
      }
    }
    if (optionalDisconnected.length > 0 && optionalDisconnected.length <= 5) {
      lines.push('Optional:');
      for (const s of optionalDisconnected) {
        lines.push(`- ${s.displayName}`);
      }
    }
    lines.push('');
  }

  // Instructions for agent
  lines.push('### Agent Instructions');
  lines.push('- When using **stale data**, acknowledge uncertainty: "Based on your data from X days ago..."');
  lines.push('- When **required sources are missing**, suggest the user connect them');
  lines.push('- Prefer fresh data sources when multiple options available');

  return lines.join('\n');
}

/**
 * Log context health check for analytics
 */
export async function logContextHealthCheck(
  userEmail: string,
  report: ContextHealthReport,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // Log each source status
    const logs = report.sources.map(source => ({
      user_email: userEmail,
      source: source.source as string,
      status: source.staleness === 'unavailable' ? 'not_connected' : source.staleness,
      last_sync_at: source.lastSyncAt,
      checked_at: new Date().toISOString(),
    }));

    await (supabase.from('context_health_log') as any).insert(logs);
  } catch (error) {
    console.error('Failed to log context health:', error);
  }
}

/**
 * Detect which query type a user message is about
 */
export function detectQueryType(message: string): string | null {
  const messageLower = message.toLowerCase();

  const patterns: Record<string, string[]> = {
    sleep: ['sleep', 'rest', 'tired', 'insomnia', 'bedtime', 'wake', 'hrv', 'rem', 'deep sleep'],
    glucose: ['glucose', 'blood sugar', 'cgm', 'dexcom', 'libre', 'spike', 'insulin'],
    nutrition: ['eat', 'food', 'meal', 'diet', 'nutrition', 'calories', 'protein', 'carb', 'macro'],
    activity: ['steps', 'workout', 'exercise', 'run', 'walk', 'active', 'training', 'gym'],
    recovery: ['recovery', 'strain', 'readiness', 'body battery', 'energy'],
    schedule: ['calendar', 'meeting', 'schedule', 'appointment', 'event', 'busy'],
    music: ['spotify', 'music', 'playlist', 'song', 'listen'],
    goals: ['goal', 'target', 'progress', 'track', 'achieve'],
  };

  for (const [queryType, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => messageLower.includes(kw))) {
      return queryType;
    }
  }

  return null;
}

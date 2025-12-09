/**
 * Auto-Sync Orchestrator
 *
 * Coordinates automatic syncing of ecosystem data from all connected integrations.
 * Manages TTL-based refresh logic, parallel fetching, error handling, and sync status tracking.
 *
 * Features:
 * - TTL-based sync decisions (default 24 hours)
 * - Parallel data fetching for performance
 * - Graceful error handling (uses cached data on failure)
 * - Per-source sync status tracking
 * - Integration with existing API endpoints
 *
 * @module lib/services/auto-sync
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncOptions {
  ttlHours?: number; // Time-to-live before re-sync (default 24)
  forceSync?: boolean; // Force sync regardless of TTL
  startDate?: Date; // Start of data range
  endDate?: Date; // End of data range
  sources?: string[]; // Specific sources to sync (if undefined, sync all)
}

export interface SyncResult {
  source: string;
  success: boolean;
  recordCount?: number;
  error?: string;
  syncedAt: string;
}

export interface AutoSyncReport {
  email: string;
  planType: 'sage' | 'forge';
  syncResults: SyncResult[];
  successCount: number;
  failureCount: number;
  totalDuration: number;
  timestamp: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify that actual data exists for a source (not just sync timestamp)
 */
async function verifyDataExists(email: string, source: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Check the appropriate table based on source
    if (source === 'gmail' || source === 'slack') {
      const { data } = await supabase
        .from('behavioral_patterns')
        .select('id')
        .eq('email', email)
        .eq('source', source)
        .limit(1);
      return data !== null && data.length > 0;
    }

    if (source === 'oura') {
      const { data } = await supabase
        .from('oura_data')
        .select('id')
        .eq('email', email)
        .limit(1);
      return data !== null && data.length > 0;
    }

    if (source === 'dexcom') {
      const { data } = await supabase
        .from('dexcom_data')
        .select('id')
        .eq('email', email)
        .limit(1);
      return data !== null && data.length > 0;
    }

    if (source === 'vital') {
      const { data } = await supabase
        .from('vital_data')
        .select('id')
        .eq('email', email)
        .limit(1);
      return data !== null && data.length > 0;
    }

    if (source === 'outlook' || source === 'teams') {
      const { data } = await supabase
        .from('behavioral_patterns')
        .select('id')
        .eq('email', email)
        .eq('source', source)
        .limit(1);
      return data !== null && data.length > 0;
    }

    return false; // Unknown source, assume no data
  } catch (error) {
    console.error(`[Auto-Sync] Error verifying data exists for ${source}:`, error);
    return false; // Assume no data on error (will trigger sync)
  }
}

/**
 * Check if a source needs refresh based on TTL AND data existence
 */
async function needsSync(
  email: string,
  planType: 'sage' | 'forge',
  source: string,
  ttlHours: number
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const table = planType === 'sage' ? 'sage_onboarding_data' : 'forge_onboarding_data';

    const { data, error } = await supabase
      .from(table)
      .select('ecosystem_sync_status, last_ecosystem_sync')
      .eq('email', email)
      .single();

    if (error || !data) {
      return true; // Sync if no data found
    }

    // Check last overall sync
    if (data.last_ecosystem_sync) {
      const lastSync = new Date(data.last_ecosystem_sync);
      const ttlMs = ttlHours * 60 * 60 * 1000;
      if (Date.now() - lastSync.getTime() < ttlMs) {
        // Check source-specific sync
        const syncStatus = data.ecosystem_sync_status as Record<string, { lastSync: string; status: string }> || {};
        const sourceStatus = syncStatus[source];

        if (sourceStatus && sourceStatus.lastSync) {
          const sourceLastSync = new Date(sourceStatus.lastSync);
          const withinTTL = Date.now() - sourceLastSync.getTime() < ttlMs;

          if (withinTTL) {
            // TTL says cached - but verify actual data exists!
            const hasData = await verifyDataExists(email, source);
            if (!hasData) {
              console.log(`[Auto-Sync] ${source}: No data found despite recent sync timestamp - forcing resync`);
              return true; // Force sync because no data exists
            }
            return false; // Within TTL and data exists - skip sync
          }
          return true; // Outside TTL - needs sync
        }
      }
    }

    return true; // Default to sync if uncertain
  } catch (error) {
    console.error(`[Auto-Sync] Error checking sync status for ${source}:`, error);
    return true; // Sync on error
  }
}

/**
 * Update sync status in database
 */
async function updateSyncStatus(
  email: string,
  planType: 'sage' | 'forge',
  source: string,
  success: boolean,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = await createClient();
    const table = planType === 'sage' ? 'sage_onboarding_data' : 'forge_onboarding_data';

    // Get current sync status
    const { data: currentData } = await supabase
      .from(table)
      .select('ecosystem_sync_status')
      .eq('email', email)
      .single();

    const currentStatus = (currentData?.ecosystem_sync_status as Record<string, unknown>) || {};

    // Update with new source status
    const newSourceStatus = {
      lastSync: new Date().toISOString(),
      status: success ? 'success' : 'error',
      ...metadata,
    };

    const updatedStatus = {
      ...currentStatus,
      [source]: newSourceStatus,
    };

    // Update database
    await supabase
      .from(table)
      .update({
        ecosystem_sync_status: updatedStatus,
        last_ecosystem_sync: new Date().toISOString(),
      })
      .eq('email', email);

    console.log(`[Auto-Sync] Updated ${source} sync status: ${success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error(`[Auto-Sync] Error updating sync status for ${source}:`, error);
  }
}

// ============================================================================
// SYNC FUNCTIONS (Call existing API endpoints)
// ============================================================================

/**
 * Sync Oura data
 */
async function syncOuraData(
  email: string,
  startDate: Date,
  endDate: Date
): Promise<SyncResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/oura/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        source: 'oura',
        success: false,
        error: result.error || 'Sync failed',
        syncedAt: new Date().toISOString(),
      };
    }

    return {
      source: 'oura',
      success: true,
      recordCount: result.recordCount || 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: 'oura',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sync Dexcom data
 */
async function syncDexcomData(
  email: string,
  startDate: Date,
  endDate: Date
): Promise<SyncResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/dexcom/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        source: 'dexcom',
        success: false,
        error: result.error || 'Sync failed',
        syncedAt: new Date().toISOString(),
      };
    }

    return {
      source: 'dexcom',
      success: true,
      recordCount: result.recordCount || 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: 'dexcom',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sync Vital data
 */
async function syncVitalData(
  email: string,
  startDate: Date,
  endDate: Date
): Promise<SyncResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/vital/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        source: 'vital',
        success: false,
        error: result.error || 'Sync failed',
        syncedAt: new Date().toISOString(),
      };
    }

    return {
      source: 'vital',
      success: true,
      recordCount: result.recordCount || 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: 'vital',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sync Gmail patterns
 */
async function syncGmailPatterns(email: string): Promise<SyncResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/gmail/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        source: 'gmail',
        success: false,
        error: result.error || 'Pattern analysis failed',
        syncedAt: new Date().toISOString(),
      };
    }

    // Store patterns in behavioral_patterns table
    const supabase = await createClient();
    const patterns = result.patterns || {};
    const metrics = result.metrics || {};

    await supabase.from('behavioral_patterns').insert({
      email,
      source: 'gmail',
      patterns,
      metrics,
      data_period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      data_period_end: new Date().toISOString().split('T')[0],
      data_points_analyzed: result.messagesAnalyzed || 0,
    });

    return {
      source: 'gmail',
      success: true,
      recordCount: result.messagesAnalyzed || 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: 'gmail',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sync Slack patterns
 */
async function syncSlackPatterns(email: string): Promise<SyncResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/slack/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        source: 'slack',
        success: false,
        error: result.error || 'Pattern analysis failed',
        syncedAt: new Date().toISOString(),
      };
    }

    // Store patterns in behavioral_patterns table
    const supabase = await createClient();
    const patterns = result.patterns || {};
    const metrics = result.metrics || {};

    await supabase.from('behavioral_patterns').insert({
      email,
      source: 'slack',
      patterns,
      metrics,
      data_period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      data_period_end: new Date().toISOString().split('T')[0],
      data_points_analyzed: result.messagesAnalyzed || 0,
    });

    return {
      source: 'slack',
      success: true,
      recordCount: result.messagesAnalyzed || 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: 'slack',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sync Outlook patterns (email + calendar)
 */
async function syncOutlookPatterns(email: string): Promise<SyncResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/outlook/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        source: 'outlook',
        success: false,
        error: result.error || 'Pattern analysis failed',
        syncedAt: new Date().toISOString(),
      };
    }

    return {
      source: 'outlook',
      success: true,
      recordCount: result.dataPointsAnalyzed || 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: 'outlook',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sync Teams patterns (chat messages)
 */
async function syncTeamsPatterns(email: string): Promise<SyncResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/teams/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        source: 'teams',
        success: false,
        error: result.error || 'Pattern analysis failed',
        syncedAt: new Date().toISOString(),
      };
    }

    return {
      source: 'teams',
      success: true,
      recordCount: result.dataPointsAnalyzed || 0,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: 'teams',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// MAIN AUTO-SYNC FUNCTION
// ============================================================================

/**
 * Orchestrates automatic syncing of all ecosystem data
 *
 * @param email - User's email
 * @param planType - 'sage' or 'forge'
 * @param options - Sync configuration options
 * @returns Report with sync results for all sources
 */
export async function autoSyncEcosystemData(
  email: string,
  planType: 'sage' | 'forge',
  options: SyncOptions = {}
): Promise<AutoSyncReport> {
  const startTime = Date.now();

  const {
    ttlHours = 24,
    forceSync = false,
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: 30 days ago
    endDate = new Date(),
    sources: requestedSources,
  } = options;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`AUTO-SYNC ECOSYSTEM DATA - ${email}`);
  console.log(`${'='.repeat(80)}\n`);

  // Available sync sources
  const allSources = ['oura', 'dexcom', 'vital', 'gmail', 'slack', 'outlook', 'teams'];
  const sourcesToSync = requestedSources || allSources;

  // Determine which sources need syncing
  const syncDecisions: Record<string, boolean> = {};

  if (forceSync) {
    sourcesToSync.forEach(source => {
      syncDecisions[source] = true;
    });
    console.log('[Auto-Sync] Force sync enabled - syncing all requested sources');
  } else {
    for (const source of sourcesToSync) {
      syncDecisions[source] = await needsSync(email, planType, source, ttlHours);
      console.log(`[Auto-Sync] ${source}: ${syncDecisions[source] ? 'NEEDS SYNC' : 'CACHED (skip)'}`);
    }
  }

  // Execute syncs in parallel
  const syncPromises: Promise<SyncResult>[] = [];

  if (syncDecisions.oura) {
    syncPromises.push(
      syncOuraData(email, startDate, endDate)
        .then(result => {
          updateSyncStatus(email, planType, 'oura', result.success, { recordCount: result.recordCount });
          return result;
        })
    );
  }

  if (syncDecisions.dexcom) {
    syncPromises.push(
      syncDexcomData(email, startDate, endDate)
        .then(result => {
          updateSyncStatus(email, planType, 'dexcom', result.success, { recordCount: result.recordCount });
          return result;
        })
    );
  }

  if (syncDecisions.vital) {
    syncPromises.push(
      syncVitalData(email, startDate, endDate)
        .then(result => {
          updateSyncStatus(email, planType, 'vital', result.success, { recordCount: result.recordCount });
          return result;
        })
    );
  }

  if (syncDecisions.gmail) {
    syncPromises.push(
      syncGmailPatterns(email)
        .then(result => {
          updateSyncStatus(email, planType, 'gmail', result.success, { messagesAnalyzed: result.recordCount });
          return result;
        })
    );
  }

  if (syncDecisions.slack) {
    syncPromises.push(
      syncSlackPatterns(email)
        .then(result => {
          updateSyncStatus(email, planType, 'slack', result.success, { messagesAnalyzed: result.recordCount });
          return result;
        })
    );
  }

  if (syncDecisions.outlook) {
    syncPromises.push(
      syncOutlookPatterns(email)
        .then(result => {
          updateSyncStatus(email, planType, 'outlook', result.success, { dataPointsAnalyzed: result.recordCount });
          return result;
        })
    );
  }

  if (syncDecisions.teams) {
    syncPromises.push(
      syncTeamsPatterns(email)
        .then(result => {
          updateSyncStatus(email, planType, 'teams', result.success, { messagesAnalyzed: result.recordCount });
          return result;
        })
    );
  }

  // Wait for all syncs to complete
  const syncResults = await Promise.all(syncPromises);

  // Add skipped sources to results
  for (const source of sourcesToSync) {
    if (!syncDecisions[source]) {
      syncResults.push({
        source,
        success: true,
        recordCount: 0,
        syncedAt: new Date().toISOString(),
        error: 'Skipped (using cached data)',
      });
    }
  }

  const successCount = syncResults.filter(r => r.success).length;
  const failureCount = syncResults.filter(r => !r.success).length;
  const totalDuration = Date.now() - startTime;

  console.log(`\n[Auto-Sync] Completed in ${totalDuration}ms`);
  console.log(`[Auto-Sync] Success: ${successCount}/${sourcesToSync.length}`);
  console.log(`[Auto-Sync] Failures: ${failureCount}/${sourcesToSync.length}\n`);

  return {
    email,
    planType,
    syncResults,
    successCount,
    failureCount,
    totalDuration,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get current sync status for a user
 */
export async function getSyncStatus(
  email: string,
  planType: 'sage' | 'forge'
): Promise<Record<string, { lastSync: string | null; status: string; metadata?: Record<string, unknown> }> | null> {
  try {
    const supabase = await createClient();
    const table = planType === 'sage' ? 'sage_onboarding_data' : 'forge_onboarding_data';

    const { data, error } = await supabase
      .from(table)
      .select('ecosystem_sync_status')
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return data.ecosystem_sync_status as Record<string, { lastSync: string | null; status: string; metadata?: Record<string, unknown> }>;
  } catch (error) {
    console.error('[Auto-Sync] Error getting sync status:', error);
    return null;
  }
}

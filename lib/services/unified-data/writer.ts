/**
 * Unified Health Data Writer Service
 *
 * Handles writing data to the unified_health_data table.
 * Provides upsert functionality to avoid duplicates and
 * automatic daily rollup triggering.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { UnifiedHealthRecord, UnifiedHealthDaily } from './types';

const logger = createLogger('UnifiedDataWriter');

/**
 * Write a single unified health record to the database
 */
export async function writeUnifiedRecord(
  record: UnifiedHealthRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Convert dates to ISO strings for database
    const dbRecord = {
      ...record,
      recorded_at:
        record.recorded_at instanceof Date
          ? record.recorded_at.toISOString()
          : record.recorded_at,
      bedtime_start:
        record.bedtime_start instanceof Date
          ? record.bedtime_start.toISOString()
          : record.bedtime_start,
      bedtime_end:
        record.bedtime_end instanceof Date
          ? record.bedtime_end.toISOString()
          : record.bedtime_end,
    };

    const { error } = await supabase
      .from('unified_health_data')
      .upsert(dbRecord, {
        onConflict: 'email,provider,data_type,recorded_at',
        ignoreDuplicates: false,
      });

    if (error) {
      logger.error('Failed to write unified record', {
        email: record.email,
        provider: record.provider,
        data_type: record.data_type,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.debug('Wrote unified record', {
      email: record.email,
      provider: record.provider,
      data_type: record.data_type,
    });

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Exception writing unified record', { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * Write multiple unified health records to the database
 * Uses batch upsert for efficiency
 */
export async function writeUnifiedRecords(
  records: UnifiedHealthRecord[]
): Promise<{
  success: boolean;
  written: number;
  failed: number;
  errors: string[];
}> {
  if (records.length === 0) {
    return { success: true, written: 0, failed: 0, errors: [] };
  }

  try {
    const supabase = createAdminClient();

    // Convert dates to ISO strings for database
    const dbRecords = records.map((record) => ({
      ...record,
      recorded_at:
        record.recorded_at instanceof Date
          ? record.recorded_at.toISOString()
          : record.recorded_at,
      bedtime_start:
        record.bedtime_start instanceof Date
          ? record.bedtime_start.toISOString()
          : record.bedtime_start,
      bedtime_end:
        record.bedtime_end instanceof Date
          ? record.bedtime_end.toISOString()
          : record.bedtime_end,
    }));

    // Batch upsert
    const { error, count } = await supabase
      .from('unified_health_data')
      .upsert(dbRecords, {
        onConflict: 'email,provider,data_type,recorded_at',
        ignoreDuplicates: false,
        count: 'exact',
      });

    if (error) {
      logger.error('Failed to batch write unified records', {
        count: records.length,
        error: error.message,
      });
      return {
        success: false,
        written: 0,
        failed: records.length,
        errors: [error.message],
      };
    }

    const written = count || records.length;
    logger.info('Batch wrote unified records', {
      email: records[0]?.email,
      written,
      providers: [...new Set(records.map((r) => r.provider))],
    });

    return { success: true, written, failed: 0, errors: [] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Exception batch writing unified records', { error: errorMsg });
    return {
      success: false,
      written: 0,
      failed: records.length,
      errors: [errorMsg],
    };
  }
}

/**
 * Dual-write: Write to unified table alongside existing table
 * This is the main function to use during the dual-write migration phase
 */
export async function dualWriteUnifiedRecord(
  record: UnifiedHealthRecord,
  options?: {
    skipOnError?: boolean;
    logPrefix?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const prefix = options?.logPrefix || 'DualWrite';

  try {
    const result = await writeUnifiedRecord(record);

    if (!result.success && !options?.skipOnError) {
      logger.warn(`[${prefix}] Failed to dual-write unified record`, {
        email: record.email,
        provider: record.provider,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (!options?.skipOnError) {
      logger.warn(`[${prefix}] Exception in dual-write`, { error: errorMsg });
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Dual-write: Write multiple records to unified table
 */
export async function dualWriteUnifiedRecords(
  records: UnifiedHealthRecord[],
  options?: {
    skipOnError?: boolean;
    logPrefix?: string;
  }
): Promise<{
  success: boolean;
  written: number;
  failed: number;
}> {
  if (records.length === 0) {
    return { success: true, written: 0, failed: 0 };
  }

  const prefix = options?.logPrefix || 'DualWrite';

  try {
    const result = await writeUnifiedRecords(records);

    if (!result.success && !options?.skipOnError) {
      logger.warn(`[${prefix}] Failed to dual-write unified records`, {
        count: records.length,
        errors: result.errors,
      });
    }

    return {
      success: result.success,
      written: result.written,
      failed: result.failed,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (!options?.skipOnError) {
      logger.warn(`[${prefix}] Exception in batch dual-write`, { error: errorMsg });
    }

    return {
      success: false,
      written: 0,
      failed: records.length,
    };
  }
}

/**
 * Get user's recent unified health data
 */
export async function getUnifiedHealthData(
  email: string,
  options?: {
    days?: number;
    providers?: string[];
    dataTypes?: string[];
    limit?: number;
  }
): Promise<UnifiedHealthRecord[]> {
  try {
    const supabase = createAdminClient();
    const days = options?.days || 30;
    const limit = options?.limit || 1000;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('unified_health_data')
      .select('*')
      .eq('email', email)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (options?.providers && options.providers.length > 0) {
      query = query.in('provider', options.providers);
    }

    if (options?.dataTypes && options.dataTypes.length > 0) {
      query = query.in('data_type', options.dataTypes);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get unified health data', {
        email,
        error: error.message,
      });
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Exception getting unified health data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Get user's daily rollup data
 */
export async function getUnifiedHealthDaily(
  email: string,
  options?: {
    days?: number;
    status?: string;
  }
): Promise<UnifiedHealthDaily[]> {
  try {
    const supabase = createAdminClient();
    const days = options?.days || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    let query = supabase
      .from('unified_health_daily')
      .select('*')
      .eq('email', email)
      .gte('date', startDateStr)
      .order('date', { ascending: false });

    if (options?.status) {
      query = query.eq('overall_status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get unified daily data', {
        email,
        error: error.message,
      });
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Exception getting unified daily data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Get user's latest health context (most recent daily summary)
 */
export async function getLatestHealthContext(
  email: string
): Promise<UnifiedHealthDaily | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('unified_health_daily')
      .select('*')
      .eq('email', email)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows
      logger.error('Failed to get latest health context', {
        email,
        error: error.message,
      });
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Exception getting latest health context', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Manually trigger daily rollup update for a specific user and date
 * Note: This is normally handled by the database trigger, but can be called manually
 */
export async function updateDailyRollup(
  email: string,
  date: Date | string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const dateStr =
      date instanceof Date ? date.toISOString().split('T')[0] : date;

    const { error } = await supabase.rpc('update_unified_health_daily', {
      p_email: email,
      p_date: dateStr,
    });

    if (error) {
      logger.error('Failed to update daily rollup', {
        email,
        date: dateStr,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Exception updating daily rollup', { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * Group unified health records by provider
 * Useful for transforming unified data back to ecosystem format
 */
export function groupByProvider(
  records: UnifiedHealthRecord[]
): Record<string, UnifiedHealthRecord[]> {
  const grouped: Record<string, UnifiedHealthRecord[]> = {};

  for (const record of records) {
    const provider = record.provider;
    if (!grouped[provider]) {
      grouped[provider] = [];
    }
    grouped[provider].push(record);
  }

  return grouped;
}

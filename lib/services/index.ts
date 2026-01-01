/**
 * Services Module
 *
 * Central export point for all service modules.
 * Import specific services or use barrel exports from subdirectories.
 *
 * @example
 * ```ts
 * // Import AI services
 * import { getAIProvider, aiComplete } from '@/lib/services/ai';
 *
 * // Import cache service
 * import { getCachedInsights, cacheInsights } from '@/lib/services/cache-service';
 *
 * // Import specific services
 * import { InsightTriggerService } from '@/lib/services/insight-trigger-service';
 * ```
 */

// ============================================================================
// AI SERVICES
// ============================================================================

export * from './ai';

// ============================================================================
// CACHE SERVICE
// ============================================================================

export {
  cacheService,
  getCachedInsights,
  cacheInsights,
  getCachedBaseline,
  cacheBaseline,
  getCachedUserContext,
  cacheUserContext,
  getCachedWeeklySummary,
  cacheWeeklySummary,
  invalidateUserCache,
  CACHE_TTL,
  CACHE_KEYS,
} from './cache-service';

// ============================================================================
// ORGANIZED SERVICE MODULES
// ============================================================================

// Blood analyzer - multi-agent blood test analysis
export * as bloodAnalyzer from './blood-analyzer';

// Shopping agent - autonomous shopping
export * as shoppingAgent from './shopping-agent';

// ============================================================================
// DATA SYNC SERVICES
// ============================================================================

// MCP sync - data synchronization
export {
  syncAllIntegrations,
  getSyncStatus,
  getSyncRecommendations,
} from './mcp-sync';

// ============================================================================
// CONTEXT SERVICES
// ============================================================================

// User context
export { getUserContext } from './user-context-service';

// Context selection
export { selectRelevantContext } from './context-selector';

// Pattern analysis
export { analyzeHealthPatterns } from './health-pattern-analyzer';

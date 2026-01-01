import { NextRequest, NextResponse } from 'next/server';
import { syncAllIntegrations, getSyncStatus, getSyncRecommendations } from '@/lib/services/mcp-sync';
import { createLogger } from '@/lib/utils/logger';
import {
  syncRequestSchema,
  syncStatusQuerySchema,
  validateBody,
  validateQuery,
  formatZodError,
} from '@/lib/validation/schemas';

const logger = createLogger('MCPSyncAPI');

/**
 * POST /api/mcp/sync
 *
 * Trigger data synchronization from all connected integrations
 *
 * Request body:
 * {
 *   email: string;
 *   forceSync?: boolean; // Skip interval check and sync immediately
 *   providers?: string[]; // Only sync specific providers
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = validateBody(body, syncRequestSchema);
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 });
    }

    const { email, forceSync, providers } = validation.data;

    logger.info('Sync requested', { email, forceSync, providers });

    // Get base URL from request
    const baseUrl = request.nextUrl.origin;

    const result = await syncAllIntegrations(email, {
      forceSync: forceSync || false,
      providers: providers || undefined,
      baseUrl,
    });

    logger.info('Sync completed', { email, result });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    logger.error('Sync error', error);
    return NextResponse.json(
      {
        error: 'Failed to sync integrations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/sync?email=user@example.com&action=status
 *
 * Get sync status for a user without triggering new syncs
 *
 * Query parameters:
 * - email: User email (required)
 * - action: 'status' | 'recommendations' (default: 'status')
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Validate query parameters
    const validation = validateQuery(searchParams, syncStatusQuerySchema);
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 });
    }

    const { email, action } = validation.data;

    if (action === 'recommendations') {
      const recommendations = await getSyncRecommendations(email);
      return NextResponse.json({
        success: true,
        ...recommendations,
      });
    }

    // Default action: status
    const status = await getSyncStatus(email);
    return NextResponse.json({
      success: true,
      ...status,
    });

  } catch (error) {
    logger.error('Error getting sync status', error);
    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

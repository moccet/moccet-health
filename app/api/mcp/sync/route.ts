import { NextRequest, NextResponse } from 'next/server';
import { syncAllIntegrations, getSyncStatus, getSyncRecommendations } from '@/lib/services/mcp-sync';

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
    const { email, forceSync, providers } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[MCP Sync API] Sync requested for ${email}`);

    // Get base URL from request
    const baseUrl = request.nextUrl.origin;

    const result = await syncAllIntegrations(email, {
      forceSync: forceSync || false,
      providers: providers || undefined,
      baseUrl,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('[MCP Sync API] Error:', error);
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
    const email = searchParams.get('email');
    const action = searchParams.get('action') || 'status';

    if (!email) {
      return NextResponse.json(
        { error: 'Email query parameter is required' },
        { status: 400 }
      );
    }

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
    console.error('[MCP Sync API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

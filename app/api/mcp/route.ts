/**
 * MCP API Index
 *
 * Lists all available MCP resources and tools.
 */

import { NextRequest, NextResponse } from 'next/server';

// Import handlers
const getMcpHandlers = async () => {
  try {
    const { resourceHandlers } = await import('../../../../mcp-server/src/resources/index.js');
    const { toolHandlers } = await import('../../../../mcp-server/src/tools/index.js');
    return { resourceHandlers, toolHandlers };
  } catch (error) {
    console.error('Failed to import MCP handlers:', error);
    return null;
  }
};

// Tool risk levels
const TOOL_RISK_LEVELS: Record<string, string> = {
  calendar_find_slots: 'low',
  calendar_create_event: 'medium',
  spotify_create_playlist: 'low',
  spotify_add_tracks: 'low',
  supplements_search: 'low',
  supplements_recommend: 'low',
  shopping_search: 'low',
  shopping_add_to_cart: 'medium',
  shopping_purchase: 'high',
  booking_find_providers: 'low',
  booking_check_insurance: 'low',
  booking_schedule: 'high',
};

/**
 * GET /api/mcp
 *
 * Returns a list of all available resources and tools.
 */
export async function GET(request: NextRequest) {
  const handlers = await getMcpHandlers();

  if (!handlers) {
    return NextResponse.json(
      { error: 'MCP handlers not available' },
      { status: 500 }
    );
  }

  const resources = Object.keys(handlers.resourceHandlers).map(uri => ({
    uri,
    path: `/api/mcp/resources/${uri.replace('://', '/')}`,
    method: 'GET',
  }));

  const tools = Object.keys(handlers.toolHandlers).map(name => ({
    name,
    path: `/api/mcp/tools/${name}`,
    method: 'POST',
    riskLevel: TOOL_RISK_LEVELS[name] || 'unknown',
    requiresApproval: ['medium', 'high'].includes(TOOL_RISK_LEVELS[name] || ''),
  }));

  return NextResponse.json({
    version: '1.0.0',
    name: '@moccet/health-mcp',
    description: 'Moccet Health MCP Server - HTTP API',
    resources: {
      count: resources.length,
      items: resources,
    },
    tools: {
      count: tools.length,
      items: tools,
    },
    endpoints: {
      resources: '/api/mcp/resources/{uri}',
      tools: '/api/mcp/tools/{name}',
      approve: '/api/mcp/approve',
    },
  });
}

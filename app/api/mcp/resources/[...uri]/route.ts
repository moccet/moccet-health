/**
 * HTTP API Wrapper for MCP Resources
 *
 * Exposes MCP resources via HTTP for Flutter and other clients.
 * Maps health:// and memory:// URIs to resource handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Supabase client for auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import resource handlers from MCP server
// Note: These are imported dynamically to avoid build issues with MCP SDK
const getMcpHandlers = async () => {
  try {
    const { resourceHandlers } = await import('../../../../../../mcp-server/src/resources/index.js');
    return resourceHandlers;
  } catch (error) {
    console.error('Failed to import MCP handlers:', error);
    return null;
  }
};

// Get user email from auth token
async function getUserEmail(request: NextRequest): Promise<string | null> {
  // Try Bearer token first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user?.email) {
      return user.email;
    }
  }

  // Try cookie-based auth
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (accessToken) {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (!error && user?.email) {
      return user.email;
    }
  }

  // Try query param for development
  const email = request.nextUrl.searchParams.get('email');
  if (email && process.env.NODE_ENV === 'development') {
    return email;
  }

  return null;
}

// Build config for MCP handlers
function buildConfig(userEmail: string) {
  return {
    supabaseUrl,
    supabaseKey: supabaseServiceKey,
    userEmail,
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  };
}

/**
 * GET /api/mcp/resources/[...uri]
 *
 * Examples:
 *   GET /api/mcp/resources/health/context/unified
 *   GET /api/mcp/resources/health/oura/sleep
 *   GET /api/mcp/resources/memory/user/facts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uri: string[] }> }
) {
  try {
    // Get user email from auth
    const userEmail = await getUserEmail(request);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized. Please provide a valid authentication token.' },
        { status: 401 }
      );
    }

    // Build URI from path segments
    const { uri } = await params;
    const resourceUri = `${uri[0]}://${uri.slice(1).join('/')}`;

    // Get MCP handlers
    const handlers = await getMcpHandlers();
    if (!handlers) {
      return NextResponse.json(
        { error: 'MCP handlers not available. Server configuration error.' },
        { status: 500 }
      );
    }

    // Find handler for this URI
    const handler = handlers[resourceUri];
    if (!handler) {
      return NextResponse.json(
        {
          error: `Unknown resource: ${resourceUri}`,
          availableResources: Object.keys(handlers),
        },
        { status: 404 }
      );
    }

    // Execute handler
    const config = buildConfig(userEmail);
    const result = await handler(config);

    // Return result with cache headers
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=60', // Cache for 1 minute
        'X-MCP-Resource': resourceUri,
        'X-User-Email': userEmail,
      },
    });
  } catch (error) {
    console.error('MCP resource error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/resources (list all available resources)
 */
export async function OPTIONS(request: NextRequest) {
  const handlers = await getMcpHandlers();
  const resources = handlers ? Object.keys(handlers) : [];

  return NextResponse.json({
    resources: resources.map(uri => ({
      uri,
      method: 'GET',
      path: `/api/mcp/resources/${uri.replace('://', '/')}`,
    })),
    totalCount: resources.length,
  });
}

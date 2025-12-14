import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/user/insights
 * Fetch insights for a user
 *
 * Query params:
 * - email (required): User email
 * - limit (optional): Max results, default 20
 * - severity (optional): Filter by severity (comma-separated)
 * - type (optional): Filter by insight type
 * - unread_only (optional): Only return unread insights
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const unreadOnly = searchParams.get('unread_only') === 'true';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    let query = supabase
      .from('real_time_insights')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by severity
    if (severity) {
      const severities = severity.split(',').map((s) => s.trim());
      query = query.in('severity', severities);
    }

    // Filter by type
    if (type) {
      query = query.eq('insight_type', type);
    }

    // Filter unread only
    if (unreadOnly) {
      query = query.is('dismissed_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[User Insights API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      insights: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('[User Insights API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/insights
 * Manually trigger insight generation for a user
 *
 * Body:
 * - email (required): User email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Import dynamically to avoid circular dependencies
    const { processAllProviders } = await import('@/lib/services/insight-trigger-service');
    const result = await processAllProviders(email);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[User Insights API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

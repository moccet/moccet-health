import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { insightRequestSchema, validateQuery, formatZodError } from '@/lib/validation/schemas';
import { getCachedInsights, cacheInsights } from '@/lib/services/cache-service';

const logger = createLogger('UserInsightsAPI');

/**
 * Paginated response structure
 */
interface PaginatedInsightsResponse {
  success: boolean;
  insights: unknown[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  /** Timestamp for incremental sync */
  syncTimestamp: string;
  /** Whether results came from cache */
  cached?: boolean;
}

/**
 * GET /api/user/insights
 * Fetch paginated insights for a user
 *
 * Query params:
 * - email (required): User email
 * - page (optional): Page number, default 1
 * - pageSize (optional): Results per page, default 20, max 50
 * - severity (optional): Filter by severity (comma-separated)
 * - type (optional): Filter by insight type
 * - unread_only (optional): Only return unread insights
 * - since (optional): Only return insights created after this timestamp (ISO 8601)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;

    // Validate query parameters
    const validation = validateQuery(searchParams, insightRequestSchema);
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 });
    }

    const { email, page = 1, pageSize = 20, severity, type, unread_only } = validation.data;
    const since = searchParams.get('since');

    logger.info('Fetching insights', { email, page, pageSize, severity, type, unread_only });

    // Try cache first (only for first page without filters)
    if (page === 1 && !severity && !type && !unread_only && !since) {
      const cached = await getCachedInsights<unknown[]>(email);
      if (cached) {
        logger.debug('Cache hit for insights', { email });
        return NextResponse.json({
          success: true,
          insights: cached.slice(0, pageSize),
          pagination: {
            page: 1,
            pageSize,
            total: cached.length,
            totalPages: Math.ceil(cached.length / pageSize),
            hasMore: cached.length > pageSize,
          },
          syncTimestamp: new Date().toISOString(),
          cached: true,
        } as PaginatedInsightsResponse);
      }
    }

    // Use admin client to bypass RLS - we filter by email explicitly
    const supabase = createAdminClient();

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Build count query (for total)
    let countQuery = supabase
      .from('real_time_insights')
      .select('*', { count: 'exact', head: true })
      .eq('email', email);

    // Build data query
    let dataQuery = supabase
      .from('real_time_insights')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Apply filters to both queries
    if (severity) {
      const severities = severity.split(',').map((s) => s.trim());
      countQuery = countQuery.in('severity', severities);
      dataQuery = dataQuery.in('severity', severities);
    }

    if (type) {
      countQuery = countQuery.eq('insight_type', type);
      dataQuery = dataQuery.eq('insight_type', type);
    }

    if (unread_only) {
      countQuery = countQuery.is('dismissed_at', null).is('viewed_at', null);
      dataQuery = dataQuery.is('dismissed_at', null).is('viewed_at', null);
    }

    // Filter by since timestamp for incremental sync
    if (since) {
      try {
        const sinceDate = new Date(since).toISOString();
        countQuery = countQuery.gt('created_at', sinceDate);
        dataQuery = dataQuery.gt('created_at', sinceDate);
      } catch {
        return NextResponse.json({ error: 'Invalid since timestamp' }, { status: 400 });
      }
    }

    // Execute both queries in parallel
    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    if (countResult.error) {
      logger.error('Count query error', countResult.error, { email });
      return NextResponse.json({ error: countResult.error.message }, { status: 500 });
    }

    if (dataResult.error) {
      logger.error('Data query error', dataResult.error, { email });
      return NextResponse.json({ error: dataResult.error.message }, { status: 500 });
    }

    const total = countResult.count || 0;
    const totalPages = Math.ceil(total / pageSize);
    const insights = dataResult.data || [];

    // Cache first page of unfiltered results
    if (page === 1 && !severity && !type && !unread_only && !since && insights.length > 0) {
      // Fetch all insights for caching (up to 100)
      const { data: allInsights } = await supabase
        .from('real_time_insights')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(100);

      if (allInsights) {
        await cacheInsights(email, allInsights);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Insights fetched', { email, page, total, duration });

    return NextResponse.json({
      success: true,
      insights,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      syncTimestamp: new Date().toISOString(),
    } as PaginatedInsightsResponse);
  } catch (error) {
    logger.error('Error fetching insights', error);
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
 * - forceRefresh (optional): Force regeneration even if cached
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { email, forceRefresh } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    logger.info('Triggering insight generation', { email, forceRefresh });

    // Import dynamically to avoid circular dependencies
    const { processAllProviders } = await import('@/lib/services/insight-trigger-service');
    const { invalidateUserCache } = await import('@/lib/services/cache-service');

    // Invalidate cache if force refresh
    if (forceRefresh) {
      await invalidateUserCache(email);
    }

    const result = await processAllProviders(email);

    // Invalidate cache after generating new insights
    await invalidateUserCache(email);

    const duration = Date.now() - startTime;
    logger.info('Insight generation completed', {
      email,
      insightsGenerated: result.insights_generated,
      duration,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error generating insights', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

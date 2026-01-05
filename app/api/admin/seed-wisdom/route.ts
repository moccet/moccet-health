/**
 * Wisdom Library Seeding API
 *
 * Seeds the wisdom library with curated content.
 * Admin-only endpoint (requires service role or admin auth).
 *
 * POST /api/admin/seed-wisdom
 * Query params:
 *   - clear: If 'true', clears existing data before seeding
 */

import { NextRequest, NextResponse } from 'next/server';
import { WisdomLibraryService } from '@/lib/services/wisdom-library-service';
import { WISDOM_SEED_DATA } from '@/lib/data/wisdom-seed-data';
import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('SeedWisdomAPI');

export async function POST(request: NextRequest) {
  try {
    // Check for admin authorization (using a simple API key for now)
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY || 'moccet-admin-seed-key';

    if (authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clearExisting = searchParams.get('clear') === 'true';

    logger.info('Starting wisdom library seeding', {
      clearExisting,
      entryCount: WISDOM_SEED_DATA.length,
    });

    const supabase = createAdminClient();

    // Optionally clear existing data
    if (clearExisting) {
      logger.info('Clearing existing wisdom data');

      await supabase.from('user_content_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('content_engagement').delete().eq('content_type', 'wisdom');
      await supabase.from('wisdom_library').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      logger.info('Existing data cleared');
    }

    // Get current count
    const { count: existingCount } = await supabase
      .from('wisdom_library')
      .select('*', { count: 'exact', head: true });

    logger.info('Current library size', { existingCount });

    // Add seed data
    const addedCount = await WisdomLibraryService.addEntries(WISDOM_SEED_DATA);

    // Get category breakdown
    const stats = await WisdomLibraryService.getStats();

    logger.info('Seeding complete', {
      addedCount,
      totalNow: stats.total,
      byCategory: stats.byCategory,
    });

    return NextResponse.json({
      success: true,
      message: `Seeded ${addedCount} wisdom entries`,
      stats: {
        previousCount: existingCount || 0,
        addedCount,
        totalCount: stats.total,
        byCategory: stats.byCategory,
      },
    });
  } catch (error) {
    logger.error('Error seeding wisdom library', { error });
    return NextResponse.json(
      {
        error: 'Failed to seed wisdom library',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/seed-wisdom
 * Check current library stats without seeding
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY || 'moccet-admin-seed-key';

    if (authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      );
    }

    const stats = await WisdomLibraryService.getStats();

    return NextResponse.json({
      success: true,
      seedDataAvailable: WISDOM_SEED_DATA.length,
      currentLibrary: {
        total: stats.total,
        byCategory: stats.byCategory,
        avgEngagement: stats.avgEngagement,
      },
      seedDataBreakdown: {
        self_development: WISDOM_SEED_DATA.filter(w => w.category === 'self_development').length,
        fitness: WISDOM_SEED_DATA.filter(w => w.category === 'fitness').length,
        cooking: WISDOM_SEED_DATA.filter(w => w.category === 'cooking').length,
        productivity: WISDOM_SEED_DATA.filter(w => w.category === 'productivity').length,
        life_advice: WISDOM_SEED_DATA.filter(w => w.category === 'life_advice').length,
      },
    });
  } catch (error) {
    logger.error('Error checking wisdom stats', { error });
    return NextResponse.json(
      {
        error: 'Failed to check wisdom stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

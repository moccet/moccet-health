/**
 * Wisdom Library Stats API
 *
 * Returns statistics about the wisdom library.
 *
 * GET /api/wisdom/stats
 */

import { NextResponse } from 'next/server';
import { WisdomLibraryService } from '@/lib/services/wisdom-library-service';
import { PreferenceLearner } from '@/lib/services/preference-learner';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('WisdomStatsAPI');

export async function GET() {
  try {
    // Get library stats
    const libraryStats = await WisdomLibraryService.getStats();

    // Get engagement stats
    const engagementStats = await PreferenceLearner.getEngagementStats();

    return NextResponse.json({
      success: true,
      library: {
        total: libraryStats.total,
        byCategory: libraryStats.byCategory,
        avgEngagement: libraryStats.avgEngagement,
      },
      engagement: {
        totalEngagements: engagementStats.totalEngagements,
        totalLikes: engagementStats.totalLikes,
        totalShares: engagementStats.totalShares,
        totalSaves: engagementStats.totalSaves,
        topCategories: engagementStats.topCategories,
      },
    });
  } catch (error) {
    logger.error('Error fetching wisdom stats', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

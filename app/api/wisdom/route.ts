/**
 * Wisdom Library API
 *
 * Access curated wisdom content from books, fitness, productivity, and life advice.
 *
 * GET /api/wisdom - Get personalized wisdom or random entry
 * Query params:
 *   - category: Filter by category (self_development, fitness, cooking, productivity, life_advice)
 *   - random: If true, gets random entry instead of personalized
 *   - search: Search query to find specific wisdom
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  WisdomLibraryService,
  WisdomCategory,
  WisdomEntry,
} from '@/lib/services/wisdom-library-service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('WisdomAPI');

const VALID_CATEGORIES: WisdomCategory[] = [
  'self_development',
  'fitness',
  'cooking',
  'productivity',
  'life_advice',
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as WisdomCategory | null;
    const random = searchParams.get('random') === 'true';
    const search = searchParams.get('search');

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    let wisdom: WisdomEntry | WisdomEntry[] | null;

    // Search mode
    if (search) {
      logger.info('Searching wisdom', { email: user.email, search });
      wisdom = await WisdomLibraryService.search(search, 10);

      return NextResponse.json({
        success: true,
        count: Array.isArray(wisdom) ? wisdom.length : 0,
        wisdom,
      });
    }

    // Category browsing
    if (category && random) {
      logger.info('Getting random wisdom by category', { email: user.email, category });
      wisdom = await WisdomLibraryService.getUnseen(user.email, category);
    }
    // Personalized (default)
    else if (!random) {
      logger.info('Getting personalized wisdom', { email: user.email });
      wisdom = await WisdomLibraryService.getPersonalized(user.email);
    }
    // Random any category
    else {
      logger.info('Getting random wisdom', { email: user.email });
      wisdom = await WisdomLibraryService.getUnseen(user.email);
    }

    if (!wisdom) {
      return NextResponse.json({
        success: true,
        message: 'No new wisdom available. You may have seen all content.',
        wisdom: null,
      });
    }

    return NextResponse.json({
      success: true,
      wisdom,
    });
  } catch (error) {
    logger.error('Error fetching wisdom', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch wisdom',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wisdom/stats - Get library statistics (public endpoint)
 */
export async function HEAD() {
  try {
    const stats = await WisdomLibraryService.getStats();

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Wisdom-Total': stats.total.toString(),
        'X-Wisdom-Avg-Engagement': stats.avgEngagement.toFixed(2),
      },
    });
  } catch (error) {
    logger.error('Error fetching stats', { error });
    return new NextResponse(null, { status: 500 });
  }
}

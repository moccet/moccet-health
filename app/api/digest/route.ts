/**
 * Daily Digest API
 *
 * Returns 1-2 personalized insights combining wisdom library and health insights.
 *
 * GET /api/digest
 * Query params: count (optional, default 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WisdomLibraryService, WisdomEntry } from '@/lib/services/wisdom-library-service';
import { PreferenceLearner } from '@/lib/services/preference-learner';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('DigestAPI');

export interface DigestItem {
  id: string;
  type: 'wisdom' | 'health_insight';
  category: string;
  title: string;
  content: string;
  source?: string;
  sourceType?: string;
  actionableTip?: string;
  tags?: string[];
}

export interface DailyDigest {
  items: DigestItem[];
  preferences: {
    topCategories: string[];
    totalEngagements: number;
  };
  generatedAt: string;
}

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
    const count = Math.min(parseInt(searchParams.get('count') || '2', 10), 5);

    logger.info('Generating daily digest', { email: user.email, count });

    // Get user preferences
    const prefs = await PreferenceLearner.getPreferences(user.email);
    const topCategories = await PreferenceLearner.getTopCategories(user.email, 3);

    // Get wisdom content
    const wisdomEntries = await WisdomLibraryService.getDigestContent(
      user.email,
      count
    );

    // Transform to digest items
    const items: DigestItem[] = wisdomEntries.map((entry: WisdomEntry) => ({
      id: entry.id,
      type: 'wisdom' as const,
      category: entry.category,
      title: entry.title,
      content: entry.content,
      source: entry.source,
      sourceType: entry.source_type,
      actionableTip: entry.actionable_tip,
      tags: entry.tags,
    }));

    const digest: DailyDigest = {
      items,
      preferences: {
        topCategories: topCategories.map((c) => c.category),
        totalEngagements: prefs.totalEngagements,
      },
      generatedAt: new Date().toISOString(),
    };

    logger.info('Digest generated', {
      email: user.email,
      itemCount: items.length,
    });

    return NextResponse.json({
      success: true,
      digest,
    });
  } catch (error) {
    logger.error('Error generating digest', { error });
    return NextResponse.json(
      {
        error: 'Failed to generate digest',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

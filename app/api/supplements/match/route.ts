/**
 * Match Supplements API
 * POST /api/supplements/match
 *
 * Takes AI-generated supplement recommendations and enriches them with
 * actual product data (pricing, availability, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  matchSupplementsToProducts,
  type SupplementRecommendation,
} from '@/lib/services/supplement-matching';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recommendations } = body;

    if (!recommendations || !Array.isArray(recommendations)) {
      return NextResponse.json(
        { success: false, error: 'Recommendations array is required' },
        { status: 400 }
      );
    }

    console.log(`[Supplement Match API] Matching ${recommendations.length} recommendations...`);

    const enrichedRecommendations = await matchSupplementsToProducts(
      recommendations as SupplementRecommendation[]
    );

    const matchedCount = enrichedRecommendations.filter(
      (r) => r.matchStatus === 'matched'
    ).length;

    console.log(`[Supplement Match API] Successfully matched ${matchedCount}/${recommendations.length} supplements`);

    return NextResponse.json({
      success: true,
      recommendations: enrichedRecommendations,
      stats: {
        total: enrichedRecommendations.length,
        matched: enrichedRecommendations.filter((r) => r.matchStatus === 'matched').length,
        noMatch: enrichedRecommendations.filter((r) => r.matchStatus === 'no_match').length,
        outOfStock: enrichedRecommendations.filter((r) => r.matchStatus === 'out_of_stock').length,
      },
    });
  } catch (error) {
    console.error('[Supplement Match API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to match supplements',
      },
      { status: 500 }
    );
  }
}

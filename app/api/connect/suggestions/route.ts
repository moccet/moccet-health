/**
 * Meeting Suggestions API Route
 * GET /api/connect/suggestions - Get meeting suggestions for the user
 * POST /api/connect/suggestions - Generate new suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { suggestionEngine } from '@/lib/services/connect/suggestion-engine';

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    console.log(`[Connect] Fetching suggestions for ${email}`);

    const suggestions = await suggestionEngine.getPendingSuggestions(email);

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('[Connect] Error fetching suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    console.log(`[Connect] Generating suggestions for ${email}`);

    const suggestions = await suggestionEngine.generateSuggestionsForUser(email);

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });
  } catch (error) {
    console.error('[Connect] Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

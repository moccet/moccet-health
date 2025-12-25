/**
 * Suggestion Response API Route
 * POST /api/connect/suggestions/respond - Accept or decline a suggestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { suggestionEngine } from '@/lib/services/connect/suggestion-engine';

export async function POST(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const { suggestionId, accept, selectedTime } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!suggestionId) {
      return NextResponse.json(
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
    }

    if (typeof accept !== 'boolean') {
      return NextResponse.json(
        { error: 'Accept must be a boolean' },
        { status: 400 }
      );
    }

    console.log(
      `[Connect] ${email} ${accept ? 'accepting' : 'declining'} suggestion ${suggestionId}`
    );

    const result = await suggestionEngine.respondToSuggestion(
      suggestionId,
      email,
      accept,
      selectedTime
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to respond to suggestion' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action: accept ? 'accepted' : 'declined',
      meetupId: result.meetupId,
    });
  } catch (error) {
    console.error('[Connect] Error responding to suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to respond to suggestion' },
      { status: 500 }
    );
  }
}

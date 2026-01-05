/**
 * Individual Challenge API
 *
 * GET - Get challenge details
 * POST - Accept/Decline/Cancel challenge
 * PUT - Update progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChallengesService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectChallengeAPI');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const challenge = await ChallengesService.getChallenge(params.id);

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      challenge,
    });
  } catch (error) {
    logger.error('Error fetching challenge', { error });
    return NextResponse.json(
      { error: 'Failed to fetch challenge' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { email, action } = body; // action: 'accept', 'decline', 'cancel'

    if (!email || !action) {
      return NextResponse.json(
        { error: 'email and action are required' },
        { status: 400 }
      );
    }

    let result;
    switch (action) {
      case 'accept':
        result = await ChallengesService.acceptChallenge(params.id, email);
        break;
      case 'decline':
        result = await ChallengesService.declineChallenge(params.id, email);
        break;
      case 'cancel':
        result = await ChallengesService.cancelChallenge(params.id, email);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: accept, decline, cancel' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || `Failed to ${action} challenge` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error handling challenge action', { error });
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { email, progress, streakDays } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    if (progress !== undefined) {
      const result = await ChallengesService.updateProgress(params.id, email, progress);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to update progress' },
          { status: 400 }
        );
      }
    }

    if (streakDays !== undefined) {
      const result = await ChallengesService.updateStreak(params.id, email, streakDays);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to update streak' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error updating challenge', { error });
    return NextResponse.json(
      { error: 'Failed to update challenge' },
      { status: 500 }
    );
  }
}

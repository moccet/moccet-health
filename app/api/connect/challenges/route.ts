/**
 * Challenges API
 *
 * GET - List challenges (active, pending, history)
 * POST - Create a new challenge
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChallengesService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectChallengesAPI');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status'); // 'active', 'pending', 'history', 'stats'

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    if (status === 'stats') {
      const stats = await ChallengesService.getChallengeStats(email);
      return NextResponse.json({ success: true, stats });
    }

    let challenges;
    switch (status) {
      case 'pending':
        challenges = await ChallengesService.getPendingChallenges(email);
        break;
      case 'history':
        challenges = await ChallengesService.getChallengeHistory(email);
        break;
      case 'active':
      default:
        challenges = await ChallengesService.getActiveChallenges(email);
        break;
    }

    return NextResponse.json({
      success: true,
      challenges,
      count: challenges.length,
    });
  } catch (error) {
    logger.error('Error fetching challenges', { error });
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      challengerEmail,
      challengedEmail,
      title,
      description,
      challengeType,
      metricType,
      targetValue,
      startDate,
      endDate,
    } = body;

    if (!challengerEmail || !challengedEmail || !title || !challengeType || !metricType || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await ChallengesService.createChallenge(
      challengerEmail,
      challengedEmail,
      {
        title,
        description,
        challengeType,
        metricType,
        targetValue,
        startDate,
        endDate,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create challenge' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      challenge: result.challenge,
    });
  } catch (error) {
    logger.error('Error creating challenge', { error });
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}

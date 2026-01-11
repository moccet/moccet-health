/**
 * Test endpoint for morning briefing
 * POST /api/test/morning-briefing
 * Body: { "email": "user@example.com" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { MorningBriefingService } from '@/lib/services/morning-briefing-service';

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

export async function POST(request: NextRequest) {
  try {
    // Verify secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');

    if (authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, force } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Test] Triggering morning briefing for ${email}, force=${force}`);

    const result = await MorningBriefingService.sendBriefingNow(email, { force: !!force });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error('[Test] Morning briefing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

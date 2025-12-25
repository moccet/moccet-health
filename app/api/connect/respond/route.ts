/**
 * Connection Response API Route
 * POST /api/connect/respond - Accept or decline a friend request
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectionService } from '@/lib/services/connect/connection-service';

export async function POST(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const { requestId, accept } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    if (typeof accept !== 'boolean') {
      return NextResponse.json(
        { error: 'Accept must be a boolean' },
        { status: 400 }
      );
    }

    console.log(`[Connect] ${email} ${accept ? 'accepting' : 'declining'} request ${requestId}`);

    const result = await connectionService.respondToRequest(requestId, email, accept);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      connection: result.connection,
      action: accept ? 'accepted' : 'declined',
    });
  } catch (error) {
    console.error('[Connect] Error responding to request:', error);
    return NextResponse.json(
      { error: 'Failed to respond to connection request' },
      { status: 500 }
    );
  }
}

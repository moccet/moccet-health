/**
 * Connection Request API Route
 * POST /api/connect/request - Send a friend request
 * GET /api/connect/request - Get pending requests received
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectionService } from '@/lib/services/connect/connection-service';

export async function POST(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const { addresseeEmail } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!addresseeEmail) {
      return NextResponse.json(
        { error: 'Addressee email is required' },
        { status: 400 }
      );
    }

    if (email === addresseeEmail) {
      return NextResponse.json(
        { error: 'Cannot send connection request to yourself' },
        { status: 400 }
      );
    }

    console.log(`[Connect] ${email} sending request to ${addresseeEmail}`);

    const result = await connectionService.sendRequest(email, addresseeEmail);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      connection: result.connection,
    });
  } catch (error) {
    console.error('[Connect] Error sending request:', error);
    return NextResponse.json(
      { error: 'Failed to send connection request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    console.log(`[Connect] Fetching pending requests for ${email}`);

    const pendingRequests = await connectionService.getPendingRequests(email);

    return NextResponse.json({
      success: true,
      requests: pendingRequests,
    });
  } catch (error) {
    console.error('[Connect] Error fetching pending requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending requests' },
      { status: 500 }
    );
  }
}

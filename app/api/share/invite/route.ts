/**
 * Share Invite API Route
 * POST /api/share/invite - Create a share invite
 * GET /api/share/invite - Get pending invites (sent and received)
 */

import { NextRequest, NextResponse } from 'next/server';
import { shareRelationshipService } from '@/lib/services/share/share-relationship-service';

export async function POST(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const {
      caregiverEmail,
      relationshipType,
      relationshipLabel,
      caregiverRole,
      inviteMessage,
      isBidirectional,
    } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!caregiverEmail) {
      return NextResponse.json(
        { error: 'Caregiver email is required' },
        { status: 400 }
      );
    }

    if (!relationshipType) {
      return NextResponse.json(
        { error: 'Relationship type is required' },
        { status: 400 }
      );
    }

    if (email === caregiverEmail) {
      return NextResponse.json(
        { error: 'Cannot share with yourself' },
        { status: 400 }
      );
    }

    console.log(`[Share] ${email} inviting ${caregiverEmail} as ${relationshipType}`);

    const result = await shareRelationshipService.createInvite(email, caregiverEmail, {
      relationshipType,
      relationshipLabel,
      caregiverRole,
      inviteMessage,
      isBidirectional,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      invite_code: result.invite_code,
      relationship: result.relationship,
    });
  } catch (error) {
    console.error('[Share] Error creating invite:', error);
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const type = request.nextUrl.searchParams.get('type'); // 'sent' or 'received' or both

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    console.log(`[Share] Fetching invites for ${email}`);

    // Get pending invites received
    const pendingInvites = await shareRelationshipService.getPendingInvites(email);

    // Get stats which includes pending sent
    const stats = await shareRelationshipService.getStats(email);

    return NextResponse.json({
      success: true,
      pending_invites: pendingInvites,
      stats: {
        pending_sent: stats.pending_invites_sent,
        pending_received: stats.pending_invites_received,
      },
    });
  } catch (error) {
    console.error('[Share] Error fetching invites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}

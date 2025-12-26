/**
 * Share Invite Respond API Route
 * POST /api/share/invite/respond - Accept or decline a share invite
 */

import { NextRequest, NextResponse } from 'next/server';
import { shareRelationshipService } from '@/lib/services/share/share-relationship-service';

export async function POST(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const { inviteCode, accept } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }

    if (typeof accept !== 'boolean') {
      return NextResponse.json(
        { error: 'Accept must be true or false' },
        { status: 400 }
      );
    }

    console.log(`[Share] ${email} ${accept ? 'accepting' : 'declining'} invite ${inviteCode}`);

    if (accept) {
      const result = await shareRelationshipService.instance.acceptInvite(inviteCode, email);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        relationship: result.relationship,
      });
    } else {
      const result = await shareRelationshipService.instance.declineInvite(inviteCode, email);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
      });
    }
  } catch (error) {
    console.error('[Share] Error responding to invite:', error);
    return NextResponse.json(
      { error: 'Failed to respond to invite' },
      { status: 500 }
    );
  }
}

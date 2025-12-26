/**
 * Share Relationships API Route
 * GET /api/share/relationships - Get all share relationships
 * PUT /api/share/relationships - Update a relationship (pause, resume, update role)
 * DELETE /api/share/relationships - Revoke a relationship
 */

import { NextRequest, NextResponse } from 'next/server';
import { shareRelationshipService } from '@/lib/services/share/share-relationship-service';

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const role = request.nextUrl.searchParams.get('role'); // 'caregiver' or 'sharer'

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    console.log(`[Share] Fetching relationships for ${email} (role: ${role || 'both'})`);

    // Get both monitored people (caregiver role) and caregivers (sharer role)
    const [monitoredPeople, caregivers, stats] = await Promise.all([
      role !== 'sharer' ? shareRelationshipService.instance.getMonitoredPeople(email) : [],
      role !== 'caregiver' ? shareRelationshipService.instance.getCaregivers(email) : [],
      shareRelationshipService.instance.getStats(email),
    ]);

    return NextResponse.json({
      success: true,
      monitored_people: monitoredPeople,  // People I'm monitoring (I'm the caregiver)
      my_caregivers: caregivers,           // People monitoring me (I'm the sharer)
      stats,
    });
  } catch (error) {
    console.error('[Share] Error fetching relationships:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const { caregiverEmail, action, role, reason } = body;

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

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required (pause, resume, update_role)' },
        { status: 400 }
      );
    }

    console.log(`[Share] ${email} ${action} relationship with ${caregiverEmail}`);

    let result;
    switch (action) {
      case 'pause':
        result = await shareRelationshipService.instance.pauseSharing(email, caregiverEmail, reason);
        break;
      case 'resume':
        result = await shareRelationshipService.instance.resumeSharing(email, caregiverEmail);
        break;
      case 'update_role':
        if (!role) {
          return NextResponse.json(
            { error: 'Role is required for update_role action' },
            { status: 400 }
          );
        }
        result = await shareRelationshipService.instance.updateCaregiverRole(email, caregiverEmail, role);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Share] Error updating relationship:', error);
    return NextResponse.json(
      { error: 'Failed to update relationship' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const caregiverEmail = request.nextUrl.searchParams.get('caregiverEmail');
    const reason = request.nextUrl.searchParams.get('reason');

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

    console.log(`[Share] ${email} revoking sharing with ${caregiverEmail}`);

    const result = await shareRelationshipService.instance.revokeSharing(
      email,
      caregiverEmail,
      reason || undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Share] Error revoking relationship:', error);
    return NextResponse.json(
      { error: 'Failed to revoke relationship' },
      { status: 500 }
    );
  }
}

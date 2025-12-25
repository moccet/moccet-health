/**
 * Share Permissions API Route
 * GET /api/share/permissions?relationshipId=xxx - Get permissions for a relationship
 * PUT /api/share/permissions - Update permissions for a relationship
 */

import { NextRequest, NextResponse } from 'next/server';
import { shareRelationshipService } from '@/lib/services/share/share-relationship-service';

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const relationshipId = request.nextUrl.searchParams.get('relationshipId');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!relationshipId) {
      return NextResponse.json(
        { error: 'Relationship ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Share] Fetching permissions for relationship ${relationshipId}`);

    const permissions = await shareRelationshipService.getPermissions(relationshipId);

    if (!permissions) {
      return NextResponse.json(
        { error: 'Permissions not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      permissions,
    });
  } catch (error) {
    console.error('[Share] Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const { relationshipId, permissions } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!relationshipId) {
      return NextResponse.json(
        { error: 'Relationship ID is required' },
        { status: 400 }
      );
    }

    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json(
        { error: 'Permissions object is required' },
        { status: 400 }
      );
    }

    console.log(`[Share] Updating permissions for relationship ${relationshipId}`);

    const result = await shareRelationshipService.updatePermissions(
      relationshipId,
      email,
      permissions
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Share] Error updating permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update permissions' },
      { status: 500 }
    );
  }
}

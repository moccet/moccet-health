/**
 * Share Delivery API
 * GET /api/share/delivery - Get pending delivery approvals
 * POST /api/share/delivery - Initiate a delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { interventionEngine } from '@/lib/services/share/intervention-engine';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pending approvals for this user
    const pendingApprovals = await interventionEngine.getPendingDeliveryApprovals(user.email);

    // Get recent orders for people I care for
    const { data: relationships } = await supabase
      .from('share_relationships')
      .select('sharer_email')
      .eq('caregiver_email', user.email)
      .eq('status', 'active');

    const sharerEmails = relationships?.map(r => r.sharer_email) || [];

    const { data: recentOrders } = await supabase
      .from('share_delivery_orders')
      .select('*')
      .in('user_email', [...sharerEmails, user.email])
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      pendingApprovals,
      recentOrders: recentOrders || [],
    });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      user_email,
      items,
      provider = 'instacart',
      requires_approval = true,
    } = body;

    const targetEmail = user_email || user.email;

    // Verify permission if creating for someone else
    if (targetEmail !== user.email) {
      const { data: relationship } = await supabase
        .from('share_relationships')
        .select('share_permissions(can_initiate_deliveries)')
        .eq('sharer_email', targetEmail)
        .eq('caregiver_email', user.email)
        .eq('status', 'active')
        .single();

      const perms = relationship?.share_permissions as any;
      if (!perms?.can_initiate_deliveries) {
        return NextResponse.json(
          { error: 'Not authorized to initiate deliveries' },
          { status: 403 }
        );
      }
    }

    // Create intervention with delivery config
    const intervention = await interventionEngine.createIntervention(
      targetEmail,
      'automated_delivery',
      'caregiver_initiated',
      {
        name: 'Manual Delivery Request',
        deliveryProvider: provider,
        deliveryItems: items,
        deliveryFrequency: 'once',
        requiresApproval: requires_approval,
        approverEmail: targetEmail !== user.email ? user.email : undefined,
      },
      user.email
    );

    // Execute immediately
    const log = await interventionEngine.executeIntervention(intervention.id);

    return NextResponse.json({
      success: true,
      intervention,
      log,
    });
  } catch (error) {
    console.error('Error initiating delivery:', error);
    return NextResponse.json(
      { error: 'Failed to initiate delivery' },
      { status: 500 }
    );
  }
}

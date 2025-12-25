/**
 * Share Delivery Order Actions API
 * GET /api/share/delivery/:orderId - Get order details
 * PUT /api/share/delivery/:orderId - Approve/update order
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { interventionEngine } from '@/lib/services/share/intervention-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
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

    const { orderId } = params;
    const order = await interventionEngine.getDeliveryOrder(orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify access
    const isRecipient = order.user_email === user.email;
    const isApprover = order.approved_by === user.email;

    if (!isRecipient && !isApprover) {
      // Check caregiver relationship
      const { data: relationship } = await supabase
        .from('share_relationships')
        .select('id')
        .eq('sharer_email', order.user_email)
        .eq('caregiver_email', user.email)
        .eq('status', 'active')
        .single();

      if (!relationship) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
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

    const { orderId } = params;
    const body = await request.json();
    const { action } = body;

    const order = await interventionEngine.getDeliveryOrder(orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (action === 'approve') {
      // Only the designated approver or recipient can approve
      // For now, check if user is approver or has caregiver access
      const { data: relationship } = await supabase
        .from('share_relationships')
        .select('id, share_permissions(can_initiate_deliveries)')
        .eq('sharer_email', order.user_email)
        .eq('caregiver_email', user.email)
        .eq('status', 'active')
        .single();

      const perms = relationship?.share_permissions as any;
      if (!perms?.can_initiate_deliveries && order.user_email !== user.email) {
        return NextResponse.json(
          { error: 'Not authorized to approve this order' },
          { status: 403 }
        );
      }

      const updatedOrder = await interventionEngine.approveDeliveryOrder(
        orderId,
        user.email
      );

      return NextResponse.json({
        success: true,
        order: updatedOrder,
      });
    }

    if (action === 'cancel') {
      await supabase
        .from('share_delivery_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

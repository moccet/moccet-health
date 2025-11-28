/**
 * Orders API
 * GET /api/orders - Get user's order history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserOrders, getOrder, getOrderByNumber } from '@/lib/services/orders';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const orderId = searchParams.get('orderId');
    const orderNumber = searchParams.get('orderNumber');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get specific order by ID
    if (orderId) {
      console.log(`[Orders API] Getting order ${orderId} for ${email}`);

      const { order, error } = await getOrder(orderId);

      if (error || !order) {
        return NextResponse.json(
          { success: false, error: error || 'Order not found' },
          { status: 404 }
        );
      }

      // Verify ownership
      if (order.userEmail !== email) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        order,
      });
    }

    // Get specific order by order number
    if (orderNumber) {
      console.log(`[Orders API] Getting order ${orderNumber} for ${email}`);

      const { order, error } = await getOrderByNumber(orderNumber);

      if (error || !order) {
        return NextResponse.json(
          { success: false, error: error || 'Order not found' },
          { status: 404 }
        );
      }

      // Verify ownership
      if (order.userEmail !== email) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        order,
      });
    }

    // Get all orders for user
    console.log(`[Orders API] Getting orders for ${email}`);

    const { orders, error } = await getUserOrders(email, limit);

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('[Orders API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get orders',
      },
      { status: 500 }
    );
  }
}

/**
 * Confirm Order API
 * POST /api/checkout/confirm
 *
 * Confirms payment and creates the order after successful payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrievePaymentIntent } from '@/lib/stripe';
import { createOrderFromCart, type ShippingAddress } from '@/lib/services/orders';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, paymentIntentId, shippingAddress, customerNotes } = body;

    if (!email || !paymentIntentId || !shippingAddress) {
      return NextResponse.json(
        { success: false, error: 'Email, paymentIntentId, and shippingAddress are required' },
        { status: 400 }
      );
    }

    console.log(`[Checkout Confirm API] Confirming order for ${email}, payment intent: ${paymentIntentId}`);

    // Verify payment intent status
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        {
          success: false,
          error: `Payment not completed. Status: ${paymentIntent.status}`,
        },
        { status: 400 }
      );
    }

    console.log(`[Checkout Confirm API] Payment verified: $${paymentIntent.amount / 100}`);

    // Validate shipping address
    const address: ShippingAddress = {
      fullName: shippingAddress.fullName,
      addressLine1: shippingAddress.addressLine1,
      addressLine2: shippingAddress.addressLine2,
      city: shippingAddress.city,
      stateProvince: shippingAddress.stateProvince,
      postalCode: shippingAddress.postalCode,
      country: shippingAddress.country || 'US',
      phone: shippingAddress.phone,
    };

    // Create order
    const { order, error } = await createOrderFromCart(
      email,
      address,
      paymentIntentId,
      customerNotes
    );

    if (error || !order) {
      console.error('[Checkout Confirm API] Order creation failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: error || 'Failed to create order',
        },
        { status: 500 }
      );
    }

    console.log(`[Checkout Confirm API] ✅ Order ${order.orderNumber} created successfully`);

    // Send Slack notification (non-blocking)
    try {
      const { notifyNewOrder } = await import('@/lib/slack');
      await notifyNewOrder(order);
    } catch (slackError) {
      console.error('[Checkout Confirm API] Slack notification failed:', slackError);
      // Don't fail the order if Slack fails
    }

    // TODO: Send order confirmation email
    // await sendOrderConfirmationEmail(order);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        items: order.items,
        shippingAddress: order.shippingAddress,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
      },
      message: `Order ${order.orderNumber} confirmed!`,
    });
  } catch (error) {
    console.error('[Checkout Confirm API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm order',
      },
      { status: 500 }
    );
  }
}

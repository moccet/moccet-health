/**
 * Confirm Order API
 * POST /api/checkout/confirm
 *
 * Confirms payment and creates the order after successful payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrievePaymentIntent } from '@/lib/stripe';
import { createOrderFromCart, type ShippingAddress } from '@/lib/services/orders';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, paymentIntentId, shippingAddress, customerNotes, saveAddress = true } = body;

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

    // Save shipping address for future one-click checkout (if opted in)
    if (saveAddress) {
      try {
        const supabase = await createClient();

        // Check if this exact address already exists
        const { data: existingAddress } = await supabase
          .from('user_addresses')
          .select('id')
          .eq('email', email)
          .eq('address_line1', address.addressLine1)
          .eq('city', address.city)
          .eq('postal_code', address.postalCode)
          .single();

        if (!existingAddress) {
          // Check if user has any addresses
          const { data: addressCount } = await supabase
            .from('user_addresses')
            .select('id')
            .eq('email', email);

          const isFirstAddress = !addressCount || addressCount.length === 0;

          // Save new address
          await supabase.from('user_addresses').insert({
            email,
            full_name: address.fullName,
            address_line1: address.addressLine1,
            address_line2: address.addressLine2,
            city: address.city,
            state_province: address.stateProvince,
            postal_code: address.postalCode,
            country: address.country,
            phone: address.phone,
            is_default: isFirstAddress, // First address becomes default
          });

          console.log('[Checkout Confirm API] Shipping address saved for future checkouts');
        }
      } catch (addressError) {
        console.error('[Checkout Confirm API] Failed to save address:', addressError);
        // Don't fail the order if address save fails
      }
    }

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

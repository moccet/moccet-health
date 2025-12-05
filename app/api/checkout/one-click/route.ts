/**
 * One-Click Checkout API
 * POST /api/checkout/one-click
 *
 * Enables instant checkout using saved address and Stripe payment method
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export async function POST(request: NextRequest) {
  try {
    const { email, addressId, saveAddress } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user's cart
    const { data: cartData, error: cartError } = await supabase
      .from('shopping_carts')
      .select(`
        *,
        cart_items (
          *,
          supplement_products (*)
        )
      `)
      .eq('user_email', email)
      .eq('is_active', true)
      .single();

    if (cartError || !cartData || !cartData.cart_items?.length) {
      return NextResponse.json(
        { success: false, error: 'Cart is empty or not found' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = cartData.cart_items.reduce(
      (sum: number, item: any) => sum + (item.quantity * parseFloat(item.unit_price)),
      0
    );

    const shipping = subtotal >= 75 ? 0 : 9.99;
    const tax = subtotal * 0.08; // 8% tax (simplified)
    const total = subtotal + shipping + tax;

    // Get or create shipping address
    let shippingAddress;

    if (addressId) {
      // Use existing address
      const { data: addressData, error: addressError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('id', addressId)
        .eq('email', email)
        .single();

      if (addressError || !addressData) {
        return NextResponse.json(
          { success: false, error: 'Address not found' },
          { status: 404 }
        );
      }

      shippingAddress = {
        fullName: addressData.full_name,
        addressLine1: addressData.address_line1,
        addressLine2: addressData.address_line2,
        city: addressData.city,
        stateProvince: addressData.state_province,
        postalCode: addressData.postal_code,
        country: addressData.country,
        phone: addressData.phone,
      };
    } else {
      // Get default address
      const { data: defaultAddress, error: defaultError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('email', email)
        .eq('is_default', true)
        .single();

      if (defaultError || !defaultAddress) {
        return NextResponse.json(
          { success: false, error: 'No saved address found. Please add a shipping address.' },
          { status: 400 }
        );
      }

      shippingAddress = {
        fullName: defaultAddress.full_name,
        addressLine1: defaultAddress.address_line1,
        addressLine2: defaultAddress.address_line2,
        city: defaultAddress.city,
        stateProvince: defaultAddress.state_province,
        postalCode: defaultAddress.postal_code,
        country: defaultAddress.country,
        phone: defaultAddress.phone,
      };
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // Convert to cents
      currency: 'usd',
      receipt_email: email,
      metadata: {
        email,
        cartId: cartData.id,
        planCode: cartData.plan_code || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Return checkout session
    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      orderSummary: {
        subtotal,
        shipping,
        tax,
        total,
        items: cartData.cart_items.map((item: any) => ({
          name: item.supplement_products.name,
          brand: item.supplement_products.brand,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price),
          lineTotal: item.quantity * parseFloat(item.unit_price),
        })),
      },
      shippingAddress,
      needsPayment: true,
    });

  } catch (error) {
    console.error('[One-Click Checkout] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'One-click checkout failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Check if user has saved address for one-click checkout
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get default address
    const { data: defaultAddress } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('email', email)
      .eq('is_default', true)
      .single();

    // Get all addresses
    const { data: allAddresses } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('email', email)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      hasAddress: !!defaultAddress,
      defaultAddress,
      addresses: allAddresses || [],
    });

  } catch (error) {
    console.error('[One-Click Checkout] Error checking address:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check saved address',
      },
      { status: 500 }
    );
  }
}

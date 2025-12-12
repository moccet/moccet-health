import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  encryptPaymentCard,
  decryptPaymentCard,
  maskCardNumber,
} from '@/lib/services/shopping-agent/encryption-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET - List stored payment methods for a user (masked)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data: cards, error } = await supabase
      .from('user_payment_credentials')
      .select('id, card_last_four, card_brand, cardholder_name, billing_address_id, is_default, is_active, last_used_at, created_at')
      .eq('user_email', email)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('[Shopping Agent] Error fetching payment methods:', error);
      return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 });
    }

    // Transform for display
    const paymentMethods = cards?.map(card => ({
      id: card.id,
      cardNumber: maskCardNumber(card.card_last_four, card.card_brand),
      lastFour: card.card_last_four,
      brand: card.card_brand,
      cardholderName: card.cardholder_name,
      billingAddressId: card.billing_address_id,
      isDefault: card.is_default,
      lastUsedAt: card.last_used_at,
      createdAt: card.created_at,
    })) || [];

    return NextResponse.json({
      success: true,
      paymentMethods,
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in GET /payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Store new payment method
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, cardNumber, expiry, cvv, cardholderName, billingAddressId, setAsDefault } = body;

    // Validation
    if (!email || !cardNumber || !expiry || !cvv) {
      return NextResponse.json(
        { error: 'Email, cardNumber, expiry, and cvv are required' },
        { status: 400 }
      );
    }

    // Basic card validation
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return NextResponse.json({ error: 'Invalid card number' }, { status: 400 });
    }

    // Validate expiry format (MM/YY or MM/YYYY)
    const expiryRegex = /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/;
    if (!expiryRegex.test(expiry)) {
      return NextResponse.json({ error: 'Invalid expiry format. Use MM/YY or MM/YYYY' }, { status: 400 });
    }

    // Validate CVV
    const cleanCvv = cvv.replace(/\D/g, '');
    if (cleanCvv.length < 3 || cleanCvv.length > 4) {
      return NextResponse.json({ error: 'Invalid CVV' }, { status: 400 });
    }

    console.log(`[Shopping Agent] Storing payment method for ${email}`);

    // Encrypt card details
    const encrypted = encryptPaymentCard({
      cardNumber: cleanNumber,
      expiry,
      cvv: cleanCvv,
      cardholderName,
    });

    // If setting as default, unset existing defaults first
    if (setAsDefault) {
      await supabase
        .from('user_payment_credentials')
        .update({ is_default: false })
        .eq('user_email', email);
    }

    // Check if a card with same last four already exists
    const { data: existing } = await supabase
      .from('user_payment_credentials')
      .select('id')
      .eq('user_email', email)
      .eq('card_last_four', encrypted.cardLastFour)
      .eq('card_brand', encrypted.cardBrand)
      .single();

    if (existing) {
      // Update existing card
      const { data, error } = await supabase
        .from('user_payment_credentials')
        .update({
          encrypted_card_number: encrypted.encryptedCardNumber,
          encrypted_expiry: encrypted.encryptedExpiry,
          encrypted_cvv: encrypted.encryptedCvv,
          cardholder_name: cardholderName,
          billing_address_id: billingAddressId,
          is_default: setAsDefault || false,
          is_active: true,
          encryption_key_id: encrypted.keyId,
          encryption_version: encrypted.version,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) {
        console.error('[Shopping Agent] Error updating payment method:', error);
        return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        paymentMethodId: data.id,
        cardLastFour: encrypted.cardLastFour,
        cardBrand: encrypted.cardBrand,
        message: 'Payment method updated',
      });
    }

    // Insert new card
    const { data, error } = await supabase
      .from('user_payment_credentials')
      .insert({
        user_email: email,
        encrypted_card_number: encrypted.encryptedCardNumber,
        encrypted_expiry: encrypted.encryptedExpiry,
        encrypted_cvv: encrypted.encryptedCvv,
        card_last_four: encrypted.cardLastFour,
        card_brand: encrypted.cardBrand,
        cardholder_name: cardholderName,
        billing_address_id: billingAddressId,
        encryption_key_id: encrypted.keyId,
        encryption_version: encrypted.version,
        is_default: setAsDefault || false,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Shopping Agent] Error storing payment method:', error);
      return NextResponse.json({ error: 'Failed to store payment method' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paymentMethodId: data.id,
      cardLastFour: encrypted.cardLastFour,
      cardBrand: encrypted.cardBrand,
      message: 'Payment method stored securely',
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in POST /payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Remove payment method
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (!email || !id) {
      return NextResponse.json({ error: 'Email and id are required' }, { status: 400 });
    }

    // Soft delete (mark as inactive)
    const { error } = await supabase
      .from('user_payment_credentials')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_email', email);

    if (error) {
      console.error('[Shopping Agent] Error deleting payment method:', error);
      return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted',
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in DELETE /payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update payment method (e.g., set as default)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, id, action, billingAddressId } = body;

    if (!email || !id) {
      return NextResponse.json({ error: 'Email and id are required' }, { status: 400 });
    }

    switch (action) {
      case 'set_default':
        // Unset existing defaults
        await supabase
          .from('user_payment_credentials')
          .update({ is_default: false })
          .eq('user_email', email);

        // Set new default
        await supabase
          .from('user_payment_credentials')
          .update({ is_default: true, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_email', email);
        break;

      case 'update_billing_address':
        if (!billingAddressId) {
          return NextResponse.json({ error: 'billingAddressId is required' }, { status: 400 });
        }
        await supabase
          .from('user_payment_credentials')
          .update({ billing_address_id: billingAddressId, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_email', email);
        break;

      case 'record_usage':
        await supabase
          .from('user_payment_credentials')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_email', email);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('[Shopping Agent] Error in PATCH /payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

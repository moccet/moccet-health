/**
 * User Addresses API
 * Manage shipping addresses for one-click checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET - Get all addresses for a user
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

    const { data: addresses, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('email', email)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Addresses API] Error fetching addresses:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch addresses' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      addresses: addresses || [],
    });

  } catch (error) {
    console.error('[Addresses API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch addresses',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Add a new address
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      fullName,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country = 'US',
      phone,
      isDefault = false,
    } = body;

    // Validation
    if (!email || !fullName || !addressLine1 || !city || !stateProvince || !postalCode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: address, error } = await supabase
      .from('user_addresses')
      .insert({
        email,
        full_name: fullName,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state_province: stateProvince,
        postal_code: postalCode,
        country,
        phone,
        is_default: isDefault,
      })
      .select()
      .single();

    if (error) {
      console.error('[Addresses API] Error creating address:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save address' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      address,
    });

  } catch (error) {
    console.error('[Addresses API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save address',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update an address
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      email,
      fullName,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country,
      phone,
      isDefault,
    } = body;

    if (!id || !email) {
      return NextResponse.json(
        { success: false, error: 'Address ID and email are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const updateData: any = {};
    if (fullName !== undefined) updateData.full_name = fullName;
    if (addressLine1 !== undefined) updateData.address_line1 = addressLine1;
    if (addressLine2 !== undefined) updateData.address_line2 = addressLine2;
    if (city !== undefined) updateData.city = city;
    if (stateProvince !== undefined) updateData.state_province = stateProvince;
    if (postalCode !== undefined) updateData.postal_code = postalCode;
    if (country !== undefined) updateData.country = country;
    if (phone !== undefined) updateData.phone = phone;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    const { data: address, error } = await supabase
      .from('user_addresses')
      .update(updateData)
      .eq('id', id)
      .eq('email', email)
      .select()
      .single();

    if (error) {
      console.error('[Addresses API] Error updating address:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update address' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      address,
    });

  } catch (error) {
    console.error('[Addresses API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update address',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete an address
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id || !email) {
      return NextResponse.json(
        { success: false, error: 'Address ID and email are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', id)
      .eq('email', email);

    if (error) {
      console.error('[Addresses API] Error deleting address:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete address' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Address deleted',
    });

  } catch (error) {
    console.error('[Addresses API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete address',
      },
      { status: 500 }
    );
  }
}

/**
 * Reset Product Image API
 * POST /api/admin/reset-product-image
 *
 * Forces a product to re-fetch its image
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID required' },
        { status: 400 }
      );
    }

    // Reset image fields to force re-fetch
    const { error } = await supabase
      .from('supplement_products')
      .update({
        image_url: null,
        image_fetch_status: 'pending',
        image_confidence_score: 0,
        last_image_fetch_attempt: null,
        image_verification_notes: null,
      })
      .eq('id', productId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product image reset. Refresh page to trigger re-fetch.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to reset image' },
      { status: 500 }
    );
  }
}

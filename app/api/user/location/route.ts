/**
 * User Location API
 *
 * Stores user's location preference for location-aware insights.
 * Location is used to personalize health recommendations based on
 * local climate, cuisine, and cultural wellness practices.
 *
 * POST /api/user/location - Store/update user location
 * GET /api/user/location - Get user's current location
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('UserLocationAPI');

export async function POST(request: NextRequest) {
  try {
    const { email, location, timezone, timezone_offset } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check if user already has a device context record
    const { data: existingDevice } = await supabase
      .from('user_device_context')
      .select('id')
      .eq('email', email)
      .limit(1)
      .single();

    if (existingDevice) {
      // Update existing record
      const { error } = await supabase
        .from('user_device_context')
        .update({
          timezone: timezone || 'UTC',
          timezone_offset: timezone_offset || 0,
          locale: location,
          synced_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (error) {
        logger.error('Error updating user location', { error, email });
        return NextResponse.json(
          { error: 'Failed to update location', details: error.message },
          { status: 500 }
        );
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('user_device_context')
        .insert({
          email,
          timezone: timezone || 'UTC',
          timezone_offset: timezone_offset || 0,
          locale: location,
          synced_at: new Date().toISOString(),
          travel_detected: false,
        });

      if (error) {
        logger.error('Error inserting user location', { error, email });
        return NextResponse.json(
          { error: 'Failed to store location', details: error.message },
          { status: 500 }
        );
      }
    }

    // Also update travel context - delete old and insert new
    await supabase
      .from('user_travel_context')
      .delete()
      .eq('email', email)
      .eq('travel_type', 'home');

    await supabase.from('user_travel_context').insert({
      email,
      current_timezone: timezone || 'UTC',
      timezone_offset_change: 0,
      estimated_location: location,
      travel_type: 'home',
      insights_generated: false,
      created_at: new Date().toISOString(),
    });

    logger.info('User location updated', { email, location, timezone });

    return NextResponse.json({
      success: true,
      message: 'Location updated successfully',
      location,
    });
  } catch (error) {
    logger.error('Error in POST /api/user/location', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // First check travel context for explicit location
    const { data: travelData } = await supabase
      .from('user_travel_context')
      .select('estimated_location, current_timezone')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (travelData?.estimated_location) {
      return NextResponse.json({
        success: true,
        location: travelData.estimated_location,
        timezone: travelData.current_timezone,
        source: 'travel_context',
      });
    }

    // Fall back to device context
    const { data: deviceData } = await supabase
      .from('user_device_context')
      .select('locale, timezone')
      .eq('email', email)
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    if (deviceData?.locale) {
      return NextResponse.json({
        success: true,
        location: deviceData.locale,
        timezone: deviceData.timezone,
        source: 'device_context',
      });
    }

    return NextResponse.json({
      success: true,
      location: null,
      timezone: null,
      source: null,
    });
  } catch (error) {
    logger.error('Error in GET /api/user/location', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

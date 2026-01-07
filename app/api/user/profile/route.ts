/**
 * User Profile API
 * GET /api/user/profile - Get user profile
 * PUT /api/user/profile - Update user profile (display name, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      console.error('[Profile] Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: profile || null,
      hasDisplayName: !!profile?.display_name,
    });
  } catch (error) {
    console.error('[Profile] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { display_name, avatar_url, bio } = body;

    // Validate display name
    if (display_name !== undefined) {
      if (typeof display_name !== 'string') {
        return NextResponse.json(
          { error: 'Display name must be a string' },
          { status: 400 }
        );
      }

      const trimmedName = display_name.trim();

      if (trimmedName.length < 2) {
        return NextResponse.json(
          { error: 'Display name must be at least 2 characters' },
          { status: 400 }
        );
      }

      if (trimmedName.length > 50) {
        return NextResponse.json(
          { error: 'Display name must be 50 characters or less' },
          { status: 400 }
        );
      }
    }

    // Check if profile exists
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_email', email)
      .single();

    let profile;

    if (existing) {
      // Update existing profile
      const updateData: Record<string, string> = {};
      if (display_name !== undefined) updateData.display_name = display_name.trim();
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      if (bio !== undefined) updateData.bio = bio;

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_email', email)
        .select()
        .single();

      if (error) {
        console.error('[Profile] Error updating profile:', error);
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        );
      }

      profile = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_email: email,
          display_name: display_name?.trim() || null,
          avatar_url: avatar_url || null,
          bio: bio || null,
        })
        .select()
        .single();

      if (error) {
        console.error('[Profile] Error creating profile:', error);
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        );
      }

      profile = data;
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('[Profile] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('email_draft_settings')
      .select('auto_scheduling_enabled, auto_meet_links')
      .eq('user_email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching calendar settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({
      autoScheduleEnabled: data?.auto_scheduling_enabled ?? false,
      autoMeetEnabled: data?.auto_meet_links ?? true,
    });
  } catch (error) {
    console.error('Error in calendar settings GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, autoScheduleEnabled, autoMeetEnabled } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Upsert the settings
    const { error } = await supabase
      .from('email_draft_settings')
      .upsert(
        {
          user_email: email,
          auto_scheduling_enabled: autoScheduleEnabled,
          auto_meet_links: autoMeetEnabled,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_email',
        }
      );

    if (error) {
      console.error('Error saving calendar settings:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in calendar settings POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
      .select('drafts_enabled, follow_ups_enabled, follow_up_days, custom_tone_enabled, reply_frequency')
      .eq('user_email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching draft settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({
      settings: data
        ? {
            draftsEnabled: data.drafts_enabled ?? true,
            followUpsEnabled: data.follow_ups_enabled ?? true,
            followUpDays: data.follow_up_days ?? 3,
            customToneEnabled: data.custom_tone_enabled ?? false,
            replyFrequency: data.reply_frequency ?? 'almost_everything',
          }
        : null,
    });
  } catch (error) {
    console.error('Error in draft settings GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, settings } = body;

    if (!email || !settings) {
      return NextResponse.json(
        { error: 'Email and settings required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Upsert the settings
    const { error } = await supabase
      .from('email_draft_settings')
      .upsert(
        {
          user_email: email,
          drafts_enabled: settings.draftsEnabled,
          follow_ups_enabled: settings.followUpsEnabled,
          follow_up_days: settings.followUpDays,
          custom_tone_enabled: settings.customToneEnabled,
          reply_frequency: settings.replyFrequency,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_email',
        }
      );

    if (error) {
      console.error('Error saving draft settings:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in draft settings POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

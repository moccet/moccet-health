import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('auto_scheduled_events')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching auto-scheduled events:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({
      events: (data || []).map((event) => ({
        id: event.id,
        eventTitle: event.event_title,
        eventTime: event.event_time,
        meetLink: event.meet_link,
        emailSubject: event.email_subject,
        createdAt: event.created_at,
        attendees: event.attendees || [],
      })),
    });
  } catch (error) {
    console.error('Error in auto-scheduled GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      emailMessageId,
      calendarEventId,
      eventTitle,
      eventTime,
      meetLink,
      emailSubject,
      attendees,
    } = body;

    if (!email || !calendarEventId || !eventTitle || !eventTime) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('auto_scheduled_events')
      .insert({
        user_email: email,
        email_message_id: emailMessageId,
        calendar_event_id: calendarEventId,
        event_title: eventTitle,
        event_time: eventTime,
        meet_link: meetLink,
        email_subject: emailSubject,
        attendees: attendees || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving auto-scheduled event:', error);
      return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: {
        id: data.id,
        eventTitle: data.event_title,
        eventTime: data.event_time,
        meetLink: data.meet_link,
      },
    });
  } catch (error) {
    console.error('Error in auto-scheduled POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

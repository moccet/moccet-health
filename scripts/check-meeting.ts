/**
 * Script to check meeting status by Google Meet URL
 * Run with: npx tsx scripts/check-meeting.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const GOOGLE_MEET_URL = 'https://meet.google.com/wah-sjxw-pyw';
const MEET_CODE = 'wah-sjxw-pyw';

async function checkMeeting() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials in .env.local');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'MISSING');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('\n========================================');
  console.log('Checking for meeting:', GOOGLE_MEET_URL);
  console.log('========================================\n');

  // Check meeting_recordings table for this URL
  const { data: meetings, error: meetingsError } = await supabase
    .from('meeting_recordings')
    .select(`
      id,
      user_email,
      user_code,
      title,
      google_meet_url,
      calendar_event_id,
      scheduled_start,
      scheduled_end,
      actual_start,
      actual_end,
      duration_seconds,
      status,
      bot_session_id,
      recording_url,
      email_sent,
      email_sent_at,
      error_message,
      notetaker_enabled,
      created_at,
      updated_at
    `)
    .or(`google_meet_url.ilike.%${MEET_CODE}%,google_meet_url.eq.${GOOGLE_MEET_URL}`);

  if (meetingsError) {
    console.error('Error querying meetings:', meetingsError);
    return;
  }

  if (!meetings || meetings.length === 0) {
    console.log('❌ No meeting records found with this Google Meet URL');
    console.log('\nPossible reasons:');
    console.log('  1. The meeting was never scheduled/synced to the notetaker system');
    console.log('  2. Auto-join was disabled for this calendar');
    console.log('  3. The meeting was not on a connected Google Calendar');

    // Let's also check what meetings exist for any user
    console.log('\n--- Checking recent meetings in the system ---');
    const { data: recentMeetings, error: recentError } = await supabase
      .from('meeting_recordings')
      .select('id, user_email, title, google_meet_url, status, scheduled_start, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentMeetings && recentMeetings.length > 0) {
      console.log('\nRecent 10 meetings in the system:');
      recentMeetings.forEach((m, i) => {
        console.log(`  ${i + 1}. [${m.status}] ${m.title || 'No title'}`);
        console.log(`      User: ${m.user_email}`);
        console.log(`      URL: ${m.google_meet_url}`);
        console.log(`      Scheduled: ${m.scheduled_start}`);
        console.log('');
      });
    } else {
      console.log('\nNo meetings found in the system at all.');
    }
    return;
  }

  console.log(`✅ Found ${meetings.length} meeting record(s):\n`);

  for (const meeting of meetings) {
    console.log('========================================');
    console.log('Meeting Details:');
    console.log('========================================');
    console.log(`  ID: ${meeting.id}`);
    console.log(`  Title: ${meeting.title || 'No title'}`);
    console.log(`  User: ${meeting.user_email}`);
    console.log(`  Google Meet URL: ${meeting.google_meet_url}`);
    console.log(`  Status: ${meeting.status}`);
    console.log(`  Notetaker Enabled: ${meeting.notetaker_enabled}`);
    console.log(`  Bot Session ID: ${meeting.bot_session_id || 'None'}`);
    console.log(`  Scheduled Start: ${meeting.scheduled_start}`);
    console.log(`  Scheduled End: ${meeting.scheduled_end}`);
    console.log(`  Actual Start: ${meeting.actual_start || 'Not started'}`);
    console.log(`  Actual End: ${meeting.actual_end || 'Not ended'}`);
    console.log(`  Duration: ${meeting.duration_seconds ? `${Math.round(meeting.duration_seconds / 60)} minutes` : 'N/A'}`);
    console.log(`  Recording URL: ${meeting.recording_url || 'None'}`);
    console.log(`  Email Sent: ${meeting.email_sent ? `Yes (at ${meeting.email_sent_at})` : 'No'}`);
    console.log(`  Error Message: ${meeting.error_message || 'None'}`);
    console.log(`  Created: ${meeting.created_at}`);
    console.log(`  Updated: ${meeting.updated_at}`);

    // Check for transcripts
    const { data: transcripts } = await supabase
      .from('meeting_transcripts')
      .select('id, created_at, detected_language, overall_confidence')
      .eq('meeting_id', meeting.id);

    console.log(`\n  Transcripts: ${transcripts?.length || 0}`);
    if (transcripts && transcripts.length > 0) {
      transcripts.forEach(t => {
        console.log(`    - ID: ${t.id}, Language: ${t.detected_language}, Confidence: ${t.overall_confidence}`);
      });
    }

    // Check for summaries
    const { data: summaries } = await supabase
      .from('meeting_summaries')
      .select('id, summary_style, is_primary, created_at')
      .eq('meeting_id', meeting.id);

    console.log(`\n  Summaries: ${summaries?.length || 0}`);
    if (summaries && summaries.length > 0) {
      summaries.forEach(s => {
        console.log(`    - Style: ${s.summary_style}, Primary: ${s.is_primary}`);
      });
    }

    // Check for action items
    const { data: actionItems } = await supabase
      .from('meeting_action_items')
      .select('id, task_description, owner_name, status')
      .eq('meeting_id', meeting.id);

    console.log(`\n  Action Items: ${actionItems?.length || 0}`);
    if (actionItems && actionItems.length > 0) {
      actionItems.forEach(a => {
        console.log(`    - [${a.status}] ${a.task_description} (Owner: ${a.owner_name || 'Unassigned'})`);
      });
    }

    console.log('\n');
  }

  // If bot_session_id exists, we could also check Recall.ai status
  // but that would require the API key which we don't want to expose in this script

  console.log('========================================');
  console.log('Analysis Complete');
  console.log('========================================');
}

checkMeeting().catch(console.error);

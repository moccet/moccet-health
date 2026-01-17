import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/services/onesignal-service';
import { isValidCronRequest, requireCronSecret } from '@/lib/utils/cron-auth';

/**
 * Sage Meal Reminder Cron Job
 *
 * Checks for users who haven't logged meals in 2+ days and sends them
 * a friendly reminder to track their nutrition with moccet chef.
 *
 * Configure in vercel.json:
 * - { "path": "/api/cron/sage-reminders", "schedule": "0 12 * * *" }
 * (Runs daily at 12pm UTC)
 */

export const maxDuration = 120;

const REMINDER_MESSAGES = [
  {
    title: "Missing your meals! 🍽️",
    body: "Track what you eat to get personalized nutrition insights with moccet chef.",
  },
  {
    title: "Time to log your food! 📊",
    body: "Keep your nutrition streak going - open moccet chef to track your meals.",
  },
  {
    title: "Your nutrition awaits! 🥗",
    body: "Log your meals to unlock personalized health insights in moccet chef.",
  },
  {
    title: "Don't forget to eat well! 💪",
    body: "Track your meals with moccet chef to stay on top of your nutrition goals.",
  },
];

export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Sage Reminders] Starting cron job');
  const startTime = Date.now();

  try {
    const supabase = createAdminClient();

    // Get date 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Get all active users with device tokens (so we can send notifications)
    const { data: usersWithTokens, error: tokenError } = await supabase
      .from('user_device_tokens')
      .select('email')
      .eq('is_active', true)
      .eq('provider', 'onesignal');

    if (tokenError) {
      console.error('[Sage Reminders] Error fetching users:', tokenError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const activeEmails = [...new Set(usersWithTokens?.map(u => u.email) || [])];
    console.log(`[Sage Reminders] Found ${activeEmails.length} users with push tokens`);

    if (activeEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with push tokens',
        users_checked: 0,
        reminders_sent: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // For each user, check if they have logged food in the last 2 days
    let remindersSent = 0;
    let usersChecked = 0;

    for (const email of activeEmails) {
      usersChecked++;

      // Check for recent food logs
      const { data: recentLogs, error: logsError } = await supabase
        .from('sage_food_logs')
        .select('id')
        .eq('user_email', email)
        .gte('logged_at', twoDaysAgo.toISOString())
        .limit(1);

      if (logsError) {
        console.error(`[Sage Reminders] Error checking logs for ${email}:`, logsError);
        continue;
      }

      // If no recent logs, send reminder
      if (!recentLogs || recentLogs.length === 0) {
        // Check if we already sent a reminder recently (last 24 hours)
        const { data: recentReminder } = await supabase
          .from('notification_history')
          .select('id')
          .eq('user_email', email)
          .eq('notification_type', 'sage_meal_reminder')
          .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (recentReminder && recentReminder.length > 0) {
          console.log(`[Sage Reminders] Already sent reminder to ${email} recently`);
          continue;
        }

        // Pick a random message
        const message = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];

        // Send notification with deep link data
        const sent = await sendPushNotification(email, {
          title: message.title,
          body: message.body,
          data: {
            type: 'sage_reminder',
            deep_link: 'sage',
            action: 'open_sage',
          },
        });

        if (sent > 0) {
          remindersSent++;
          console.log(`[Sage Reminders] Sent reminder to ${email}`);

          // Log the notification
          await supabase.from('notification_history').insert({
            user_email: email,
            notification_type: 'sage_meal_reminder',
            title: message.title,
            body: message.body,
            sent_at: new Date().toISOString(),
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Sage Reminders] Complete. Checked ${usersChecked} users, sent ${remindersSent} reminders in ${duration}ms`);

    return NextResponse.json({
      success: true,
      users_checked: usersChecked,
      reminders_sent: remindersSent,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Sage Reminders] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Manual trigger
export async function POST(request: NextRequest) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return GET(request);
}

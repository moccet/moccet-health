import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/services/onesignal-service';
import { isValidCronRequest } from '@/lib/utils/cron-auth';

/**
 * Forge Engagement Reminder
 * Sends encouraging notifications to users who haven't created a workout plan
 * Runs daily - targets users who signed up ~24-48 hours ago but haven't generated a Forge plan
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Positive affirmation style notification messages
const FORGE_ENGAGEMENT_MESSAGES = [
  {
    title: "You've got what it takes",
    body: "Your personalized workout plan is just a tap away. Let's build the strongest version of you together.",
  },
  {
    title: "Your strength journey begins now",
    body: "We've crafted a training program just for you. Ready to unlock your potential? Your future self is cheering you on!",
  },
  {
    title: "Every champion started somewhere",
    body: "Your custom workout plan is waiting. Take the first step today and watch yourself transform.",
  },
  {
    title: "You're stronger than you think",
    body: "Generate your personalized training program and start building the body you deserve. We believe in you!",
  },
  {
    title: "Today is your day to begin",
    body: "Your AI-powered workout plan is ready to be created. One tap to start your transformation journey!",
  },
];

export async function GET(request: NextRequest) {
  // Verify cron request
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Forge Engagement] Starting engagement reminder check...');

  try {
    // Find users who:
    // 1. Signed up approximately 24-48 hours ago
    // 2. Have NOT generated a Forge workout plan
    // 3. Have NOT already received this notification

    const now = new Date();
    const minTime = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
    const maxTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Get users who signed up in the target window
    const { data: recentUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('email, created_at, full_name, first_name')
      .gte('created_at', minTime.toISOString())
      .lte('created_at', maxTime.toISOString());

    if (usersError) {
      console.error('[Forge Engagement] Error fetching users:', usersError);
    }

    const targetUsers = recentUsers || [];
    console.log(`[Forge Engagement] Found ${targetUsers.length} users in target window`);

    if (targetUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users in target engagement window',
        notificationsSent: 0,
      });
    }

    let notificationsSent = 0;
    const results: { email: string; sent: boolean; reason?: string }[] = [];

    for (const user of targetUsers) {
      const email = user.email;

      // Check if user already has a Forge workout plan
      const { data: existingPlan } = await supabase
        .from('forge_workout_plans')
        .select('id')
        .eq('user_email', email)
        .eq('is_active', true)
        .single();

      if (existingPlan) {
        results.push({ email, sent: false, reason: 'User already has a workout plan' });
        continue;
      }

      // Check if we already sent this notification (prevent duplicates - ONLY ONCE EVER)
      const { data: existingNotification } = await supabase
        .from('real_time_insights')
        .select('id')
        .eq('email', email)
        .eq('category', 'forge_engagement')
        .single();

      if (existingNotification) {
        results.push({ email, sent: false, reason: 'Forge engagement notification already sent' });
        continue;
      }

      // Select a random positive message
      const message = FORGE_ENGAGEMENT_MESSAGES[Math.floor(Math.random() * FORGE_ENGAGEMENT_MESSAGES.length)];

      // Personalize with first name if available
      const firstName = user.first_name || user.full_name?.split(' ')[0];
      const personalizedTitle = firstName
        ? message.title.replace("You've", `${firstName}, you've`).replace("You're", `${firstName}, you're`)
        : message.title;

      // Send the notification
      const sentCount = await sendPushNotification({
        email,
        title: personalizedTitle,
        body: message.body,
        data: {
          type: 'forge_engagement',
          screen: 'forge_home',
        },
      });

      if (sentCount > 0) {
        // Log that we sent this notification (ensures we never send again)
        await supabase.from('real_time_insights').insert({
          email,
          category: 'forge_engagement',
          title: personalizedTitle,
          message: message.body,
          severity: 'info',
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        });

        notificationsSent++;
        results.push({ email, sent: true });
        console.log(`[Forge Engagement] Sent notification to ${email}`);
      } else {
        results.push({ email, sent: false, reason: 'No device tokens' });
      }
    }

    console.log(`[Forge Engagement] Complete. Sent ${notificationsSent} notifications.`);

    return NextResponse.json({
      success: true,
      usersChecked: targetUsers.length,
      notificationsSent,
      results,
    });

  } catch (error) {
    console.error('[Forge Engagement] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process Forge engagement reminders' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/services/onesignal-service';

/**
 * Sage Engagement Reminder
 * Sends encouraging notifications to users who haven't started using Sage
 * Runs daily - targets users who signed up ~2 days ago but haven't logged any meals/water
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Positive, encouraging notification messages
const ENGAGEMENT_MESSAGES = [
  {
    title: "Your personalized nutrition journey awaits",
    body: "Take 2 minutes to set up your meal plan and start feeling your best. Your body will thank you!",
  },
  {
    title: "Ready to unlock your nutrition potential?",
    body: "Your personalized meal plan is waiting! Start tracking today and discover insights tailored just for you.",
  },
  {
    title: "Small steps, big results",
    body: "Logging your first meal takes just seconds. Let's build healthy habits together - your future self will be grateful!",
  },
  {
    title: "Your wellness journey starts with one tap",
    body: "Get your AI-powered meal plan and start tracking. It's easier than you think, and we're here to help!",
  },
];

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Sage Engagement] Starting engagement reminder check...');

  try {
    // Find users who:
    // 1. Signed up approximately 2 days ago (between 36-60 hours ago)
    // 2. Have NOT logged any food
    // 3. Have NOT logged any water
    // 4. Have NOT completed Sage onboarding

    const now = new Date();
    const minTime = new Date(now.getTime() - 60 * 60 * 60 * 1000); // 60 hours ago
    const maxTime = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 hours ago

    // Get users who signed up in the target window
    const { data: recentUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('email, created_at, full_name')
      .gte('created_at', minTime.toISOString())
      .lte('created_at', maxTime.toISOString());

    if (usersError) {
      console.error('[Sage Engagement] Error fetching users:', usersError);
      // Fallback: try auth.users if user_profiles doesn't exist
    }

    const targetUsers = recentUsers || [];
    console.log(`[Sage Engagement] Found ${targetUsers.length} users in target window`);

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

      // Check if user has any food logs
      const { count: foodLogCount } = await supabase
        .from('sage_food_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email);

      // Check if user has any water logs
      const { count: waterLogCount } = await supabase
        .from('water_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email);

      // Check if user completed Sage onboarding
      const { data: profile } = await supabase
        .from('sage_nutrition_profiles')
        .select('id')
        .eq('user_email', email)
        .single();

      const hasEngaged = (foodLogCount && foodLogCount > 0) ||
                         (waterLogCount && waterLogCount > 0) ||
                         profile !== null;

      if (hasEngaged) {
        results.push({ email, sent: false, reason: 'User already engaged with Sage' });
        continue;
      }

      // Check if we already sent this notification (prevent duplicates)
      const { data: existingNotification } = await supabase
        .from('real_time_insights')
        .select('id')
        .eq('email', email)
        .eq('category', 'sage_engagement')
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .single();

      if (existingNotification) {
        results.push({ email, sent: false, reason: 'Engagement notification already sent' });
        continue;
      }

      // Select a random positive message
      const message = ENGAGEMENT_MESSAGES[Math.floor(Math.random() * ENGAGEMENT_MESSAGES.length)];

      // Send the notification
      const sentCount = await sendPushNotification({
        email,
        title: message.title,
        body: message.body,
        data: {
          type: 'sage_engagement',
          screen: 'sage_onboarding',
        },
      });

      if (sentCount > 0) {
        // Log that we sent this notification
        await supabase.from('real_time_insights').insert({
          email,
          category: 'sage_engagement',
          title: message.title,
          message: message.body,
          severity: 'info',
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        });

        notificationsSent++;
        results.push({ email, sent: true });
        console.log(`[Sage Engagement] Sent notification to ${email}`);
      } else {
        results.push({ email, sent: false, reason: 'No device tokens' });
      }
    }

    console.log(`[Sage Engagement] Complete. Sent ${notificationsSent} notifications.`);

    return NextResponse.json({
      success: true,
      usersChecked: targetUsers.length,
      notificationsSent,
      results,
    });

  } catch (error) {
    console.error('[Sage Engagement] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process engagement reminders' },
      { status: 500 }
    );
  }
}

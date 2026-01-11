/**
 * Debug endpoint to check what data exists for morning briefing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'moccet-admin-seed-key';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (cronSecret !== CRON_SECRET && authHeader !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check deep_content_analysis for Slack
    const { data: slackData } = await supabase
      .from('deep_content_analysis')
      .select('source, pending_tasks, response_debt, analyzed_at')
      .eq('user_email', email)
      .eq('source', 'slack')
      .order('analyzed_at', { ascending: false })
      .limit(1);

    // Check deep_content_analysis for Gmail
    const { data: gmailData } = await supabase
      .from('deep_content_analysis')
      .select('source, pending_tasks, response_debt, analyzed_at')
      .eq('user_email', email)
      .eq('source', 'gmail')
      .order('analyzed_at', { ascending: false })
      .limit(1);

    // Check linear_issues
    const { data: linearData, count: linearCount } = await supabase
      .from('linear_issues')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', email);

    // Check notion_tasks
    const { data: notionData, count: notionCount } = await supabase
      .from('notion_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', email);

    // Check timezone data from various sources
    const { data: prefData } = await supabase
      .from('user_content_preferences')
      .select('preferred_time, timezone, morning_briefing_enabled')
      .eq('user_email', email)
      .single();

    // user_travel_context - set by location API
    const { data: travelData } = await supabase
      .from('user_travel_context')
      .select('estimated_location, current_timezone, timezone_offset_change')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // user_device_context - set by location API
    const { data: deviceData } = await supabase
      .from('user_device_context')
      .select('timezone, locale')
      .eq('email', email)
      .single();

    // Check recent insights
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentInsights, count: insightCount } = await supabase
      .from('real_time_insights')
      .select('id, insight_type, title, created_at', { count: 'exact' })
      .eq('email', email)
      .gte('created_at', threeDaysAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      email,
      insights: {
        recentCount: insightCount || 0,
        recent: (recentInsights || []).map((i: any) => ({
          type: i.insight_type,
          title: i.title?.substring(0, 50),
          created: i.created_at,
        })),
      },
      slack: slackData?.[0] ? {
        exists: true,
        analyzedAt: slackData[0].analyzed_at,
        pendingTasks: slackData[0].pending_tasks?.length || 0,
        responseDebt: slackData[0].response_debt?.count || 0,
      } : { exists: false },
      gmail: gmailData?.[0] ? {
        exists: true,
        analyzedAt: gmailData[0].analyzed_at,
        pendingTasks: gmailData[0].pending_tasks?.length || 0,
        responseDebt: gmailData[0].response_debt?.count || 0,
      } : { exists: false },
      linear: { count: linearCount || 0 },
      notion: { count: notionCount || 0 },
      timezone: {
        preferences: prefData ? {
          preferred_time: prefData.preferred_time,
          timezone: prefData.timezone,
          morning_briefing_enabled: prefData.morning_briefing_enabled,
        } : null,
        travel: travelData ? {
          location: travelData.estimated_location,
          timezone: travelData.current_timezone,
          offset: travelData.timezone_offset,
        } : null,
        device: deviceData ? {
          timezone: deviceData.timezone,
          locale: deviceData.locale,
        } : null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

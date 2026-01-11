/**
 * Debug endpoint to check what data exists for morning briefing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
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

    return NextResponse.json({
      email,
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
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

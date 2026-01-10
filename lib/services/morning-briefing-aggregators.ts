/**
 * Morning Briefing Aggregators
 *
 * Extracts actionable tasks from various platforms for morning briefings.
 * Pulls from existing data in deep_content_analysis, linear_issues, and notion_tasks.
 *
 * @module lib/services/morning-briefing-aggregators
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('MorningBriefingAggregators');

// ============================================================================
// TYPES
// ============================================================================

export interface PersonTasks {
  name: string;
  count: number;
  channels?: string[];
}

export interface SlackBriefingData {
  totalPending: number;
  byPerson: PersonTasks[];
  highPriority: Array<{
    description: string;
    requester?: string;
    urgency: string;
  }>;
}

export interface LinearBriefingData {
  urgentCount: number;
  highPriorityCount: number;
  overdueCount: number;
  issues: Array<{
    title: string;
    priority: number;
    dueDate?: string;
    project?: string;
    state?: string;
  }>;
}

export interface NotionBriefingData {
  dueToday: number;
  overdue: number;
  tasks: Array<{
    title: string;
    dueDate?: string;
    priority?: string;
    status?: string;
  }>;
}

export interface GmailBriefingData {
  needsResponse: number;
  highPriority: number;
  emails: Array<{
    from: string;
    summary: string;
    urgency: string;
  }>;
}

// ============================================================================
// SLACK AGGREGATOR
// ============================================================================

/**
 * Aggregate pending tasks and response debt from Slack
 * Pulls from deep_content_analysis table where source='slack'
 */
export async function aggregateSlackTasks(email: string): Promise<SlackBriefingData | null> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('deep_content_analysis')
      .select('pending_tasks, response_debt, key_people')
      .eq('user_email', email)
      .eq('source', 'slack')
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      logger.info('No Slack data found for briefing', { email });
      return null;
    }

    // Extract pending tasks
    const pendingTasks = (data.pending_tasks || []) as Array<{
      description?: string;
      requester?: string;
      urgency?: string;
      urgencyScore?: number;
    }>;

    // Extract response debt messages
    const responseDebt = (data.response_debt || {}) as {
      count?: number;
      messages?: Array<{ from?: string; summary?: string; urgency?: string }>;
    };

    // Extract key people
    const keyPeople = (data.key_people || []) as Array<{
      name?: string;
      messageCount?: number;
    }>;

    // Group tasks by requester
    const byPersonMap = new Map<string, number>();

    // Count from pending tasks
    for (const task of pendingTasks) {
      if (task.requester) {
        byPersonMap.set(task.requester, (byPersonMap.get(task.requester) || 0) + 1);
      }
    }

    // Add from response debt
    for (const msg of responseDebt.messages || []) {
      if (msg.from) {
        byPersonMap.set(msg.from, (byPersonMap.get(msg.from) || 0) + 1);
      }
    }

    // Convert to array sorted by count
    const byPerson: PersonTasks[] = Array.from(byPersonMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get high priority tasks
    const highPriority = pendingTasks
      .filter(t => t.urgency === 'critical' || t.urgency === 'high' || (t.urgencyScore && t.urgencyScore >= 70))
      .map(t => ({
        description: t.description || '',
        requester: t.requester,
        urgency: t.urgency || 'high',
      }))
      .slice(0, 5);

    const totalPending = pendingTasks.length + (responseDebt.count || 0);

    if (totalPending === 0 && byPerson.length === 0) {
      return null;
    }

    logger.info('Aggregated Slack tasks', {
      email,
      totalPending,
      byPersonCount: byPerson.length,
      highPriorityCount: highPriority.length,
    });

    return {
      totalPending,
      byPerson,
      highPriority,
    };
  } catch (error) {
    logger.error('Error aggregating Slack tasks', { error, email });
    return null;
  }
}

// ============================================================================
// LINEAR AGGREGATOR
// ============================================================================

/**
 * Aggregate urgent/high priority issues from Linear
 * Pulls from linear_issues table
 */
export async function aggregateLinearTasks(email: string): Promise<LinearBriefingData | null> {
  const supabase = createAdminClient();

  try {
    // Get tomorrow's date for due date comparison
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    // Query all non-completed issues
    const { data, error } = await supabase
      .from('linear_issues')
      .select('linear_issue_id, title, state, priority, due_date, project_name')
      .eq('user_email', email)
      .not('state', 'in', '("Done","Canceled","Completed")');

    if (error) {
      logger.error('Error querying linear_issues', { error, email });
      return null;
    }

    if (!data || data.length === 0) {
      logger.info('No Linear issues found for briefing', { email });
      return null;
    }

    // Filter and count
    const now = new Date();
    let urgentCount = 0;
    let highPriorityCount = 0;
    let overdueCount = 0;

    const relevantIssues = data.filter(issue => {
      const isUrgent = issue.priority === 1; // 1 = Urgent in Linear
      const isHighPriority = issue.priority === 2; // 2 = High in Linear
      const isDueSoon = issue.due_date && new Date(issue.due_date) <= tomorrow;
      const isOverdue = issue.due_date && new Date(issue.due_date) < now;

      if (isUrgent) urgentCount++;
      if (isHighPriority) highPriorityCount++;
      if (isOverdue) overdueCount++;

      // Include if urgent, high priority, or due soon
      return isUrgent || isHighPriority || isDueSoon;
    });

    if (relevantIssues.length === 0) {
      return null;
    }

    // Sort by priority then due date
    const sortedIssues = relevantIssues
      .sort((a, b) => {
        // Lower priority number = more urgent
        const priorityDiff = (a.priority || 99) - (b.priority || 99);
        if (priorityDiff !== 0) return priorityDiff;

        // Earlier due date first
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return a.due_date ? -1 : 1;
      })
      .slice(0, 5)
      .map(issue => ({
        title: issue.title,
        priority: issue.priority || 4,
        dueDate: issue.due_date,
        project: issue.project_name,
        state: issue.state,
      }));

    logger.info('Aggregated Linear issues', {
      email,
      urgentCount,
      highPriorityCount,
      overdueCount,
      total: relevantIssues.length,
    });

    return {
      urgentCount,
      highPriorityCount,
      overdueCount,
      issues: sortedIssues,
    };
  } catch (error) {
    logger.error('Error aggregating Linear tasks', { error, email });
    return null;
  }
}

// ============================================================================
// NOTION AGGREGATOR
// ============================================================================

/**
 * Aggregate tasks due today/overdue from Notion
 * Pulls from notion_tasks table
 */
export async function aggregateNotionTasks(email: string): Promise<NotionBriefingData | null> {
  const supabase = createAdminClient();

  try {
    // Get today's end time
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Query non-completed tasks
    const { data, error } = await supabase
      .from('notion_tasks')
      .select('notion_page_id, title, status, due_date, priority')
      .eq('user_email', email)
      .not('status', 'ilike', '%done%')
      .not('status', 'ilike', '%complete%')
      .not('status', 'ilike', '%finished%');

    if (error) {
      logger.error('Error querying notion_tasks', { error, email });
      return null;
    }

    if (!data || data.length === 0) {
      logger.info('No Notion tasks found for briefing', { email });
      return null;
    }

    // Filter by due date
    const now = new Date();
    let dueToday = 0;
    let overdue = 0;

    const relevantTasks = data.filter(task => {
      if (!task.due_date) return false;

      const dueDate = new Date(task.due_date);
      const isDueToday = dueDate <= todayEnd && dueDate >= new Date(now.setHours(0, 0, 0, 0));
      const isOverdue = dueDate < now;

      if (isDueToday) dueToday++;
      if (isOverdue) overdue++;

      return isDueToday || isOverdue;
    });

    if (relevantTasks.length === 0) {
      return null;
    }

    // Sort by due date (oldest/most overdue first)
    const sortedTasks = relevantTasks
      .sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return a.due_date ? -1 : 1;
      })
      .slice(0, 5)
      .map(task => ({
        title: task.title,
        dueDate: task.due_date,
        priority: task.priority,
        status: task.status,
      }));

    logger.info('Aggregated Notion tasks', {
      email,
      dueToday,
      overdue,
      total: relevantTasks.length,
    });

    return {
      dueToday,
      overdue,
      tasks: sortedTasks,
    };
  } catch (error) {
    logger.error('Error aggregating Notion tasks', { error, email });
    return null;
  }
}

// ============================================================================
// GMAIL AGGREGATOR
// ============================================================================

/**
 * Aggregate emails needing response from Gmail
 * Pulls from deep_content_analysis table where source='gmail'
 */
export async function aggregateGmailTasks(email: string): Promise<GmailBriefingData | null> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('deep_content_analysis')
      .select('pending_tasks, response_debt')
      .eq('user_email', email)
      .eq('source', 'gmail')
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      logger.info('No Gmail data found for briefing', { email });
      return null;
    }

    // Extract response debt
    const responseDebt = (data.response_debt || {}) as {
      count?: number;
      highPriorityCount?: number;
      messages?: Array<{ from?: string; summary?: string; urgency?: string }>;
    };

    // Extract pending tasks
    const pendingTasks = (data.pending_tasks || []) as Array<{
      description?: string;
      requester?: string;
      urgency?: string;
      urgencyScore?: number;
    }>;

    const needsResponse = responseDebt.count || 0;

    // Count high priority from both sources
    const highPriorityFromDebt = responseDebt.highPriorityCount || 0;
    const highPriorityFromTasks = pendingTasks.filter(
      t => t.urgency === 'critical' || t.urgency === 'high' || (t.urgencyScore && t.urgencyScore >= 70)
    ).length;
    const highPriority = Math.max(highPriorityFromDebt, highPriorityFromTasks);

    // Combine emails from response debt
    const emails = (responseDebt.messages || [])
      .slice(0, 5)
      .map(msg => ({
        from: msg.from || 'Unknown',
        summary: msg.summary || '',
        urgency: msg.urgency || 'medium',
      }));

    if (needsResponse === 0 && emails.length === 0) {
      return null;
    }

    logger.info('Aggregated Gmail tasks', {
      email,
      needsResponse,
      highPriority,
      emailCount: emails.length,
    });

    return {
      needsResponse,
      highPriority,
      emails,
    };
  } catch (error) {
    logger.error('Error aggregating Gmail tasks', { error, email });
    return null;
  }
}

// ============================================================================
// COMBINED AGGREGATOR
// ============================================================================

export interface AllBriefingData {
  slack: SlackBriefingData | null;
  linear: LinearBriefingData | null;
  notion: NotionBriefingData | null;
  gmail: GmailBriefingData | null;
  totals: {
    actionItems: number;
    urgentItems: number;
  };
}

/**
 * Aggregate all platform data in parallel
 */
export async function aggregateAllPlatforms(email: string): Promise<AllBriefingData> {
  const [slack, linear, notion, gmail] = await Promise.all([
    aggregateSlackTasks(email),
    aggregateLinearTasks(email),
    aggregateNotionTasks(email),
    aggregateGmailTasks(email),
  ]);

  // Calculate totals
  let actionItems = 0;
  let urgentItems = 0;

  if (slack) {
    actionItems += slack.totalPending;
    urgentItems += slack.highPriority.length;
  }

  if (linear) {
    actionItems += linear.urgentCount + linear.highPriorityCount;
    urgentItems += linear.urgentCount;
  }

  if (notion) {
    actionItems += notion.dueToday + notion.overdue;
    urgentItems += notion.overdue;
  }

  if (gmail) {
    actionItems += gmail.needsResponse;
    urgentItems += gmail.highPriority;
  }

  logger.info('Aggregated all platform data', {
    email,
    hasSlack: !!slack,
    hasLinear: !!linear,
    hasNotion: !!notion,
    hasGmail: !!gmail,
    actionItems,
    urgentItems,
  });

  return {
    slack,
    linear,
    notion,
    gmail,
    totals: {
      actionItems,
      urgentItems,
    },
  };
}

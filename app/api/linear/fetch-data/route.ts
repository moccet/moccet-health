import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const maxDuration = 60;

// Types for Linear GraphQL responses
interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number; // 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
  priorityLabel: string;
  state: {
    id: string;
    name: string;
    type: string; // backlog, unstarted, started, completed, canceled
  };
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  project?: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  labels: {
    nodes: Array<{
      id: string;
      name: string;
    }>;
  };
  comments: {
    nodes: Array<{
      id: string;
      body: string;
      createdAt: string;
      user?: {
        name: string;
      };
    }>;
  };
  cycle?: {
    id: string;
    name?: string;
    number: number;
    startsAt: string;
    endsAt: string;
  };
}

interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  targetDate?: string;
  startedAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Linear Fetch] Starting data fetch for ${email}`);

    // Get the stored token
    const tokenResult = await getToken(email, 'linear');
    if (!tokenResult.success || !tokenResult.token) {
      return NextResponse.json(
        { error: 'Linear not connected' },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = tokenResult.token.accessToken;
    const orgName = tokenResult.token.metadata?.organization_name || 'Linear';

    // Helper function for GraphQL queries
    async function linearGraphQL(query: string, variables?: Record<string, unknown>) {
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`Linear API error: ${response.status}`);
      }

      return response.json();
    }

    // 1. Fetch issues assigned to the user
    console.log('[Linear Fetch] Fetching assigned issues...');
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const issuesQuery = `
      query AssignedIssues($after: String) {
        viewer {
          assignedIssues(
            first: 100
            after: $after
            filter: {
              updatedAt: { gte: "${ninetyDaysAgo}" }
            }
            orderBy: updatedAt
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              title
              description
              priority
              priorityLabel
              state {
                id
                name
                type
              }
              dueDate
              createdAt
              updatedAt
              url
              project {
                id
                name
              }
              team {
                id
                name
                key
              }
              assignee {
                id
                name
                email
              }
              labels {
                nodes {
                  id
                  name
                }
              }
              comments(first: 10) {
                nodes {
                  id
                  body
                  createdAt
                  user {
                    name
                  }
                }
              }
              cycle {
                id
                name
                number
                startsAt
                endsAt
              }
            }
          }
        }
      }
    `;

    const allIssues: LinearIssue[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage && allIssues.length < 500) {
      const result = await linearGraphQL(issuesQuery, { after: cursor });
      const issues = result?.data?.viewer?.assignedIssues;

      if (issues?.nodes) {
        allIssues.push(...issues.nodes);
      }

      hasNextPage = issues?.pageInfo?.hasNextPage || false;
      cursor = issues?.pageInfo?.endCursor || null;
    }

    console.log(`[Linear Fetch] Found ${allIssues.length} assigned issues`);

    // 2. Fetch projects
    console.log('[Linear Fetch] Fetching projects...');
    const projectsQuery = `
      query Projects {
        projects(first: 50, orderBy: updatedAt) {
          nodes {
            id
            name
            description
            state
            progress
            targetDate
            startedAt
          }
        }
      }
    `;

    const projectsResult = await linearGraphQL(projectsQuery);
    const projects: LinearProject[] = projectsResult?.data?.projects?.nodes || [];
    console.log(`[Linear Fetch] Found ${projects.length} projects`);

    // 3. Store issues in database
    const supabase = createAdminClient();

    for (const issue of allIssues) {
      const { error } = await supabase.from('linear_issues').upsert({
        user_email: email,
        linear_issue_id: issue.id,
        title: issue.title,
        description: issue.description?.substring(0, 2000) || null,
        state: issue.state?.name,
        priority: issue.priority,
        due_date: issue.dueDate ? new Date(issue.dueDate).toISOString() : null,
        project_name: issue.project?.name || null,
        team_name: issue.team?.name || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_email,linear_issue_id' });

      if (error) {
        console.error('[Linear Fetch] Error storing issue:', error);
      }
    }

    // 4. Calculate stats
    const openIssues = allIssues.filter(i =>
      ['backlog', 'unstarted', 'started'].includes(i.state?.type || '')
    );
    const urgentIssues = allIssues.filter(i => i.priority === 1);
    const highPriorityIssues = allIssues.filter(i => i.priority === 2);
    const overdueIssues = allIssues.filter(i => {
      if (!i.dueDate) return false;
      const stateType = i.state?.type || '';
      if (['completed', 'canceled'].includes(stateType)) return false;
      return new Date(i.dueDate) < new Date();
    });
    const dueSoonIssues = allIssues.filter(i => {
      if (!i.dueDate) return false;
      const stateType = i.state?.type || '';
      if (['completed', 'canceled'].includes(stateType)) return false;
      const due = new Date(i.dueDate);
      const now = new Date();
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return due >= now && due <= threeDays;
    });

    // 5. Store behavioral patterns
    const behavioralData = {
      linear_overview: {
        organization: orgName,
        total_issues: allIssues.length,
        open_issues: openIssues.length,
        urgent_issues: urgentIssues.length,
        high_priority_issues: highPriorityIssues.length,
        overdue_issues: overdueIssues.length,
        due_soon_issues: dueSoonIssues.length,
        total_projects: projects.length,
      },
      linear_issues: allIssues.slice(0, 50).map(i => ({
        identifier: i.identifier,
        title: i.title,
        state: i.state?.name,
        stateType: i.state?.type,
        priority: i.priorityLabel,
        dueDate: i.dueDate,
        project: i.project?.name,
        team: i.team?.name,
        updatedAt: i.updatedAt,
        labels: i.labels?.nodes?.map(l => l.name) || [],
        hasComments: (i.comments?.nodes?.length || 0) > 0,
        inCycle: !!i.cycle,
      })),
      linear_projects: projects.slice(0, 20).map(p => ({
        name: p.name,
        state: p.state,
        progress: p.progress,
        targetDate: p.targetDate,
      })),
      linear_urgency_breakdown: {
        urgent: urgentIssues.length,
        high: highPriorityIssues.length,
        medium: allIssues.filter(i => i.priority === 3).length,
        low: allIssues.filter(i => i.priority === 4).length,
        none: allIssues.filter(i => i.priority === 0).length,
      },
    };

    const { error: behavioralError } = await supabase.from('behavioral_patterns').upsert({
      user_email: email,
      source: 'linear',
      data: behavioralData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,source' });

    if (behavioralError) {
      console.error('[Linear Fetch] Error storing behavioral patterns:', behavioralError);
    }

    console.log(`[Linear Fetch] Completed for ${email}`);

    return NextResponse.json({
      success: true,
      organization: orgName,
      totalIssues: allIssues.length,
      openIssues: openIssues.length,
      urgentIssues: urgentIssues.length,
      overdueIssues: overdueIssues.length,
      projects: projects.length,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Linear Fetch] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Linear data' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

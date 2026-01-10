import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const maxDuration = 60;

// Types for Notion API responses
interface NotionDatabase {
  id: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, { type: string; name?: string }>;
  last_edited_time: string;
  url: string;
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
  created_time: string;
  last_edited_time: string;
  url: string;
  parent: { type: string; database_id?: string };
}

interface NotionProperty {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  select?: { name: string };
  multi_select?: Array<{ name: string }>;
  date?: { start: string; end?: string };
  people?: Array<{ name?: string; id: string }>;
  checkbox?: boolean;
  number?: number;
  status?: { name: string };
  url?: string;
  email?: string;
}

interface NotionTask {
  pageId: string;
  databaseId?: string;
  databaseName?: string;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assignees: string[];
  tags: string[];
  lastEdited: string;
  url: string;
  properties: Record<string, unknown>;
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

    console.log(`[Notion Fetch] Starting data fetch for ${email}`);

    // Get the stored token
    const tokenResult = await getToken(email, 'notion');
    if (!tokenResult.success || !tokenResult.token) {
      return NextResponse.json(
        { error: 'Notion not connected' },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = tokenResult.token.accessToken;
    const workspaceName = tokenResult.token.metadata?.workspace_name || 'Notion';

    // Notion API headers
    const notionHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    // 1. Search for all databases
    console.log('[Notion Fetch] Searching for databases...');
    const searchResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        page_size: 100,
      }),
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('[Notion Fetch] Search error:', errorData);
      return NextResponse.json(
        { error: 'Failed to search Notion' },
        { status: searchResponse.status, headers: corsHeaders }
      );
    }

    const searchData = await searchResponse.json();
    const databases: NotionDatabase[] = searchData.results || [];
    console.log(`[Notion Fetch] Found ${databases.length} databases`);

    // 2. For each database, query for tasks/items
    const allTasks: NotionTask[] = [];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    for (const db of databases.slice(0, 20)) { // Limit to 20 databases
      const dbTitle = db.title?.[0]?.plain_text || 'Untitled Database';
      console.log(`[Notion Fetch] Querying database: ${dbTitle}`);

      try {
        // Query database for items edited in last 90 days
        const queryResponse = await fetch(`https://api.notion.com/v1/databases/${db.id}/query`, {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            filter: {
              timestamp: 'last_edited_time',
              last_edited_time: { on_or_after: ninetyDaysAgo },
            },
            page_size: 100,
            sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
          }),
        });

        if (!queryResponse.ok) {
          console.log(`[Notion Fetch] Could not query database ${dbTitle}`);
          continue;
        }

        const queryData = await queryResponse.json();
        const pages: NotionPage[] = queryData.results || [];

        for (const page of pages) {
          const task = extractTaskFromPage(page, db.id, dbTitle);
          if (task) {
            allTasks.push(task);
          }
        }
      } catch (dbError) {
        console.error(`[Notion Fetch] Error querying database ${dbTitle}:`, dbError);
      }
    }

    console.log(`[Notion Fetch] Extracted ${allTasks.length} tasks from databases`);

    // 3. Also search for standalone pages (not in databases)
    console.log('[Notion Fetch] Searching for standalone pages...');
    const pagesResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        filter: { property: 'object', value: 'page' },
        page_size: 50,
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
      }),
    });

    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();
      const pages: NotionPage[] = pagesData.results || [];

      for (const page of pages) {
        // Skip pages that are part of a database (already processed)
        if (page.parent?.type === 'database_id') continue;

        const task = extractTaskFromPage(page, undefined, undefined);
        if (task) {
          allTasks.push(task);
        }
      }
    }

    console.log(`[Notion Fetch] Total tasks: ${allTasks.length}`);

    // 4. Analyze tasks for urgency and priority using AI
    const analyzedTasks = await analyzeNotionTasks(allTasks);

    // 5. Store tasks in database
    const supabase = createAdminClient();

    // Store individual tasks
    for (const task of analyzedTasks) {
      const { error } = await supabase.from('notion_tasks').upsert({
        user_email: email,
        notion_page_id: task.pageId,
        database_id: task.databaseId,
        title: task.title,
        status: task.status,
        due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
        assignee: task.assignees.join(', ') || null,
        priority: task.priority,
        last_edited: task.lastEdited,
        raw_properties: task.properties,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_email,notion_page_id' });

      if (error) {
        console.error('[Notion Fetch] Error storing task:', error);
      }
    }

    // 6. Store behavioral patterns for insight generation
    const behavioralData = {
      notion_overview: {
        workspace: workspaceName,
        total_databases: databases.length,
        total_tasks: allTasks.length,
        open_tasks: allTasks.filter(t => !isTaskComplete(t.status)).length,
        overdue_tasks: allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !isTaskComplete(t.status)).length,
        tasks_due_soon: allTasks.filter(t => {
          if (!t.dueDate || isTaskComplete(t.status)) return false;
          const due = new Date(t.dueDate);
          const now = new Date();
          const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          return due >= now && due <= threeDays;
        }).length,
      },
      notion_tasks: analyzedTasks.slice(0, 50).map(t => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        database: t.databaseName,
        lastEdited: t.lastEdited,
      })),
      notion_databases: databases.slice(0, 10).map(db => ({
        name: db.title?.[0]?.plain_text || 'Untitled',
        lastEdited: db.last_edited_time,
      })),
    };

    const { error: behavioralError } = await supabase.from('behavioral_patterns').upsert({
      user_email: email,
      source: 'notion',
      data: behavioralData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,source' });

    if (behavioralError) {
      console.error('[Notion Fetch] Error storing behavioral patterns:', behavioralError);
    }

    console.log(`[Notion Fetch] Completed for ${email}`);

    return NextResponse.json({
      success: true,
      workspace: workspaceName,
      databases: databases.length,
      tasks: allTasks.length,
      openTasks: behavioralData.notion_overview.open_tasks,
      overdueTasks: behavioralData.notion_overview.overdue_tasks,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Notion Fetch] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Notion data' },
      { status: 500, headers: corsHeaders }
    );
  }
}

function extractTaskFromPage(
  page: NotionPage,
  databaseId: string | undefined,
  databaseName: string | undefined
): NotionTask | null {
  const props = page.properties;

  // Find title property
  let title = '';
  for (const [, value] of Object.entries(props)) {
    if (value.type === 'title' && value.title?.[0]?.plain_text) {
      title = value.title.map(t => t.plain_text).join('');
      break;
    }
  }

  if (!title) return null;

  // Extract common properties
  let status: string | undefined;
  let priority: string | undefined;
  let dueDate: string | undefined;
  const assignees: string[] = [];
  const tags: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    const keyLower = key.toLowerCase();

    // Status
    if (keyLower.includes('status') || keyLower === 'state') {
      if (value.type === 'status' && value.status?.name) {
        status = value.status.name;
      } else if (value.type === 'select' && value.select?.name) {
        status = value.select.name;
      }
    }

    // Priority
    if (keyLower.includes('priority')) {
      if (value.type === 'select' && value.select?.name) {
        priority = value.select.name;
      } else if (value.type === 'multi_select' && value.multi_select?.[0]?.name) {
        priority = value.multi_select[0].name;
      }
    }

    // Due date
    if (keyLower.includes('due') || keyLower.includes('date') || keyLower === 'deadline') {
      if (value.type === 'date' && value.date?.start) {
        dueDate = value.date.start;
      }
    }

    // Assignees
    if (keyLower.includes('assign') || keyLower.includes('owner') || keyLower === 'person') {
      if (value.type === 'people' && value.people) {
        for (const person of value.people) {
          if (person.name) {
            assignees.push(person.name);
          }
        }
      }
    }

    // Tags
    if (keyLower.includes('tag') || keyLower.includes('label') || keyLower === 'category') {
      if (value.type === 'multi_select' && value.multi_select) {
        for (const tag of value.multi_select) {
          tags.push(tag.name);
        }
      } else if (value.type === 'select' && value.select?.name) {
        tags.push(value.select.name);
      }
    }
  }

  return {
    pageId: page.id,
    databaseId,
    databaseName,
    title,
    status,
    priority,
    dueDate,
    assignees,
    tags,
    lastEdited: page.last_edited_time,
    url: page.url,
    properties: props as Record<string, unknown>,
  };
}

function isTaskComplete(status: string | undefined): boolean {
  if (!status) return false;
  const completedStatuses = ['done', 'complete', 'completed', 'finished', 'closed', 'archived'];
  return completedStatuses.includes(status.toLowerCase());
}

async function analyzeNotionTasks(tasks: NotionTask[]): Promise<NotionTask[]> {
  if (tasks.length === 0) return tasks;

  // For tasks without priority, use AI to infer priority
  const tasksWithoutPriority = tasks.filter(t => !t.priority && !isTaskComplete(t.status));

  if (tasksWithoutPriority.length === 0) return tasks;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a task prioritization assistant. Given a list of tasks from Notion, infer their priority level based on:
- Task title and context
- Due date (if provided)
- Status

Return a JSON object mapping task IDs to priority levels: "critical", "high", "medium", or "low".

Example output:
{ "task_id_1": "high", "task_id_2": "medium" }`,
        },
        {
          role: 'user',
          content: `Prioritize these tasks:\n${JSON.stringify(
            tasksWithoutPriority.slice(0, 30).map(t => ({
              id: t.pageId,
              title: t.title,
              status: t.status,
              dueDate: t.dueDate,
              database: t.databaseName,
            })),
            null,
            2
          )}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const priorities = JSON.parse(content) as Record<string, string>;

    // Apply inferred priorities
    for (const task of tasks) {
      if (!task.priority && priorities[task.pageId]) {
        task.priority = priorities[task.pageId];
      }
    }
  } catch (error) {
    console.error('[Notion Fetch] Priority analysis error:', error);
  }

  return tasks;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * Auto-Create Agent Tasks from Insights
 *
 * This endpoint evaluates insights and automatically creates agent tasks
 * for actionable recommendations. Low-risk tasks are auto-executed,
 * high-risk tasks await user approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

interface InsightForTask {
  id: string;
  title: string;
  finding: string;
  actionableRecommendation: string;
  designCategory: string;
  impact: string;
  sources: string[];
}

interface TaskTemplate {
  type: 'calendar' | 'spotify' | 'supplement' | 'health_booking' | 'shopping';
  title: string;
  description: string;
  params: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  canAutoExecute: boolean;
}

// Keywords that map insights to specific agent types
const TASK_TRIGGERS = {
  calendar: [
    'schedule', 'block time', 'calendar', 'meeting', 'walk', 'exercise',
    'workout', 'focus time', 'deep work', 'recovery day', 'break'
  ],
  spotify: [
    'music', 'playlist', 'focus music', 'relaxation', 'meditation',
    'wind down', 'energy', 'motivation', 'workout music'
  ],
  supplement: [
    'supplement', 'vitamin', 'magnesium', 'omega', 'deficiency',
    'biomarker', 'blood work', 'nutrient'
  ],
  health_booking: [
    'appointment', 'doctor', 'checkup', 'specialist', 'lab test',
    'blood test', 'screening'
  ]
};

function determineTaskType(insight: InsightForTask): TaskTemplate | null {
  const text = `${insight.title} ${insight.finding} ${insight.actionableRecommendation}`.toLowerCase();

  // Check for calendar-related actions
  for (const keyword of TASK_TRIGGERS.calendar) {
    if (text.includes(keyword)) {
      return {
        type: 'calendar',
        title: `Schedule: ${insight.title}`,
        description: insight.actionableRecommendation,
        params: {
          eventType: text.includes('walk') ? 'walk' :
                     text.includes('workout') ? 'workout' :
                     text.includes('focus') ? 'focus_time' :
                     text.includes('recovery') ? 'recovery' : 'health_block',
          duration: 30, // Default 30 minutes
          preferredTime: extractTimeFromText(text),
          recurring: text.includes('daily') || text.includes('every day')
        },
        riskLevel: 'low',
        canAutoExecute: false // Calendar still needs approval
      };
    }
  }

  // Check for Spotify-related actions
  for (const keyword of TASK_TRIGGERS.spotify) {
    if (text.includes(keyword)) {
      return {
        type: 'spotify',
        title: `Create Playlist: ${insight.title}`,
        description: insight.actionableRecommendation,
        params: {
          mood: text.includes('focus') ? 'focus' :
                text.includes('relax') ? 'relaxation' :
                text.includes('energy') ? 'energizing' :
                text.includes('sleep') ? 'sleep' : 'wellness',
          duration: 60 // 1 hour playlist
        },
        riskLevel: 'low',
        canAutoExecute: true // Spotify can auto-execute
      };
    }
  }

  // Check for supplement recommendations
  for (const keyword of TASK_TRIGGERS.supplement) {
    if (text.includes(keyword)) {
      return {
        type: 'supplement',
        title: `Supplement Recommendation: ${insight.title}`,
        description: insight.actionableRecommendation,
        params: {
          basedOn: insight.sources,
          insightId: insight.id
        },
        riskLevel: 'medium',
        canAutoExecute: false
      };
    }
  }

  // Check for health booking
  for (const keyword of TASK_TRIGGERS.health_booking) {
    if (text.includes(keyword)) {
      return {
        type: 'health_booking',
        title: `Book: ${insight.title}`,
        description: insight.actionableRecommendation,
        params: {
          appointmentType: text.includes('blood') ? 'lab_test' :
                          text.includes('specialist') ? 'specialist' : 'checkup'
        },
        riskLevel: 'high',
        canAutoExecute: false
      };
    }
  }

  return null;
}

function extractTimeFromText(text: string): string | null {
  // Look for time patterns like "at 3pm", "10am", "morning", "afternoon"
  const timeMatch = text.match(/(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    return `${timeMatch[1]}:00 ${timeMatch[2].toUpperCase()}`;
  }

  if (text.includes('morning')) return '09:00 AM';
  if (text.includes('afternoon')) return '14:00 PM';
  if (text.includes('evening')) return '18:00 PM';
  if (text.includes('post-lunch') || text.includes('after lunch')) return '13:00 PM';

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, insights } = body;

    if (!email || !insights || !Array.isArray(insights)) {
      return NextResponse.json(
        { error: 'Missing email or insights array' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const createdTasks: any[] = [];
    const skippedInsights: string[] = [];

    for (const insight of insights) {
      const taskTemplate = determineTaskType(insight);

      if (!taskTemplate) {
        skippedInsights.push(insight.id);
        continue;
      }

      // Check if task already exists for this insight
      const { data: existingTask } = await supabase
        .from('agent_tasks')
        .select('id')
        .eq('source_insight_id', insight.id)
        .eq('user_email', email)
        .maybeSingle();

      if (existingTask) {
        console.log(`[AUTO-CREATE] Task already exists for insight ${insight.id}`);
        continue;
      }

      // Create the task
      const taskId = uuidv4();
      const now = new Date().toISOString();

      const taskData = {
        id: taskId,
        user_email: email,
        type: taskTemplate.type,
        title: taskTemplate.title,
        description: taskTemplate.description,
        status: taskTemplate.canAutoExecute ? 'pending' : 'awaiting_approval',
        source_insight_id: insight.id,
        params: taskTemplate.params,
        risk_level: taskTemplate.riskLevel,
        can_auto_execute: taskTemplate.canAutoExecute,
        auto_created: true,
        analyzing: insight.sources || [],
        using_services: [taskTemplate.type],
        steps: generateSteps(taskTemplate.type),
        created_at: now,
        planning_status: 'not_started'
      };

      const { data: newTask, error } = await supabase
        .from('agent_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error(`[AUTO-CREATE] Failed to create task:`, error);
        continue;
      }

      createdTasks.push(newTask);
      console.log(`[AUTO-CREATE] Created ${taskTemplate.type} task: ${taskId} from insight ${insight.id}`);

      // If task can auto-execute, trigger execution via QStash
      if (taskTemplate.canAutoExecute) {
        await triggerAutoExecution(taskId, email);
      }
    }

    return NextResponse.json({
      success: true,
      created: createdTasks.length,
      skipped: skippedInsights.length,
      tasks: createdTasks.map(t => ({ id: t.id, type: t.type, title: t.title, status: t.status }))
    });

  } catch (error) {
    console.error('[AUTO-CREATE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-create tasks' },
      { status: 500 }
    );
  }
}

function generateSteps(type: string) {
  switch (type) {
    case 'calendar':
      return [
        { id: '1', title: 'Check calendar availability', status: 'pending' },
        { id: '2', title: 'Find optimal time slot', status: 'pending' },
        { id: '3', title: 'Create calendar event', status: 'pending' }
      ];
    case 'spotify':
      return [
        { id: '1', title: 'Analyze mood and preferences', status: 'pending' },
        { id: '2', title: 'Select matching tracks', status: 'pending' },
        { id: '3', title: 'Create playlist', status: 'pending' }
      ];
    case 'supplement':
      return [
        { id: '1', title: 'Analyze biomarkers', status: 'pending' },
        { id: '2', title: 'Match supplements to needs', status: 'pending' },
        { id: '3', title: 'Generate recommendations', status: 'pending' }
      ];
    case 'health_booking':
      return [
        { id: '1', title: 'Check insurance coverage', status: 'pending' },
        { id: '2', title: 'Find available appointments', status: 'pending' },
        { id: '3', title: 'Book appointment', status: 'pending' }
      ];
    default:
      return [
        { id: '1', title: 'Analyze data', status: 'pending' },
        { id: '2', title: 'Execute action', status: 'pending' }
      ];
  }
}

async function triggerAutoExecution(taskId: string, email: string) {
  // If QStash is configured, use it for background execution
  const qstashToken = process.env.QSTASH_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';

  if (qstashToken) {
    try {
      const response = await fetch('https://qstash.upstash.io/v2/publish/' +
        encodeURIComponent(`${baseUrl}/api/agent/execute`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${qstashToken}`,
          'Content-Type': 'application/json',
          'Upstash-Delay': '5s' // Small delay to ensure task is committed
        },
        body: JSON.stringify({ taskId, email })
      });

      if (response.ok) {
        console.log(`[AUTO-CREATE] Queued auto-execution for task ${taskId}`);
      }
    } catch (error) {
      console.error('[AUTO-CREATE] Failed to queue execution:', error);
    }
  } else {
    // Fallback: Direct execution (synchronous)
    console.log(`[AUTO-CREATE] QStash not configured, task ${taskId} awaits manual execution`);
  }
}

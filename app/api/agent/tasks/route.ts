import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type TaskStatus = 'pending' | 'analyzing' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface TaskStep {
  id: string;
  description: string;
  detail?: string;
  status: StepStatus;
  completedAt?: string;
}

export interface AgentTask {
  id: string;
  user_email: string;
  type: string;
  title: string;
  description: string;
  status: TaskStatus;
  analyzing: string[];
  using_services: string[];
  steps: TaskStep[];
  params: Record<string, any>;
  result?: Record<string, any>;
  source_insight_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// GET - Fetch user's tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status'); // Optional filter
    const taskId = searchParams.get('taskId'); // Get specific task

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get specific task
    if (taskId) {
      const { data: task, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_email', email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching task:', error);
        return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
      }

      if (!task) {
        return NextResponse.json({ error: 'Task not found', task: null }, { status: 200 });
      }

      return NextResponse.json({ task });
    }

    // Get all tasks for user
    let query = supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tasks, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    // Group tasks by status for frontend convenience
    const grouped = {
      suggested: tasks?.filter(t => t.status === 'pending') || [],
      active: tasks?.filter(t => ['analyzing', 'awaiting_approval', 'executing'].includes(t.status)) || [],
      completed: tasks?.filter(t => ['completed', 'failed'].includes(t.status)) || [],
    };

    return NextResponse.json({ tasks, grouped });
  } catch (error) {
    console.error('Error in GET /api/agent/tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, type, title, description, params, sourceInsightId } = body;

    if (!email || !type || !title) {
      return NextResponse.json(
        { error: 'Email, type, and title are required' },
        { status: 400 }
      );
    }

    // Define steps and analyzing/using based on task type
    const taskConfig = getTaskConfig(type, params);

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newTask: Partial<AgentTask> = {
      id: taskId,
      user_email: email,
      type,
      title,
      description: description || taskConfig.defaultDescription,
      status: 'pending',
      analyzing: taskConfig.analyzing,
      using_services: taskConfig.using,
      steps: taskConfig.steps,
      params: params || {},
      source_insight_id: sourceInsightId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: task, error } = await supabase
      .from('agent_tasks')
      .insert(newTask)
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({ task, message: 'Task created successfully' });
  } catch (error) {
    console.error('Error in POST /api/agent/tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update task status or approve/reject
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, email, action, stepId } = body;

    if (!taskId || !email) {
      return NextResponse.json(
        { error: 'Task ID and email are required' },
        { status: 400 }
      );
    }

    // Fetch current task
    const { data: task, error: fetchError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_email', email)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    let updates: Partial<AgentTask> = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'start':
        // Start analyzing the task
        updates.status = 'analyzing';
        break;

      case 'approve':
        // User approved, start execution
        updates.status = 'executing';
        break;

      case 'reject':
        // User rejected
        updates.status = 'failed';
        updates.result = { reason: 'User rejected the task' };
        updates.completed_at = new Date().toISOString();
        break;

      case 'complete_step':
        // Mark a step as completed
        if (stepId) {
          const steps = task.steps.map((s: TaskStep) =>
            s.id === stepId
              ? { ...s, status: 'completed', completedAt: new Date().toISOString() }
              : s
          );
          updates.steps = steps;

          // Check if all steps completed
          const allCompleted = steps.every((s: TaskStep) => s.status === 'completed');
          if (allCompleted) {
            updates.status = 'completed';
            updates.completed_at = new Date().toISOString();
          }
        }
        break;

      case 'await_approval':
        // Task analyzed, waiting for user approval
        updates.status = 'awaiting_approval';
        break;

      case 'complete':
        // Task completed successfully
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
        if (body.result) {
          updates.result = body.result;
        }
        break;

      case 'fail':
        // Task failed
        updates.status = 'failed';
        updates.completed_at = new Date().toISOString();
        if (body.error) {
          updates.result = { error: body.error };
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('agent_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error in PATCH /api/agent/tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to get task configuration based on type
function getTaskConfig(type: string, params?: Record<string, any>) {
  const configs: Record<string, {
    defaultDescription: string;
    analyzing: string[];
    using: string[];
    steps: TaskStep[];
  }> = {
    calendar: {
      defaultDescription: 'Schedule an event in your calendar',
      analyzing: ['calendar', 'availability', 'preferences'],
      using: ['Google Calendar', 'Oura Ring'],
      steps: [
        { id: 'step_1', description: 'Checking your calendar availability', status: 'pending' },
        { id: 'step_2', description: 'Finding optimal time slot', status: 'pending' },
        { id: 'step_3', description: 'Creating calendar event', status: 'pending' },
        { id: 'step_4', description: 'Confirming booking', status: 'pending' },
      ],
    },
    spotify: {
      defaultDescription: 'Create a personalized playlist',
      analyzing: ['mood', 'activity', 'music preferences'],
      using: ['Spotify', 'Health Data'],
      steps: [
        { id: 'step_1', description: 'Analyzing your current mood and activity', status: 'pending' },
        { id: 'step_2', description: 'Selecting tracks based on preferences', status: 'pending' },
        { id: 'step_3', description: 'Creating playlist', status: 'pending' },
        { id: 'step_4', description: 'Adding tracks to playlist', status: 'pending' },
      ],
    },
    supplement: {
      defaultDescription: 'Get personalized supplement recommendations',
      analyzing: ['blood work', 'deficiencies', 'health goals'],
      using: ['Blood Analysis', 'Supplement Database'],
      steps: [
        { id: 'step_1', description: 'Analyzing your biomarkers', status: 'pending' },
        { id: 'step_2', description: 'Identifying deficiencies', status: 'pending' },
        { id: 'step_3', description: 'Matching supplements to needs', status: 'pending' },
        { id: 'step_4', description: 'Preparing recommendations', status: 'pending' },
      ],
    },
    health_booking: {
      defaultDescription: 'Book a health appointment',
      analyzing: ['insurance', 'availability', 'calendar blocks', 'health records'],
      using: ['Health Insurance', 'Calendar', 'Clinic Directory'],
      steps: [
        { id: 'step_1', description: 'Verified insurance coverage', status: 'pending' },
        { id: 'step_2', description: 'Found gap in your schedule', status: 'pending' },
        { id: 'step_3', description: 'Sent health summary to provider', status: 'pending' },
        { id: 'step_4', description: 'Confirming appointment', status: 'pending' },
      ],
    },
  };

  return configs[type] || {
    defaultDescription: 'Execute task',
    analyzing: ['data'],
    using: ['moccet'],
    steps: [
      { id: 'step_1', description: 'Processing request', status: 'pending' },
      { id: 'step_2', description: 'Completing task', status: 'pending' },
    ],
  };
}

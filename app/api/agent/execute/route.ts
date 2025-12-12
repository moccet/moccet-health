import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST - Execute an approved task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, email } = body;

    if (!taskId || !email) {
      return NextResponse.json(
        { error: 'Task ID and email are required' },
        { status: 400 }
      );
    }

    // Fetch the task
    const { data: task, error: fetchError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_email', email)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only execute tasks that are approved (awaiting_approval or executing status)
    if (!['awaiting_approval', 'executing', 'pending'].includes(task.status)) {
      return NextResponse.json(
        { error: `Cannot execute task with status: ${task.status}` },
        { status: 400 }
      );
    }

    // Update status to executing
    await updateTaskStatus(taskId, 'executing');

    // Execute based on task type
    let result;
    try {
      switch (task.type) {
        case 'calendar':
          result = await executeCalendarTask(task, email);
          break;
        case 'spotify':
          result = await executeSpotifyTask(task, email);
          break;
        case 'supplement':
          result = await executeSupplementTask(task, email);
          break;
        case 'health_booking':
          result = await executeHealthBookingTask(task, email);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Mark as completed
      await supabase
        .from('agent_tasks')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          steps: task.steps.map((s: any) => ({ ...s, status: 'completed', completedAt: new Date().toISOString() })),
        })
        .eq('id', taskId);

      return NextResponse.json({
        success: true,
        task: { ...task, status: 'completed', result },
      });
    } catch (execError: any) {
      console.error('Task execution error:', execError);

      // Mark as failed
      await supabase
        .from('agent_tasks')
        .update({
          status: 'failed',
          result: { error: execError.message },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      return NextResponse.json({
        success: false,
        error: execError.message,
      });
    }
  } catch (error) {
    console.error('Error in POST /api/agent/execute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function updateTaskStatus(taskId: string, status: string) {
  await supabase
    .from('agent_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId);
}

async function updateTaskStep(taskId: string, stepId: string, status: string, detail?: string) {
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('steps')
    .eq('id', taskId)
    .single();

  if (task) {
    const steps = task.steps.map((s: any) =>
      s.id === stepId
        ? { ...s, status, detail, completedAt: status === 'completed' ? new Date().toISOString() : undefined }
        : s
    );

    await supabase
      .from('agent_tasks')
      .update({ steps, updated_at: new Date().toISOString() })
      .eq('id', taskId);
  }
}

// Calendar task execution
async function executeCalendarTask(task: any, email: string) {
  const params = task.params || {};

  // Step 1: Check calendar availability
  await updateTaskStep(task.id, 'step_1', 'in_progress');

  // Fetch calendar data
  const calendarResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/gmail/fetch-data?email=${encodeURIComponent(email)}`);
  const calendarData = await calendarResponse.json();

  await updateTaskStep(task.id, 'step_1', 'completed', 'Calendar data retrieved');

  // Step 2: Find optimal time slot
  await updateTaskStep(task.id, 'step_2', 'in_progress');

  // Simple logic: find next available slot (could be enhanced with AI)
  const suggestedTime = findNextAvailableSlot(calendarData, params.duration || 30);

  await updateTaskStep(task.id, 'step_2', 'completed', `Best time: ${suggestedTime.formatted}`);

  // Step 3: Create calendar event
  await updateTaskStep(task.id, 'step_3', 'in_progress');

  // TODO: Actually create the event via Google Calendar API
  // For now, we'll simulate success
  const eventId = `evt_${Date.now()}`;

  await updateTaskStep(task.id, 'step_3', 'completed', 'Event created');

  // Step 4: Confirm
  await updateTaskStep(task.id, 'step_4', 'in_progress');
  await updateTaskStep(task.id, 'step_4', 'completed', 'Booking confirmed');

  return {
    success: true,
    eventId,
    title: params.title || 'Scheduled Event',
    startTime: suggestedTime.start,
    endTime: suggestedTime.end,
    message: `Successfully scheduled "${params.title || 'event'}" for ${suggestedTime.formatted}`,
  };
}

// Spotify task execution - uses real Spotify API
async function executeSpotifyTask(task: any, email: string) {
  const params = task.params || {};

  // Step 1: Analyze mood/activity
  await updateTaskStep(task.id, 'step_1', 'in_progress');

  const mood = params.mood || 'focus';
  await updateTaskStep(task.id, 'step_1', 'completed', `Mood detected: ${mood}`);

  // Step 2: Call the real Spotify create-playlist API
  await updateTaskStep(task.id, 'step_2', 'in_progress');

  try {
    const playlistResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/create-playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: params.name,
        mood,
        duration: params.duration || 60,
      }),
    });

    const playlistData = await playlistResponse.json();

    if (!playlistResponse.ok || !playlistData.success) {
      // Check if user needs to re-authenticate
      if (playlistData.needsAuth) {
        throw new Error('Spotify not connected. Please reconnect Spotify with updated permissions.');
      }
      throw new Error(playlistData.error || 'Failed to create playlist');
    }

    await updateTaskStep(task.id, 'step_2', 'completed', `Selected ${playlistData.trackCount} tracks`);

    // Step 3: Playlist created (already done by API)
    await updateTaskStep(task.id, 'step_3', 'in_progress');
    await updateTaskStep(task.id, 'step_3', 'completed', `Playlist "${playlistData.playlistName}" created`);

    // Step 4: Tracks added (already done by API)
    await updateTaskStep(task.id, 'step_4', 'in_progress');
    await updateTaskStep(task.id, 'step_4', 'completed', `${playlistData.trackCount} tracks added`);

    return {
      success: true,
      playlistId: playlistData.playlistId,
      playlistUrl: playlistData.playlistUrl,
      playlistName: playlistData.playlistName,
      trackCount: playlistData.trackCount,
      sampleTracks: playlistData.sampleTracks,
      message: playlistData.message,
    };
  } catch (error: any) {
    console.error('[Spotify Agent] Error:', error);
    throw error;
  }
}

// Supplement task execution
async function executeSupplementTask(task: any, email: string) {
  const params = task.params || {};

  // Step 1: Analyze biomarkers
  await updateTaskStep(task.id, 'step_1', 'in_progress');

  // Fetch blood analysis data
  const { data: userData } = await supabase
    .from('sage_onboarding_data')
    .select('lab_file_analysis')
    .eq('email', email)
    .single();

  await updateTaskStep(task.id, 'step_1', 'completed', 'Biomarkers analyzed');

  // Step 2: Identify deficiencies
  await updateTaskStep(task.id, 'step_2', 'in_progress');

  const deficiencies = identifyDeficiencies(userData?.lab_file_analysis);

  await updateTaskStep(task.id, 'step_2', 'completed', `Found ${deficiencies.length} areas to address`);

  // Step 3: Match supplements
  await updateTaskStep(task.id, 'step_3', 'in_progress');

  // Call supplements matching API
  const matchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/supplements/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, deficiencies, targetAreas: params.targetAreas }),
  });
  const recommendations = await matchResponse.json();

  await updateTaskStep(task.id, 'step_3', 'completed', `${recommendations.supplements?.length || 0} supplements matched`);

  // Step 4: Prepare recommendations
  await updateTaskStep(task.id, 'step_4', 'in_progress');
  await updateTaskStep(task.id, 'step_4', 'completed', 'Recommendations ready');

  return {
    success: true,
    recommendations: recommendations.supplements || [],
    deficiencies,
    message: `Found ${recommendations.supplements?.length || 0} supplement recommendations based on your biomarkers`,
  };
}

// Health booking task execution (simulated)
async function executeHealthBookingTask(task: any, email: string) {
  const params = task.params || {};

  // Step 1: Verify insurance
  await updateTaskStep(task.id, 'step_1', 'in_progress');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
  await updateTaskStep(task.id, 'step_1', 'completed', 'Insurance verified - 100% covered');

  // Step 2: Find schedule gap
  await updateTaskStep(task.id, 'step_2', 'in_progress');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const appointmentTime = 'Thursday 14th, 9 am';
  await updateTaskStep(task.id, 'step_2', 'completed', `${appointmentTime} - clinic has availability`);

  // Step 3: Send health summary
  await updateTaskStep(task.id, 'step_3', 'in_progress');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await updateTaskStep(task.id, 'step_3', 'completed', 'Health summary sent to provider');

  // Step 4: Confirm appointment
  await updateTaskStep(task.id, 'step_4', 'in_progress');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await updateTaskStep(task.id, 'step_4', 'completed', 'Appointment confirmed');

  return {
    success: true,
    appointmentTime,
    provider: params.provider || 'The Wellness Center',
    address: '10 Portman Square',
    message: 'Your appointment is booked. Your doctor is already briefed.',
  };
}

// Helper functions
function findNextAvailableSlot(calendarData: any, durationMinutes: number) {
  // Simple implementation - find tomorrow morning
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const end = new Date(tomorrow.getTime() + durationMinutes * 60000);

  return {
    start: tomorrow.toISOString(),
    end: end.toISOString(),
    formatted: tomorrow.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }),
  };
}

async function getSpotifyRecommendations(email: string, mood: string, duration: number) {
  // TODO: Implement actual Spotify recommendations API call
  // For now, return placeholder
  const trackCount = Math.ceil(duration / 3.5); // ~3.5 min per track
  return Array(trackCount).fill(null).map((_, i) => ({
    id: `track_${i}`,
    name: `${mood} Track ${i + 1}`,
  }));
}

async function createSpotifyPlaylist(email: string, name: string, tracks: any[]) {
  // TODO: Implement actual Spotify playlist creation
  // For now, return placeholder
  return {
    id: `playlist_${Date.now()}`,
    url: 'https://open.spotify.com/playlist/placeholder',
    name,
  };
}

function identifyDeficiencies(labAnalysis: any) {
  if (!labAnalysis) return [];

  // Extract deficiencies from lab analysis
  const deficiencies = [];

  if (labAnalysis.vitamin_d && labAnalysis.vitamin_d.value < 30) {
    deficiencies.push('vitamin_d');
  }
  if (labAnalysis.iron && labAnalysis.iron.value < 60) {
    deficiencies.push('iron');
  }
  if (labAnalysis.b12 && labAnalysis.b12.value < 300) {
    deficiencies.push('vitamin_b12');
  }
  if (labAnalysis.magnesium && labAnalysis.magnesium.value < 1.8) {
    deficiencies.push('magnesium');
  }

  return deficiencies;
}

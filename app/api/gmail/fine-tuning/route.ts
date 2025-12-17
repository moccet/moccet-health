/**
 * Email Fine-Tuning API
 *
 * POST /api/gmail/fine-tuning
 * - action: 'record_sent' - Record that a draft was sent (creates training data)
 * - action: 'start_job' - Start a fine-tuning job
 * - action: 'check_status' - Check fine-tuning status
 *
 * GET /api/gmail/fine-tuning?email=xxx
 * Get fine-tuning status for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  createTrainingExample,
  getFineTuningStatus,
  startFineTuningJob,
  checkJobStatus,
  shouldTriggerFineTuning,
} from '@/lib/services/email-fine-tuning';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getUserEmail(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = createAdminClient();

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        return user.email;
      }
    } catch {
      // Continue
    }
  }
  return null;
}

/**
 * GET /api/gmail/fine-tuning
 * Get fine-tuning status for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const status = await getFineTuningStatus(userEmail);

    return NextResponse.json(status, { headers: corsHeaders });
  } catch (error) {
    console.error('[FineTuning API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get fine-tuning status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/gmail/fine-tuning
 * Handle fine-tuning actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, draftId, userFinalSubject, userFinalBody, jobId } = body;

    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    switch (action) {
      case 'record_sent': {
        // Record that a draft was sent/modified - creates training data
        if (!draftId || !userFinalBody) {
          return NextResponse.json(
            { error: 'draftId and userFinalBody are required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const result = await createTrainingExample(
          userEmail,
          draftId,
          userFinalSubject || '',
          userFinalBody
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400, headers: corsHeaders }
          );
        }

        // Check if we should auto-trigger fine-tuning
        const shouldTrigger = await shouldTriggerFineTuning(userEmail);
        let fineTuningTriggered = false;

        if (shouldTrigger) {
          console.log(`[FineTuning API] Auto-triggering fine-tuning for ${userEmail}`);
          const ftResult = await startFineTuningJob(userEmail);
          fineTuningTriggered = ftResult.success;
        }

        return NextResponse.json(
          {
            success: true,
            trainingDataId: result.trainingDataId,
            fineTuningTriggered,
          },
          { headers: corsHeaders }
        );
      }

      case 'start_job': {
        // Manually start a fine-tuning job
        const result = await startFineTuningJob(userEmail);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400, headers: corsHeaders }
          );
        }

        return NextResponse.json(
          {
            success: true,
            jobId: result.jobId,
          },
          { headers: corsHeaders }
        );
      }

      case 'check_status': {
        // Check status of a specific job
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const status = await checkJobStatus(jobId);

        return NextResponse.json(status, { headers: corsHeaders });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: record_sent, start_job, or check_status' },
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    console.error('[FineTuning API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process fine-tuning action' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

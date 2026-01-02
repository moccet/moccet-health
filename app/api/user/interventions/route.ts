/**
 * Intervention Experiments API
 *
 * Endpoints for managing user intervention experiments
 * Part of the behavioral loop system
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  logInterventionSuggestion,
  markInterventionStarted,
  markInterventionCompleted,
  markInterventionAbandoned,
  getUserInterventions,
  getSuccessfulInterventions,
  getPendingEvaluations,
  InterventionSuggestion,
  InterventionOutcome,
} from '@/lib/services/intervention-tracking-service';

/**
 * GET /api/user/interventions
 *
 * Fetch user's intervention experiments
 *
 * Query params:
 * - email: User email (required)
 * - status: Filter by status (optional)
 * - limit: Max results (optional, default 20)
 * - successful_only: Only return successful interventions (optional)
 * - pending_evaluation: Only return interventions ready for evaluation (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status') as 'SUGGESTED' | 'ONGOING' | 'COMPLETED' | 'ABANDONED' | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const successfulOnly = searchParams.get('successful_only') === 'true';
    const pendingEvaluation = searchParams.get('pending_evaluation') === 'true';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Handle special queries
    if (successfulOnly) {
      const successful = await getSuccessfulInterventions(email, limit);
      return NextResponse.json({
        success: true,
        interventions: successful,
        count: successful.length,
      });
    }

    if (pendingEvaluation) {
      const pending = await getPendingEvaluations(email);
      return NextResponse.json({
        success: true,
        interventions: pending,
        count: pending.length,
      });
    }

    // Standard query
    const interventions = await getUserInterventions(email, {
      status: status || undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      interventions,
      count: interventions.length,
    });
  } catch (error) {
    console.error('[Interventions API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interventions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/interventions
 *
 * Create or update an intervention experiment
 *
 * Body:
 * - action: 'create' | 'start' | 'complete' | 'abandon'
 * - email: User email (required for create)
 * - insightId: Insight ID (optional for create)
 * - experimentId: Experiment ID (required for start/complete/abandon)
 * - intervention: InterventionSuggestion (required for create)
 * - outcome: InterventionOutcome (required for complete)
 * - reason: Abandon reason (optional for abandon)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, insightId, experimentId, intervention, outcome, reason } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'create': {
        if (!email || !intervention) {
          return NextResponse.json(
            { error: 'Email and intervention are required for create action' },
            { status: 400 }
          );
        }

        const suggestionData: InterventionSuggestion = {
          interventionType: intervention.interventionType,
          interventionDescription: intervention.interventionDescription,
          trackedMetric: intervention.trackedMetric,
          difficulty: intervention.difficulty,
          expectedOutcome: intervention.expectedOutcome,
          durationDays: intervention.durationDays,
        };

        const id = await logInterventionSuggestion(email, insightId || null, suggestionData);

        if (!id) {
          return NextResponse.json(
            { error: 'Failed to create intervention' },
            { status: 500 }
          );
        }

        console.log(`[Interventions API] Created intervention ${id} for ${email}`);

        return NextResponse.json({
          success: true,
          experimentId: id,
          message: 'Intervention suggestion logged',
        });
      }

      case 'start': {
        if (!experimentId) {
          return NextResponse.json(
            { error: 'experimentId is required for start action' },
            { status: 400 }
          );
        }

        const success = await markInterventionStarted(experimentId);

        if (!success) {
          return NextResponse.json(
            { error: 'Failed to start intervention' },
            { status: 500 }
          );
        }

        console.log(`[Interventions API] Started intervention ${experimentId}`);

        return NextResponse.json({
          success: true,
          message: 'Intervention started',
        });
      }

      case 'complete': {
        if (!experimentId || !outcome) {
          return NextResponse.json(
            { error: 'experimentId and outcome are required for complete action' },
            { status: 400 }
          );
        }

        const outcomeData: InterventionOutcome = {
          experimentId,
          resultValue: outcome.resultValue,
          userFeedback: outcome.userFeedback,
          userRating: outcome.userRating,
        };

        const result = await markInterventionCompleted(outcomeData);

        if (!result.success) {
          return NextResponse.json(
            { error: 'Failed to complete intervention' },
            { status: 500 }
          );
        }

        console.log(`[Interventions API] Completed intervention ${experimentId} with ${result.improvementPct?.toFixed(1)}% improvement`);

        return NextResponse.json({
          success: true,
          improvementPct: result.improvementPct,
          message: 'Intervention completed',
        });
      }

      case 'abandon': {
        if (!experimentId) {
          return NextResponse.json(
            { error: 'experimentId is required for abandon action' },
            { status: 400 }
          );
        }

        const success = await markInterventionAbandoned(experimentId, reason);

        if (!success) {
          return NextResponse.json(
            { error: 'Failed to abandon intervention' },
            { status: 500 }
          );
        }

        console.log(`[Interventions API] Abandoned intervention ${experimentId}`);

        return NextResponse.json({
          success: true,
          message: 'Intervention abandoned',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Interventions API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process intervention request' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/user/interventions
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

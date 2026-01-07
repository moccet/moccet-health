/**
 * Multi-Agent Insight Generation API
 * POST /api/insights/multi-agent
 *
 * Generates health insights using multiple specialist agents running in parallel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { MultiAgentOrchestrator } from '@/lib/services/multi-agent/orchestrator';
import { CoordinatorOrchestrator } from '@/lib/services/multi-agent/coordinator-orchestrator';
import { buildUserContext } from '@/lib/services/multi-agent/context-builder';
import { ExecutionMode } from '@/lib/services/multi-agent/types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { email, userId, mode = 'standard', maxInsights = 5, version = 'v1' } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes: ExecutionMode[] = ['quick', 'standard', 'deep'];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: `mode must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate version
    const validVersions = ['v1', 'v2'];
    if (!validVersions.includes(version)) {
      return NextResponse.json(
        { error: `version must be one of: ${validVersions.join(', ')}` },
        { status: 400 }
      );
    }

    const useCoordinators = version === 'v2';
    console.log(`[MultiAgent API] Request for ${email} (mode: ${mode}, version: ${version}, maxInsights: ${maxInsights})`);

    // Get OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build user context from database
    console.log('[MultiAgent API] Building user context...');
    const context = await buildUserContext(email, userId);

    if (context.availableDataSources.length === 0) {
      console.log('[MultiAgent API] No data sources available');
      return NextResponse.json({
        success: true,
        insights: [{
          id: 'no_data_1',
          category: 'GENERAL',
          title: 'Connect Your Health Data',
          dataQuote: 'No data sources connected yet',
          recommendation: 'Connect your wearables and communication tools for personalized insights.',
          sources: [],
          impact: 'medium',
          confidence: 1.0,
          scienceExplanation: 'Multi-agent insights require data from connected wearables and tools.',
          actionSteps: [
            'Connect Whoop or Oura Ring for recovery/sleep data',
            'Link Gmail or Slack for work pattern analysis',
            'Sync Apple Health for activity metrics',
          ],
        }],
        metadata: {
          mode,
          agentsRun: 0,
          apiCallsUsed: 0,
          processingTimeMs: Date.now() - startTime,
          availableDataSources: [],
        },
      });
    }

    // Create orchestrator and generate insights
    console.log(`[MultiAgent API] Running ${useCoordinators ? 'Coordinator' : 'Flat'} orchestrator...`);

    let result;
    if (useCoordinators) {
      // v2: Coordinator-based hierarchical system
      const orchestrator = new CoordinatorOrchestrator(openaiApiKey);
      result = await orchestrator.generateInsights(context, mode, maxInsights);
    } else {
      // v1: Original flat agent system
      const orchestrator = new MultiAgentOrchestrator(openaiApiKey);
      result = await orchestrator.generateInsights(context, mode, maxInsights);
    }

    console.log(`[MultiAgent API] Complete: ${result.finalInsights.length} insights in ${result.totalProcessingTimeMs}ms`);

    // Build response metadata
    const metadata: Record<string, unknown> = {
      mode: result.mode,
      version,
      agentsRun: result.agentFindings.length,
      agentNames: result.agentFindings.map((f) => f.agentName),
      crossDomainInsights: result.crossDomainInsights.length,
      conflictsDetected: result.conflicts?.length || 0,
      conflictsResolved: result.resolutions?.length || 0,
      apiCallsUsed: result.apiCallsUsed,
      processingTimeMs: result.totalProcessingTimeMs,
      availableDataSources: context.availableDataSources,
    };

    // Add coordinator-specific metadata for v2
    if (useCoordinators && 'coordinatorResults' in result) {
      metadata.coordinators = result.coordinatorResults;
    }

    // Add consensus validation results for v2
    if (useCoordinators && 'consensusResults' in result) {
      metadata.consensusValidation = result.consensusResults;
    }

    return NextResponse.json({
      success: true,
      insights: result.finalInsights,
      metadata,
    });
  } catch (error) {
    console.error('[MultiAgent API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check available data sources for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email query parameter is required' },
        { status: 400 }
      );
    }

    const context = await buildUserContext(email);

    return NextResponse.json({
      success: true,
      email,
      availableDataSources: context.availableDataSources,
      hasWhoop: context.availableDataSources.includes('whoop'),
      hasOura: context.availableDataSources.includes('oura'),
      hasGmail: context.availableDataSources.includes('gmail'),
      hasSlack: context.availableDataSources.includes('slack'),
      hasDexcom: context.availableDataSources.includes('dexcom'),
      hasBloodBiomarkers: context.availableDataSources.includes('blood_biomarkers'),
      hasAppleHealth: context.availableDataSources.includes('apple_health'),
    });
  } catch (error) {
    console.error('[MultiAgent API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

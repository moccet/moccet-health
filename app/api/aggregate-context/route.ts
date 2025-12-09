/**
 * Context Aggregation API Endpoint
 *
 * The "brain" of the orchestration system. Aggregates data from all ecosystem sources,
 * performs cross-source analysis, and generates unified context for AI plan generation.
 *
 * Features:
 * - 24-hour cache to avoid redundant processing
 * - Automatic sync orchestration
 * - Cross-source pattern analysis
 * - Priority area identification
 * - Data quality validation
 *
 * @route POST /api/aggregate-context
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAllEcosystemData } from '@/lib/services/ecosystem-fetcher';
import { analyzeEcosystemPatterns } from '@/lib/services/pattern-analyzer';
import { analyzeWithAI } from '@/lib/services/ai-pattern-analyzer';
import { autoSyncEcosystemData } from '@/lib/services/auto-sync';
import { validateUnifiedContext, generateQualityMessage } from '@/lib/validators/context-validator';

// ============================================================================
// TYPES
// ============================================================================

interface AggregateContextRequest {
  email: string;
  contextType: 'sage' | 'forge' | 'unified';
  forceRefresh?: boolean;
  skipSync?: boolean;
}

interface UnifiedProfile {
  physiological: {
    biomarkers: unknown;
    sleep: {
      avgHours: number | null;
      quality: string | null;
      hrvStatus: string | null;
      sleepDebt: number | null;
    };
    glucose: {
      avgGlucose: number | null;
      variability: string | null;
      spikePatterns: string[];
      status: string;
    };
    recovery: {
      status: string;
      readinessScore: number | null;
      trainingLoad: string;
      overtrainingRisk: boolean;
    };
  };
  behavioral: {
    workPatterns: {
      stressLevel: string;
      workLifeBalance: string;
      breakDeficiency: boolean;
      optimalMealWindows: string[];
    };
    sleepSchedule: {
      afterHoursWork: boolean;
      impact: string;
    };
  };
  lifestyle: {
    activityLevel: string;
    mealPrepCapacity: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check cache for valid context
 */
async function getCachedContext(
  email: string,
  contextType: string
): Promise<unknown | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('ecosystem_context_cache')
      .select('*')
      .eq('email', email)
      .eq('context_type', contextType)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    console.log('[Context Aggregation] Valid cache found');
    return data[0];
  } catch (error) {
    console.error('[Context Aggregation] Error checking cache:', error);
    return null;
  }
}

/**
 * Store context in cache
 */
async function cacheContext(
  email: string,
  contextType: string,
  unifiedProfile: UnifiedProfile,
  keyInsights: unknown[],
  priorityAreas: unknown[],
  dataSourcesUsed: unknown,
  dataQuality: unknown,
  generationDuration: number,
  apiCallsMade: number,
  rawPatterns?: unknown
): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase.from('ecosystem_context_cache').insert({
      email,
      context_type: contextType,
      unified_profile: unifiedProfile,
      key_insights: keyInsights,
      priority_areas: priorityAreas,
      data_sources_used: dataSourcesUsed,
      data_quality: dataQuality,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      is_valid: true,
      generation_duration_ms: generationDuration,
      api_calls_made: apiCallsMade,
      raw_patterns: rawPatterns || null,
    });

    console.log('[Context Aggregation] Context cached successfully');
  } catch (error) {
    console.error('[Context Aggregation] Error caching context:', error);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await request.json() as AggregateContextRequest;
    const { email, contextType, forceRefresh = false, skipSync = false } = body;

    if (!email || !contextType) {
      return NextResponse.json(
        { error: 'Email and contextType are required' },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('AGGREGATE UNIFIED CONTEXT');
    console.log('='.repeat(80));
    console.log(`Email: ${email}`);
    console.log(`Context Type: ${contextType}`);
    console.log(`Force Refresh: ${forceRefresh}`);
    console.log('='.repeat(80) + '\n');

    // Step 1: Check cache (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedContext(email, contextType);
      if (cached) {
        console.log('[Context Aggregation] Returning cached context');
        return NextResponse.json({
          success: true,
          cached: true,
          context: cached,
          generationTime: 0,
        });
      }
    }

    // Step 2: Auto-sync ecosystem data (unless skipped)
    let apiCallsMade = 0;
    if (!skipSync) {
      console.log('[Step 1/5] Auto-syncing ecosystem data...');
      const syncReport = await autoSyncEcosystemData(
        email,
        contextType === 'sage' || contextType === 'unified' ? 'sage' : 'forge',
        {
          ttlHours: 24,
          forceSync: forceRefresh,
        }
      );
      apiCallsMade += syncReport.successCount;
      console.log(`[Step 1/5] Sync complete: ${syncReport.successCount}/${syncReport.syncResults.length} sources`);
    } else {
      console.log('[Step 1/5] Skipping sync (using existing data)');
    }

    // Step 3: Fetch all ecosystem data
    console.log('[Step 2/5] Fetching ecosystem data...');
    const ecosystemData = await fetchAllEcosystemData(
      email,
      contextType === 'sage' || contextType === 'unified' ? 'sage' : 'forge'
    );
    console.log(`[Step 2/5] Fetched ${ecosystemData.successCount}/${ecosystemData.totalSources} sources`);

    // Step 4: Analyze patterns (rule-based for structure)
    console.log('[Step 3/6] Analyzing patterns (rule-based)...');
    const analysisResult = analyzeEcosystemPatterns(ecosystemData);
    console.log(`[Step 3/6] Generated ${analysisResult.crossSourceInsights.length} rule-based insights`);

    // Step 5: AI-powered deep analysis (finds non-obvious patterns)
    console.log('[Step 4/6] Running AI pattern analysis...');
    const aiAnalysis = await analyzeWithAI(ecosystemData);
    console.log(`[Step 4/6] Generated ${aiAnalysis.insights.length} AI insights`);
    if (aiAnalysis.primaryConcern) {
      console.log(`[Step 4/6] Primary concern: ${aiAnalysis.primaryConcern}`);
    }

    // Step 5: Validate context quality
    console.log('[Step 4/5] Validating context quality...');
    const validation = validateUnifiedContext(
      ecosystemData,
      analysisResult,
      contextType === 'sage' || contextType === 'unified' ? 'sage' : 'forge'
    );
    console.log(`[Step 4/5] Quality: ${validation.qualityReport.overallQuality.toUpperCase()}`);
    console.log(`[Step 4/5] Completeness: ${Math.round(validation.qualityReport.completeness * 100)}%`);
    console.log(`[Step 4/5] Confidence: ${Math.round(validation.qualityReport.confidence * 100)}%`);

    if (!validation.canGeneratePlan) {
      return NextResponse.json(
        {
          error: 'Insufficient data to generate plan',
          validation,
          qualityMessage: generateQualityMessage(validation.qualityReport),
        },
        { status: 400 }
      );
    }

    // Step 6: Build unified profile
    console.log('[Step 5/5] Building unified profile...');

    const unifiedProfile: UnifiedProfile = {
      physiological: {
        biomarkers: ecosystemData.bloodBiomarkers.data || null,
        sleep: {
          avgHours: analysisResult.sleepPatterns.avgHours,
          quality: analysisResult.sleepPatterns.status,
          hrvStatus: analysisResult.sleepPatterns.hrvStatus,
          sleepDebt: analysisResult.sleepPatterns.sleepDebt,
        },
        glucose: {
          avgGlucose: analysisResult.glucosePatterns.avgGlucose,
          variability: analysisResult.glucosePatterns.variability,
          spikePatterns: analysisResult.glucosePatterns.spikeCorrelations.map(c => c.trigger),
          status: analysisResult.glucosePatterns.status,
        },
        recovery: {
          status: analysisResult.activityRecoveryPatterns.recoveryStatus,
          readinessScore: analysisResult.sleepPatterns.qualityScore,
          trainingLoad: analysisResult.activityRecoveryPatterns.trainingLoad,
          overtrainingRisk: analysisResult.activityRecoveryPatterns.overtrainingRisk,
        },
      },
      behavioral: {
        workPatterns: {
          stressLevel: analysisResult.workStressPatterns.stressLevel,
          workLifeBalance: analysisResult.workStressPatterns.workLifeBalance,
          breakDeficiency: analysisResult.workStressPatterns.breakDeficiency,
          optimalMealWindows: analysisResult.workStressPatterns.optimalMealWindows,
        },
        sleepSchedule: {
          afterHoursWork: analysisResult.workStressPatterns.workLifeBalance === 'poor',
          impact: analysisResult.sleepPatterns.insights.find(i => i.includes('after-hours')) || 'None detected',
        },
      },
      lifestyle: {
        activityLevel: analysisResult.activityRecoveryPatterns.trainingLoad,
        mealPrepCapacity: 'moderate', // Could be enhanced with more data
      },
    };

    // Compile key insights
    const keyInsights = analysisResult.crossSourceInsights.map(insight => ({
      insight: insight.insight,
      sources: insight.sources,
      confidence: insight.confidence,
      impact: insight.impact,
      dataPoints: insight.dataPoints,
      recommendation: insight.recommendation,
    }));

    // Add individual pattern insights
    if (analysisResult.glucosePatterns.insights.length > 0) {
      keyInsights.push({
        insight: analysisResult.glucosePatterns.insights.join('. '),
        sources: ['dexcom'],
        confidence: 0.85,
        impact: 'medium' as const,
        dataPoints: [`Average: ${analysisResult.glucosePatterns.avgGlucose} mg/dL`],
        recommendation: analysisResult.glucosePatterns.spikeCorrelations[0]?.recommendation,
      });
    }

    // Identify priority areas
    const priorityAreas = [];

    if (analysisResult.glucosePatterns.status === 'concerning') {
      priorityAreas.push({
        area: 'Blood sugar stabilization',
        severity: 'critical',
        dataPoints: analysisResult.glucosePatterns.insights,
        priority: 1,
      });
    } else if (analysisResult.glucosePatterns.status === 'needs_attention') {
      priorityAreas.push({
        area: 'Blood sugar optimization',
        severity: 'high',
        dataPoints: analysisResult.glucosePatterns.insights,
        priority: 2,
      });
    }

    if (analysisResult.sleepPatterns.status === 'poor') {
      priorityAreas.push({
        area: 'Sleep optimization',
        severity: 'critical',
        dataPoints: analysisResult.sleepPatterns.insights,
        priority: 1,
      });
    } else if (analysisResult.sleepPatterns.status === 'suboptimal') {
      priorityAreas.push({
        area: 'Sleep quality improvement',
        severity: 'medium',
        dataPoints: analysisResult.sleepPatterns.insights,
        priority: 3,
      });
    }

    if (analysisResult.activityRecoveryPatterns.overtrainingRisk) {
      priorityAreas.push({
        area: 'Overtraining prevention',
        severity: 'critical',
        dataPoints: analysisResult.activityRecoveryPatterns.insights,
        priority: 1,
      });
    }

    if (analysisResult.workStressPatterns.stressLevel === 'high') {
      priorityAreas.push({
        area: 'Stress management',
        severity: 'high',
        dataPoints: analysisResult.workStressPatterns.insights,
        priority: 2,
      });
    }

    // Sort by priority
    priorityAreas.sort((a, b) => a.priority - b.priority);

    // Build data sources summary
    const dataSourcesUsed = {
      bloodBiomarkers: {
        available: ecosystemData.bloodBiomarkers.available,
        lastUpdated: ecosystemData.bloodBiomarkers.fetchedAt,
        recordCount: ecosystemData.bloodBiomarkers.recordCount,
      },
      oura: {
        available: ecosystemData.oura.available,
        lastSync: ecosystemData.oura.fetchedAt,
        daysOfData: ecosystemData.oura.daysOfData,
      },
      dexcom: {
        available: ecosystemData.dexcom.available,
        lastSync: ecosystemData.dexcom.fetchedAt,
        readingsCount: ecosystemData.dexcom.recordCount,
      },
      gmail: {
        available: ecosystemData.gmail.available,
        lastSync: ecosystemData.gmail.fetchedAt,
        messagesAnalyzed: ecosystemData.gmail.recordCount,
      },
      slack: {
        available: ecosystemData.slack.available,
        lastSync: ecosystemData.slack.fetchedAt,
        messagesAnalyzed: ecosystemData.slack.recordCount,
      },
      vital: {
        available: ecosystemData.vital.available,
        lastSync: ecosystemData.vital.fetchedAt,
      },
    };

    const generationDuration = Date.now() - startTime;

    // Include raw patterns for detailed stats access (all integrations)
    const rawPatterns = {
      slack: ecosystemData.slack.data || null,
      gmail: ecosystemData.gmail.data || null,
      oura: ecosystemData.oura.data || null,
      dexcom: ecosystemData.dexcom.data || null,
      vital: ecosystemData.vital.data || null,
      bloodBiomarkers: ecosystemData.bloodBiomarkers.data || null,
    };

    // Cache the context (including raw patterns for detailed stats)
    await cacheContext(
      email,
      contextType,
      unifiedProfile,
      keyInsights,
      priorityAreas,
      dataSourcesUsed,
      validation.qualityReport,
      generationDuration,
      apiCallsMade,
      rawPatterns
    );

    console.log(`\n[Context Aggregation] COMPLETE in ${generationDuration}ms`);
    console.log(`[Context Aggregation] Priority Areas: ${priorityAreas.length}`);
    console.log(`[Context Aggregation] Key Insights: ${keyInsights.length}\n`);

    return NextResponse.json({
      success: true,
      cached: false,
      context: {
        email,
        contextType,
        unifiedProfile,
        keyInsights,
        priorityAreas,
        dataSourcesUsed,
        dataQuality: validation.qualityReport,
        validation,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        // Include raw ecosystem patterns for detailed stats (actual percentages, timestamps, etc.)
        rawPatterns,
        // AI-powered insights (non-obvious patterns and correlations)
        aiAnalysis: {
          insights: aiAnalysis.insights,
          summary: aiAnalysis.summary,
          primaryConcern: aiAnalysis.primaryConcern,
          hiddenPatterns: aiAnalysis.hiddenPatterns,
        },
      },
      generationTime: generationDuration,
      qualityMessage: generateQualityMessage(validation.qualityReport),
    });

  } catch (error) {
    console.error('[Context Aggregation] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to aggregate context',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

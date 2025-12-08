import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAllEcosystemData } from '@/lib/services/ecosystem-fetcher';
import { analyzeEcosystemPatterns } from '@/lib/services/pattern-analyzer';

/**
 * Test the full ecosystem flow without generating a plan
 * POST /api/admin/ecosystem-debug/test-ecosystem
 * Body: { email: string, syncFirst?: boolean }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const results: Record<string, any> = {
    steps: [],
    errors: [],
  };

  try {
    const { email, syncFirst = true } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`ECOSYSTEM TEST FOR: ${email}`);
    console.log(`${'='.repeat(60)}\n`);

    const supabase = await createClient();

    // Step 1: Check what tokens exist
    console.log('[Step 1] Checking stored tokens...');
    const step1Start = Date.now();
    const { data: tokens, error: tokensError } = await supabase
      .from('integration_tokens')
      .select('provider, is_active, expires_at, created_at')
      .eq('user_email', email)
      .eq('is_active', true);

    results.steps.push({
      step: 1,
      name: 'Check Tokens',
      duration: Date.now() - step1Start,
      success: !tokensError,
      data: {
        tokenCount: tokens?.length || 0,
        providers: tokens?.map(t => t.provider) || [],
        tokens: tokens,
      },
      error: tokensError?.message,
    });

    if (!tokens || tokens.length === 0) {
      results.summary = {
        hasTokens: false,
        message: 'No active integration tokens found. User needs to connect integrations first.',
      };
      return NextResponse.json(results);
    }

    // Step 2: Sync data from each provider (if requested)
    if (syncFirst) {
      console.log('[Step 2] Syncing data from providers...');
      const step2Start = Date.now();
      const syncResults: Record<string, any> = {};

      for (const token of tokens) {
        const provider = token.provider;
        console.log(`  - Syncing ${provider}...`);

        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          let syncUrl = '';

          switch (provider) {
            case 'oura':
              syncUrl = `${baseUrl}/api/oura/sync`;
              break;
            case 'gmail':
              syncUrl = `${baseUrl}/api/gmail/fetch-data`;
              break;
            case 'slack':
              syncUrl = `${baseUrl}/api/slack/fetch-data`;
              break;
            case 'dexcom':
              syncUrl = `${baseUrl}/api/dexcom/sync`;
              break;
            default:
              console.log(`    Skipping unknown provider: ${provider}`);
              continue;
          }

          const syncResponse = await fetch(syncUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const syncData = await syncResponse.json();
          syncResults[provider] = {
            success: syncResponse.ok,
            status: syncResponse.status,
            data: syncData,
          };
          console.log(`    ${provider}: ${syncResponse.ok ? '✓' : '✗'} (${syncResponse.status})`);
        } catch (e) {
          syncResults[provider] = {
            success: false,
            error: String(e),
          };
          console.log(`    ${provider}: ✗ Error: ${e}`);
        }
      }

      results.steps.push({
        step: 2,
        name: 'Sync Providers',
        duration: Date.now() - step2Start,
        success: Object.values(syncResults).some((r: any) => r.success),
        data: syncResults,
      });
    }

    // Step 3: Fetch ecosystem data
    console.log('[Step 3] Fetching ecosystem data...');
    const step3Start = Date.now();
    let ecosystemData;
    try {
      ecosystemData = await fetchAllEcosystemData(email, 'forge');
      results.steps.push({
        step: 3,
        name: 'Fetch Ecosystem Data',
        duration: Date.now() - step3Start,
        success: true,
        data: {
          totalSources: ecosystemData.totalSources,
          successCount: ecosystemData.successCount,
          sources: {
            oura: {
              available: ecosystemData.oura?.available,
              recordCount: ecosystemData.oura?.recordCount,
              insights: ecosystemData.oura?.insights,
              error: ecosystemData.oura?.error,
            },
            dexcom: {
              available: ecosystemData.dexcom?.available,
              insights: ecosystemData.dexcom?.insights,
              error: ecosystemData.dexcom?.error,
            },
            gmail: {
              available: ecosystemData.gmail?.available,
              insights: ecosystemData.gmail?.insights,
              error: ecosystemData.gmail?.error,
            },
            slack: {
              available: ecosystemData.slack?.available,
              insights: ecosystemData.slack?.insights,
              error: ecosystemData.slack?.error,
            },
            bloodBiomarkers: {
              available: ecosystemData.bloodBiomarkers?.available,
              error: ecosystemData.bloodBiomarkers?.error,
            },
          },
        },
      });
    } catch (e) {
      results.steps.push({
        step: 3,
        name: 'Fetch Ecosystem Data',
        duration: Date.now() - step3Start,
        success: false,
        error: String(e),
      });
      results.errors.push(`Step 3 failed: ${e}`);
    }

    // Step 4: Analyze patterns
    if (ecosystemData) {
      console.log('[Step 4] Analyzing patterns...');
      const step4Start = Date.now();
      try {
        const analysis = analyzeEcosystemPatterns(ecosystemData);
        results.steps.push({
          step: 4,
          name: 'Analyze Patterns',
          duration: Date.now() - step4Start,
          success: true,
          data: {
            sleepPatterns: analysis.sleepPatterns,
            glucosePatterns: analysis.glucosePatterns,
            activityRecoveryPatterns: analysis.activityRecoveryPatterns,
            workStressPatterns: analysis.workStressPatterns,
            crossSourceInsightsCount: analysis.crossSourceInsights?.length || 0,
            crossSourceInsights: analysis.crossSourceInsights?.slice(0, 5), // First 5
          },
        });
      } catch (e) {
        results.steps.push({
          step: 4,
          name: 'Analyze Patterns',
          duration: Date.now() - step4Start,
          success: false,
          error: String(e),
        });
        results.errors.push(`Step 4 failed: ${e}`);
      }
    }

    // Summary
    results.totalDuration = Date.now() - startTime;
    results.summary = {
      hasTokens: tokens.length > 0,
      connectedProviders: tokens.map(t => t.provider),
      ecosystemDataAvailable: ecosystemData?.successCount || 0,
      stepsCompleted: results.steps.filter((s: any) => s.success).length,
      totalSteps: results.steps.length,
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST COMPLETE - ${results.totalDuration}ms`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json(results);

  } catch (error) {
    results.errors.push(String(error));
    results.totalDuration = Date.now() - startTime;
    return NextResponse.json(results, { status: 500 });
  }
}

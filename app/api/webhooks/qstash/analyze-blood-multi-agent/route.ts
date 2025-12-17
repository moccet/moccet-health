/**
 * QStash Webhook: Multi-Agent Blood Analysis
 *
 * This endpoint handles async blood test analysis using a multi-agent system.
 * It's triggered by QStash after a user uploads a blood test file.
 *
 * Pipeline:
 * 1. Fetch file from Supabase storage URL
 * 2. Run 4 batch extractions (GPT-4o-mini) sequentially
 * 3. Validate and deduplicate all biomarkers
 * 4. Generate comprehensive analysis (GPT-4o)
 * 5. Save to database
 * 6. Send push notification to user
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { Client } from '@upstash/qstash';
import {
  runAndSaveAnalysis,
  fetchFileFromUrl,
  AnalysisJobPayload
} from '@/lib/services/blood-analyzer';
import { sendPushNotification } from '@/lib/services/onesignal-service';
import { createClient } from '@/lib/supabase/server';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
export const maxDuration = 800;

async function handler(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body: AnalysisJobPayload = await request.json();
    const { fileUrl, email, fileName } = body;

    if (!fileUrl || !email) {
      console.error('[Blood Analyzer Webhook] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: fileUrl and email' },
        { status: 400 }
      );
    }

    console.log(`\n========================================`);
    console.log(`[Blood Analyzer Webhook] Starting multi-agent analysis`);
    console.log(`  Email: ${email}`);
    console.log(`  File URL: ${fileUrl.substring(0, 50)}...`);
    console.log(`========================================\n`);

    // Step 1: Fetch file from URL
    console.log('[Step 1/3] Fetching file from storage...');
    const fileBuffer = await fetchFileFromUrl(fileUrl);

    // Step 2-5: Run analysis and save to database
    console.log('[Step 2/3] Running multi-agent analysis pipeline...');
    const result = await runAndSaveAnalysis(
      fileBuffer,
      fileName || 'blood_test.pdf',
      email
    );

    // Step 6: Send push notification
    console.log('[Step 3/3] Sending push notification...');
    const notificationSent = await sendPushNotification(email, {
      title: 'Blood Analysis Complete',
      body: `Found ${result.totalCount} biomarkers with ${result.confidence.toFixed(0)}% confidence. Tap to view results.`,
      data: {
        action_url: '/blood-results',
        biomarker_count: result.totalCount.toString(),
        concerns_count: result.concerns.length.toString()
      }
    });

    // Step 7: Trigger plan generation now that blood analysis is ready
    // This is the EVENT-DRIVEN approach - blood analysis completion triggers plan generation
    console.log('[Step 4/4] Triggering plan generation with blood data...');
    let planQueued = false;

    try {
      const supabase = await createClient();

      // Get user's onboarding data to check if plan generation should be triggered
      const { data: userData } = await supabase
        .from('sage_onboarding_data')
        .select('form_data, plan_generation_status, sage_plan')
        .eq('email', email)
        .single();

      // Only trigger plan generation if:
      // 1. We have user data with a uniqueCode
      // 2. Plan hasn't already been generated
      // 3. Plan isn't already in progress
      const uniqueCode = userData?.form_data?.uniqueCode;
      const fullName = userData?.form_data?.fullName || userData?.form_data?.name || 'User';
      const status = userData?.plan_generation_status;
      const hasPlan = userData?.sage_plan;

      if (uniqueCode && !hasPlan && status !== 'completed' && status !== 'processing') {
        const qstashToken = process.env.QSTASH_TOKEN;
        if (qstashToken) {
          const client = new Client({ token: qstashToken });
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';

          // Update status to queued
          await supabase
            .from('sage_onboarding_data')
            .update({ plan_generation_status: 'queued' })
            .eq('email', email);

          // Queue plan generation - blood data is now ready!
          await client.publishJSON({
            url: `${baseUrl}/api/webhooks/qstash/generate-plan`,
            body: { email, uniqueCode, fullName },
            retries: 2,
          });

          planQueued = true;
          console.log(`[Blood Analyzer] Plan generation queued for ${email} (blood data ready)`);
        }
      } else {
        console.log(`[Blood Analyzer] Skipping plan generation - status: ${status}, hasPlan: ${!!hasPlan}, uniqueCode: ${!!uniqueCode}`);
      }
    } catch (planError) {
      console.warn('[Blood Analyzer] Could not trigger plan generation:', planError);
      // Don't fail the blood analysis if plan queueing fails
    }

    const totalTimeMs = Date.now() - startTime;
    const totalTimeSec = (totalTimeMs / 1000).toFixed(1);

    console.log(`\n========================================`);
    console.log(`[Blood Analyzer Webhook] Analysis complete!`);
    console.log(`  Total biomarkers: ${result.totalCount}`);
    console.log(`  Confidence: ${result.confidence}%`);
    console.log(`  Concerns: ${result.concerns.length}`);
    console.log(`  Processing time: ${totalTimeSec}s`);
    console.log(`  Notification sent: ${notificationSent > 0 ? 'Yes' : 'No'}`);
    console.log(`  Plan generation queued: ${planQueued ? 'Yes' : 'No'}`);
    console.log(`========================================\n`);

    return NextResponse.json({
      success: true,
      biomarkerCount: result.totalCount,
      confidence: result.confidence,
      concernsCount: result.concerns.length,
      processingTimeMs: totalTimeMs,
      notificationSent: notificationSent > 0,
      planQueued
    });

  } catch (error) {
    const totalTimeMs = Date.now() - startTime;
    console.error(`[Blood Analyzer Webhook] Error after ${totalTimeMs}ms:`, error);

    // Try to send failure notification
    try {
      const body = await request.clone().json();
      if (body.email) {
        await sendPushNotification(body.email, {
          title: 'Blood Analysis Issue',
          body: 'There was an issue analyzing your blood test. Please try uploading again.',
          data: {
            action_url: '/blood-results',
            error: 'true'
          }
        });
      }
    } catch {
      // Ignore notification errors
    }

    return NextResponse.json(
      {
        error: 'Blood analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: totalTimeMs
      },
      { status: 500 }
    );
  }
}

// Export with conditional QStash signature verification
export async function POST(request: NextRequest) {
  const isDevMode = process.env.NODE_ENV === 'development' ||
    request.headers.get('X-Dev-Mode') === 'true';

  if (isDevMode) {
    console.log('[Blood Analyzer Webhook] Dev mode - skipping QStash signature verification');
    return handler(request);
  }

  // In production, verify QStash signature
  const verifiedHandler = verifySignatureAppRouter(handler);
  return verifiedHandler(request);
}

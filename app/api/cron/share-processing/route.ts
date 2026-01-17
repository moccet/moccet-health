/**
 * Share Processing Cron Job
 * Processes scheduled tasks for moccet Share:
 * - Alert escalations
 * - Intervention execution
 * - Weekly clinical summaries
 * - Anomaly detection
 *
 * Should be called every 5 minutes via Vercel Cron or similar
 */

import { NextRequest, NextResponse } from 'next/server';
import { alertRoutingService } from '@/lib/services/share/alert-routing-service';
import { interventionEngine } from '@/lib/services/share/intervention-engine';
import { clinicalCoordinationService } from '@/lib/services/share/clinical-coordination-service';
import { anomalyDetectionService } from '@/lib/services/share/anomaly-detection-service';
import { contextBuilderService } from '@/lib/services/share/context-builder-service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidCronRequest } from '@/lib/utils/cron-auth';

// Lazy initialization to avoid build-time errors
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase configuration');
    }

    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    escalations: 0,
    interventions: 0,
    anomalies: 0,
    weeklySummaries: 0,
    errors: [] as string[],
  };

  // 1. Process alert escalations
  try {
    results.escalations = await alertRoutingService.processEscalations();
    console.log(`Processed ${results.escalations} alert escalations`);
  } catch (error) {
    console.error('Error processing escalations:', error);
    results.errors.push(`Escalations: ${error}`);
  }

  // 2. Execute due interventions
  try {
    results.interventions = await interventionEngine.processDueInterventions();
    console.log(`Executed ${results.interventions} interventions`);
  } catch (error) {
    console.error('Error processing interventions:', error);
    results.errors.push(`Interventions: ${error}`);
  }

  // 3. Run anomaly detection for active share relationships
  try {
    results.anomalies = await processAnomalyDetection();
    console.log(`Detected ${results.anomalies} anomalies`);
  } catch (error) {
    console.error('Error processing anomaly detection:', error);
    results.errors.push(`Anomaly detection: ${error}`);
  }

  // 4. Send weekly summaries (only on Sundays at 9am)
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() === 9 && now.getMinutes() < 5) {
    try {
      results.weeklySummaries = await clinicalCoordinationService.processWeeklySummaries();
      console.log(`Sent ${results.weeklySummaries} weekly summaries`);
    } catch (error) {
      console.error('Error processing weekly summaries:', error);
      results.errors.push(`Weekly summaries: ${error}`);
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    results,
  });
}

/**
 * Run anomaly detection for all users with active share relationships
 */
async function processAnomalyDetection(): Promise<number> {
  const supabase = getSupabase();

  // Get all unique sharers with active relationships
  const { data: relationships } = await supabase
    .from('share_relationships')
    .select('sharer_email')
    .eq('status', 'active');

  if (!relationships) return 0;

  const uniqueSharers = [...new Set(relationships.map(r => r.sharer_email))];
  let anomalyCount = 0;

  for (const sharerEmail of uniqueSharers) {
    try {
      // Build health snapshot
      const snapshot = await anomalyDetectionService.buildHealthSnapshot(sharerEmail);

      // Create alerts for anomalies
      for (const anomaly of snapshot.anomalies) {
        if (anomaly.isAnomaly && anomaly.severity) {
          // Check if we already have a recent similar alert
          const { data: recentAlerts } = await supabase
            .from('share_alerts')
            .select('id')
            .eq('sharer_email', sharerEmail)
            .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
            .limit(1);

          // Avoid duplicate alerts within 4 hours
          if (!recentAlerts || recentAlerts.length === 0) {
            const context = await contextBuilderService.buildAlertContext(
              sharerEmail,
              'anomaly_detected'
            );

            await alertRoutingService.createAlertFromAnomaly(
              sharerEmail,
              anomaly,
              context
            );
            anomalyCount++;
          }
        }
      }

      // Create alerts for pattern breaks
      for (const patternBreak of snapshot.patternBreaks) {
        // Check for recent similar alerts
        const { data: recentAlerts } = await supabase
          .from('share_alerts')
          .select('id')
          .eq('sharer_email', sharerEmail)
          .eq('alert_type', patternBreak.patternType)
          .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!recentAlerts || recentAlerts.length === 0) {
          const context = await contextBuilderService.buildAlertContext(
            sharerEmail,
            patternBreak.patternType
          );

          await alertRoutingService.createAlertFromPatternBreak(
            sharerEmail,
            patternBreak,
            context
          );
          anomalyCount++;
        }
      }

      // Update baseline values with latest data
      const metrics = await contextBuilderService.getRecentMetrics(sharerEmail);
      for (const [metric, value] of Object.entries(metrics)) {
        if (value !== null && value !== undefined) {
          await anomalyDetectionService.updateBaseline(
            sharerEmail,
            metric as any,
            value
          );
        }
      }
    } catch (error) {
      console.error(`Error processing anomaly detection for ${sharerEmail}:`, error);
    }
  }

  return anomalyCount;
}

// Also support POST for Vercel Cron
export async function POST(request: NextRequest) {
  return GET(request);
}

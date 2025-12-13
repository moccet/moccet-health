/**
 * Health Data Tools
 * Tools for fetching and analyzing health data from various sources
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// Get health data from connected sources
export const getHealthDataTool: ToolDefinition = {
  name: 'get_health_data',
  description: `Fetch health data from user's connected sources. Can retrieve:
    - Blood biomarkers (from uploaded blood tests)
    - Sleep data (from Oura)
    - Activity data (from Oura, Apple Health)
    - Glucose data (from Dexcom CGM)
    - Recovery/readiness scores
    Use this to understand the user's current health status before taking action.`,
  riskLevel: 'low',
  parameters: z.object({
    dataTypes: z.array(z.enum([
      'blood_biomarkers',
      'sleep',
      'activity',
      'glucose',
      'recovery',
      'all'
    ])).describe('Types of health data to fetch'),
    timeRange: z.enum(['latest', 'week', 'month', 'all']).optional()
      .describe('Time range for the data. Default is latest.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { dataTypes, timeRange = 'latest' } = params;
      const results: Record<string, any> = {};

      // Fetch blood biomarkers
      if (dataTypes.includes('blood_biomarkers') || dataTypes.includes('all')) {
        const { data: bloodData } = await context.supabase
          .from('blood_analysis_results')
          .select('*')
          .eq('user_email', context.userEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bloodData) {
          results.bloodBiomarkers = {
            available: true,
            analyzedAt: bloodData.created_at,
            biomarkers: bloodData.analysis?.biomarkers || [],
            summary: bloodData.analysis?.summary,
            deficiencies: bloodData.analysis?.biomarkers?.filter(
              (b: any) => b.status === 'low' || b.status === 'deficient'
            ) || [],
          };
        } else {
          results.bloodBiomarkers = { available: false };
        }
      }

      // Fetch Oura data (sleep, activity, recovery)
      if (dataTypes.includes('sleep') || dataTypes.includes('activity') ||
          dataTypes.includes('recovery') || dataTypes.includes('all')) {
        const { data: ouraData } = await context.supabase
          .from('oura_data')
          .select('*')
          .eq('user_email', context.userEmail)
          .order('date', { ascending: false })
          .limit(timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 1);

        if (ouraData && ouraData.length > 0) {
          if (dataTypes.includes('sleep') || dataTypes.includes('all')) {
            results.sleep = {
              available: true,
              latestScore: ouraData[0].sleep_score,
              avgScore: ouraData.reduce((sum: number, d: any) => sum + (d.sleep_score || 0), 0) / ouraData.length,
              latestDuration: ouraData[0].sleep_duration_hours,
              quality: ouraData[0].sleep_score > 85 ? 'Excellent' :
                       ouraData[0].sleep_score > 70 ? 'Good' :
                       ouraData[0].sleep_score > 60 ? 'Fair' : 'Poor',
            };
          }
          if (dataTypes.includes('recovery') || dataTypes.includes('all')) {
            results.recovery = {
              available: true,
              readinessScore: ouraData[0].readiness_score,
              hrvBalance: ouraData[0].hrv,
              status: ouraData[0].readiness_score > 85 ? 'Excellent' :
                      ouraData[0].readiness_score > 70 ? 'Good' :
                      ouraData[0].readiness_score > 60 ? 'Fair' : 'Needs Rest',
            };
          }
          if (dataTypes.includes('activity') || dataTypes.includes('all')) {
            results.activity = {
              available: true,
              steps: ouraData[0].steps,
              activeMinutes: ouraData[0].active_minutes,
              caloriesBurned: ouraData[0].calories,
            };
          }
        } else {
          if (dataTypes.includes('sleep') || dataTypes.includes('all')) {
            results.sleep = { available: false };
          }
          if (dataTypes.includes('recovery') || dataTypes.includes('all')) {
            results.recovery = { available: false };
          }
          if (dataTypes.includes('activity') || dataTypes.includes('all')) {
            results.activity = { available: false };
          }
        }
      }

      // Fetch Dexcom glucose data
      if (dataTypes.includes('glucose') || dataTypes.includes('all')) {
        const { data: glucoseData } = await context.supabase
          .from('dexcom_readings')
          .select('*')
          .eq('user_email', context.userEmail)
          .order('timestamp', { ascending: false })
          .limit(timeRange === 'week' ? 2016 : timeRange === 'month' ? 8640 : 288); // 5-min intervals

        if (glucoseData && glucoseData.length > 0) {
          const values = glucoseData.map((d: any) => d.glucose_value);
          const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
          const spikes = values.filter((v: number) => v > 140).length;

          results.glucose = {
            available: true,
            latestValue: glucoseData[0].glucose_value,
            avgValue: Math.round(avg),
            spikeCount: spikes,
            variability: Math.round(
              Math.sqrt(values.reduce((sum: number, v: number) => sum + Math.pow(v - avg, 2), 0) / values.length)
            ),
            status: avg < 100 && spikes < 5 ? 'Optimal' :
                    avg < 110 && spikes < 10 ? 'Good' : 'Needs Attention',
          };
        } else {
          results.glucose = { available: false };
        }
      }

      return {
        success: true,
        data: results,
        metadata: {
          source: 'health_data_aggregation',
          timestamp: new Date().toISOString(),
          dataTypesRequested: dataTypes,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch health data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Analyze biomarkers for deficiencies and recommendations
export const analyzeBiomarkersTool: ToolDefinition = {
  name: 'analyze_biomarkers',
  description: `Analyze blood biomarkers to identify deficiencies, patterns, and provide health recommendations.
    This tool interprets lab values and provides context about what they mean for the user's health.
    Use after fetching health data to get actionable insights.`,
  riskLevel: 'low',
  parameters: z.object({
    biomarkers: z.array(z.object({
      name: z.string(),
      value: z.number(),
      unit: z.string(),
      referenceRange: z.object({
        low: z.number(),
        high: z.number(),
      }).optional(),
    })).optional().describe('Specific biomarkers to analyze. If not provided, will fetch from stored blood results.'),
    focusAreas: z.array(z.string()).optional()
      .describe('Specific health areas to focus on (e.g., "vitamin_d", "iron", "thyroid")'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      let biomarkers = params.biomarkers;

      // If no biomarkers provided, fetch from stored results
      if (!biomarkers) {
        const { data: bloodData } = await context.supabase
          .from('blood_analysis_results')
          .select('analysis')
          .eq('user_email', context.userEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!bloodData?.analysis?.biomarkers) {
          return {
            success: false,
            error: 'No blood biomarker data available. User needs to upload blood test results first.',
          };
        }

        biomarkers = bloodData.analysis.biomarkers;
      }

      // Analyze each biomarker
      const analysis = {
        deficiencies: [] as any[],
        elevatedMarkers: [] as any[],
        optimalMarkers: [] as any[],
        recommendations: [] as string[],
      };

      const REFERENCE_RANGES: Record<string, { low: number; high: number; unit: string; supplementRec?: string }> = {
        'vitamin_d': { low: 30, high: 100, unit: 'ng/mL', supplementRec: 'Vitamin D3 2000-4000 IU daily' },
        '25-hydroxyvitamin_d': { low: 30, high: 100, unit: 'ng/mL', supplementRec: 'Vitamin D3 2000-4000 IU daily' },
        'vitamin_b12': { low: 300, high: 900, unit: 'pg/mL', supplementRec: 'B12 methylcobalamin 1000mcg daily' },
        'ferritin': { low: 30, high: 300, unit: 'ng/mL', supplementRec: 'Iron bisglycinate with Vitamin C' },
        'iron': { low: 60, high: 170, unit: 'mcg/dL', supplementRec: 'Iron bisglycinate with Vitamin C' },
        'magnesium': { low: 1.7, high: 2.2, unit: 'mg/dL', supplementRec: 'Magnesium glycinate 400mg daily' },
        'zinc': { low: 70, high: 120, unit: 'mcg/dL', supplementRec: 'Zinc picolinate 30mg daily' },
        'tsh': { low: 0.4, high: 4.0, unit: 'mIU/L' },
        'hemoglobin': { low: 12, high: 17.5, unit: 'g/dL' },
        'glucose_fasting': { low: 70, high: 100, unit: 'mg/dL' },
        'cholesterol_total': { low: 0, high: 200, unit: 'mg/dL' },
        'ldl': { low: 0, high: 100, unit: 'mg/dL' },
        'hdl': { low: 40, high: 100, unit: 'mg/dL' },
        'triglycerides': { low: 0, high: 150, unit: 'mg/dL' },
      };

      for (const marker of biomarkers) {
        const normalizedName = marker.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const reference = REFERENCE_RANGES[normalizedName] || marker.referenceRange;

        if (!reference) continue;

        const value = typeof marker.value === 'string'
          ? parseFloat(marker.value)
          : marker.value;

        if (value < reference.low) {
          analysis.deficiencies.push({
            name: marker.name,
            value: value,
            unit: marker.unit || reference.unit,
            status: 'low',
            severity: value < reference.low * 0.5 ? 'severe' : 'moderate',
            recommendation: reference.supplementRec,
          });
        } else if (value > reference.high) {
          analysis.elevatedMarkers.push({
            name: marker.name,
            value: value,
            unit: marker.unit || reference.unit,
            status: 'elevated',
          });
        } else {
          analysis.optimalMarkers.push({
            name: marker.name,
            value: value,
            status: 'optimal',
          });
        }
      }

      // Generate recommendations
      for (const deficiency of analysis.deficiencies) {
        if (deficiency.recommendation) {
          analysis.recommendations.push(
            `${deficiency.name} is ${deficiency.severity === 'severe' ? 'severely' : 'moderately'} low. ` +
            `Consider: ${deficiency.recommendation}`
          );
        }
      }

      return {
        success: true,
        data: {
          summary: {
            totalAnalyzed: biomarkers.length,
            deficiencies: analysis.deficiencies.length,
            elevated: analysis.elevatedMarkers.length,
            optimal: analysis.optimalMarkers.length,
          },
          ...analysis,
        },
        metadata: {
          source: 'biomarker_analysis',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to analyze biomarkers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get user context (profile, preferences, connected services)
export const getUserContextTool: ToolDefinition = {
  name: 'get_user_context',
  description: `Get comprehensive user context including profile, preferences, and connected services.
    Use this to understand the user's health goals, dietary preferences, and available integrations.`,
  riskLevel: 'low',
  parameters: z.object({
    includeConnectedServices: z.boolean().optional()
      .describe('Whether to include connected service status'),
    includePreferences: z.boolean().optional()
      .describe('Whether to include user preferences'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { includeConnectedServices = true, includePreferences = true } = params;
      const result: Record<string, any> = {};

      // Get user profile/onboarding data
      const { data: profile } = await context.supabase
        .from('sage_onboarding_data')
        .select('*')
        .eq('email', context.userEmail)
        .maybeSingle();

      if (profile?.form_data) {
        result.profile = {
          healthGoals: profile.form_data.healthGoals,
          dietaryPreferences: profile.form_data.dietaryPreferences,
          activityLevel: profile.form_data.activityLevel,
          cookingFrequency: profile.form_data.cookingFrequency,
          supplements: profile.form_data.currentSupplements,
          healthConditions: profile.form_data.healthConditions,
        };
      }

      // Get connected services
      if (includeConnectedServices) {
        const { data: connections } = await context.supabase
          .from('user_oauth_connections')
          .select('provider, connected_at')
          .eq('user_email', context.userEmail);

        result.connectedServices = {
          google: connections?.some((c: any) => c.provider === 'google') || false,
          spotify: connections?.some((c: any) => c.provider === 'spotify') || false,
          oura: connections?.some((c: any) => c.provider === 'oura') || false,
          dexcom: connections?.some((c: any) => c.provider === 'dexcom') || false,
          whoop: connections?.some((c: any) => c.provider === 'whoop') || false,
        };
      }

      return {
        success: true,
        data: result,
        metadata: {
          source: 'user_context',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get user context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export const healthDataTools = [
  getHealthDataTool,
  analyzeBiomarkersTool,
  getUserContextTool,
];

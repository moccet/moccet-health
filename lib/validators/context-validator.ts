/**
 * Context Validator
 *
 * Validates unified context quality, completeness, and confidence levels.
 * Provides data quality reports to inform AI prompt generation and user transparency.
 *
 * @module lib/validators/context-validator
 */

import { EcosystemFetchResult } from '@/lib/services/ecosystem-fetcher';
import { AnalysisResult } from '@/lib/services/pattern-analyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface DataQualityReport {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  completeness: number; // 0-1 (percentage of available data sources)
  confidence: number; // 0-1 (overall confidence in insights)
  criticalDataMissing: string[]; // List of critical data sources not available
  optionalDataMissing: string[]; // List of optional data sources not available
  dataSourceSummary: DataSourceSummary[];
  recommendations: string[]; // Suggestions for improving data quality
}

export interface DataSourceSummary {
  source: string;
  available: boolean;
  quality: 'high' | 'medium' | 'low';
  recordCount?: number;
  daysOfData?: number;
  lastUpdated?: string;
  issues?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  canGeneratePlan: boolean;
  qualityReport: DataQualityReport;
  warnings: string[];
  errors: string[];
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Evaluate data source quality based on availability and record count
 */
function evaluateDataSourceQuality(
  source: string,
  available: boolean,
  recordCount?: number,
  daysOfData?: number
): { quality: 'high' | 'medium' | 'low'; issues: string[] } {
  const issues: string[] = [];

  if (!available) {
    return { quality: 'low', issues: ['Data source not connected or no data available'] };
  }

  let quality: 'high' | 'medium' | 'low' = 'high';

  // Source-specific quality checks
  switch (source) {
    case 'oura':
    case 'dexcom':
    case 'vital':
      // Wearable data quality
      if (!daysOfData || daysOfData < 7) {
        quality = 'low';
        issues.push(`Insufficient data (${daysOfData || 0} days, need 7+ for reliable patterns)`);
      } else if (daysOfData < 14) {
        quality = 'medium';
        issues.push(`Limited data (${daysOfData} days, 14+ days recommended for better insights)`);
      }
      if (!recordCount || recordCount < 10) {
        quality = 'low';
        issues.push('Very few data points recorded');
      }
      break;

    case 'gmail':
    case 'slack':
      // Behavioral data quality
      if (!recordCount || recordCount < 20) {
        quality = 'low';
        issues.push(`Few messages analyzed (${recordCount || 0}, 50+ recommended for pattern detection)`);
      } else if (recordCount < 50) {
        quality = 'medium';
        issues.push(`Limited messages analyzed (${recordCount}, 100+ ideal for comprehensive patterns)`);
      }
      break;

    case 'bloodBiomarkers':
      // Blood work quality
      if (!recordCount || recordCount < 10) {
        quality = 'low';
        issues.push(`Limited biomarkers (${recordCount || 0}, comprehensive panel recommended)`);
      } else if (recordCount < 20) {
        quality = 'medium';
        issues.push(`Partial biomarker panel (${recordCount} markers, 30+ ideal)`);
      }
      break;
  }

  return { quality, issues };
}

/**
 * Determine critical vs optional data sources based on plan type
 */
function getCriticalDataSources(planType: 'sage' | 'forge'): {
  critical: string[];
  optional: string[];
} {
  if (planType === 'sage') {
    return {
      critical: ['bloodBiomarkers'], // Nutrition plans should have at least blood work
      optional: ['oura', 'dexcom', 'vital', 'gmail', 'slack'],
    };
  } else {
    // Forge (fitness)
    return {
      critical: [], // Fitness plans can work with minimal data
      optional: ['bloodBiomarkers', 'oura', 'dexcom', 'vital', 'gmail', 'slack'],
    };
  }
}

/**
 * Calculate overall confidence score based on data availability and quality
 */
function calculateConfidenceScore(
  dataSourceSummaries: DataSourceSummary[],
  analysisResult: AnalysisResult
): number {
  let confidenceScore = 0;
  const weights = {
    bloodBiomarkers: 0.25,
    oura: 0.20,
    dexcom: 0.20,
    vital: 0.15,
    gmail: 0.10,
    slack: 0.10,
  };

  // Base confidence from data source availability and quality
  dataSourceSummaries.forEach(summary => {
    if (!summary.available) return;

    const weight = weights[summary.source as keyof typeof weights] || 0.05;
    const qualityMultiplier = summary.quality === 'high' ? 1.0 :
      summary.quality === 'medium' ? 0.7 : 0.4;

    confidenceScore += weight * qualityMultiplier;
  });

  // Boost confidence if cross-source insights were generated
  const crossSourceInsightCount = analysisResult.crossSourceInsights.length;
  if (crossSourceInsightCount > 0) {
    confidenceScore += 0.05 * Math.min(crossSourceInsightCount, 4); // Max +0.20
  }

  return Math.min(confidenceScore, 1.0); // Cap at 1.0
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate unified context and generate quality report
 *
 * @param ecosystemData - Fetched ecosystem data
 * @param analysisResult - Pattern analysis results
 * @param planType - Type of plan being generated
 * @returns Validation result with quality report and recommendations
 */
export function validateUnifiedContext(
  ecosystemData: EcosystemFetchResult,
  analysisResult: AnalysisResult,
  planType: 'sage' | 'forge'
): ValidationResult {
  const { critical: criticalSources, optional: optionalSources } = getCriticalDataSources(planType);

  // Evaluate each data source
  const dataSourceSummaries: DataSourceSummary[] = [];
  const criticalDataMissing: string[] = [];
  const optionalDataMissing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check blood biomarkers
  const biomarkerEval = evaluateDataSourceQuality(
    'bloodBiomarkers',
    ecosystemData.bloodBiomarkers.available,
    ecosystemData.bloodBiomarkers.recordCount
  );
  dataSourceSummaries.push({
    source: 'bloodBiomarkers',
    available: ecosystemData.bloodBiomarkers.available,
    quality: biomarkerEval.quality,
    recordCount: ecosystemData.bloodBiomarkers.recordCount,
    lastUpdated: ecosystemData.bloodBiomarkers.fetchedAt,
    issues: biomarkerEval.issues,
  });
  if (!ecosystemData.bloodBiomarkers.available && criticalSources.includes('bloodBiomarkers')) {
    criticalDataMissing.push('bloodBiomarkers');
    errors.push('Blood biomarker data is required for optimal nutrition plan generation');
  } else if (!ecosystemData.bloodBiomarkers.available) {
    optionalDataMissing.push('bloodBiomarkers');
  }

  // Check Oura
  const ouraEval = evaluateDataSourceQuality(
    'oura',
    ecosystemData.oura.available,
    ecosystemData.oura.recordCount,
    ecosystemData.oura.daysOfData
  );
  dataSourceSummaries.push({
    source: 'oura',
    available: ecosystemData.oura.available,
    quality: ouraEval.quality,
    recordCount: ecosystemData.oura.recordCount,
    daysOfData: ecosystemData.oura.daysOfData,
    lastUpdated: ecosystemData.oura.fetchedAt,
    issues: ouraEval.issues,
  });
  if (!ecosystemData.oura.available) {
    optionalDataMissing.push('oura');
    warnings.push('Oura Ring data not available - sleep and recovery insights will be limited');
  }

  // Check Dexcom
  const dexcomEval = evaluateDataSourceQuality(
    'dexcom',
    ecosystemData.dexcom.available,
    ecosystemData.dexcom.recordCount,
    ecosystemData.dexcom.daysOfData
  );
  dataSourceSummaries.push({
    source: 'dexcom',
    available: ecosystemData.dexcom.available,
    quality: dexcomEval.quality,
    recordCount: ecosystemData.dexcom.recordCount,
    daysOfData: ecosystemData.dexcom.daysOfData,
    lastUpdated: ecosystemData.dexcom.fetchedAt,
    issues: dexcomEval.issues,
  });
  if (!ecosystemData.dexcom.available) {
    optionalDataMissing.push('dexcom');
    if (planType === 'sage') {
      warnings.push('CGM data not available - glucose optimization will rely on general guidelines');
    }
  }

  // Check Vital
  const vitalEval = evaluateDataSourceQuality(
    'vital',
    ecosystemData.vital.available,
    ecosystemData.vital.recordCount
  );
  dataSourceSummaries.push({
    source: 'vital',
    available: ecosystemData.vital.available,
    quality: vitalEval.quality,
    recordCount: ecosystemData.vital.recordCount,
    lastUpdated: ecosystemData.vital.fetchedAt,
    issues: vitalEval.issues,
  });
  if (!ecosystemData.vital.available) {
    optionalDataMissing.push('vital');
  }

  // Check Gmail
  const gmailEval = evaluateDataSourceQuality(
    'gmail',
    ecosystemData.gmail.available,
    ecosystemData.gmail.recordCount
  );
  dataSourceSummaries.push({
    source: 'gmail',
    available: ecosystemData.gmail.available,
    quality: gmailEval.quality,
    recordCount: ecosystemData.gmail.recordCount,
    lastUpdated: ecosystemData.gmail.fetchedAt,
    issues: gmailEval.issues,
  });
  if (!ecosystemData.gmail.available) {
    optionalDataMissing.push('gmail');
    warnings.push('Gmail not connected - work pattern and meal timing insights will be generic');
  }

  // Check Slack
  const slackEval = evaluateDataSourceQuality(
    'slack',
    ecosystemData.slack.available,
    ecosystemData.slack.recordCount
  );
  dataSourceSummaries.push({
    source: 'slack',
    available: ecosystemData.slack.available,
    quality: slackEval.quality,
    recordCount: ecosystemData.slack.recordCount,
    lastUpdated: ecosystemData.slack.fetchedAt,
    issues: slackEval.issues,
  });
  if (!ecosystemData.slack.available) {
    optionalDataMissing.push('slack');
  }

  // Calculate completeness
  const availableCount = dataSourceSummaries.filter(s => s.available).length;
  const totalCount = dataSourceSummaries.length;
  const completeness = availableCount / totalCount;

  // Calculate confidence
  const confidence = calculateConfidenceScore(dataSourceSummaries, analysisResult);

  // Determine overall quality
  let overallQuality: DataQualityReport['overallQuality'];
  if (completeness >= 0.8 && confidence >= 0.8) {
    overallQuality = 'excellent';
  } else if (completeness >= 0.6 && confidence >= 0.6) {
    overallQuality = 'good';
  } else if (completeness >= 0.4 && confidence >= 0.4) {
    overallQuality = 'fair';
  } else {
    overallQuality = 'poor';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (completeness < 0.5) {
    recommendations.push('Connect more data sources for comprehensive personalization');
  }
  if (!ecosystemData.oura.available && !ecosystemData.vital.available) {
    recommendations.push('Connect a wearable device (Oura, Whoop, Fitbit) for sleep and recovery insights');
  }
  if (!ecosystemData.dexcom.available && planType === 'sage') {
    recommendations.push('Consider CGM for real-time glucose optimization');
  }
  if (!ecosystemData.gmail.available && !ecosystemData.slack.available) {
    recommendations.push('Connect Gmail or Slack to personalize meal timing around your work schedule');
  }
  if (criticalDataMissing.length > 0 && planType === 'sage') {
    recommendations.push('Upload blood work for biomarker-optimized nutrition recommendations');
  }

  // Determine if plan can be generated
  const canGeneratePlan = criticalDataMissing.length === 0;

  return {
    isValid: canGeneratePlan,
    canGeneratePlan,
    qualityReport: {
      overallQuality,
      completeness,
      confidence,
      criticalDataMissing,
      optionalDataMissing,
      dataSourceSummary: dataSourceSummaries,
      recommendations,
    },
    warnings,
    errors,
  };
}

/**
 * Generate user-friendly data quality message
 */
export function generateQualityMessage(report: DataQualityReport): string {
  const availableSources = report.dataSourceSummary.filter(s => s.available).map(s => s.source);
  const qualityPercentage = Math.round(report.completeness * 100);

  let message = `Data Quality: ${report.overallQuality.toUpperCase()} (${qualityPercentage}% complete, ${Math.round(report.confidence * 100)}% confidence)\n\n`;

  if (availableSources.length > 0) {
    message += `Connected sources: ${availableSources.join(', ')}\n`;
  }

  if (report.criticalDataMissing.length > 0) {
    message += `\n⚠️  Critical data missing: ${report.criticalDataMissing.join(', ')}\n`;
  }

  if (report.recommendations.length > 0) {
    message += `\nRecommendations:\n${report.recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  return message;
}

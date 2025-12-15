/**
 * Blood Analyzer Validator
 * Deduplication and validation of extracted biomarkers
 */

import { Biomarker, ValidationResult, CATEGORY_CONFIGS } from './types';

/**
 * Normalize biomarker names for comparison
 * Handles common variations and abbreviations
 */
function normalizeBiomarkerName(name: string): string {
  let normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, ''); // Remove all non-alphanumeric

  // Common abbreviation mappings
  const abbreviations: Record<string, string> = {
    'hb': 'haemoglobin',
    'hemoglobin': 'haemoglobin',
    'rbc': 'redcellcount',
    'wbc': 'whitecellcount',
    'plt': 'platelets',
    'hct': 'haematocrit',
    'hematocrit': 'haematocrit',
    'ldl': 'ldlcholesterol',
    'hdl': 'hdlcholesterol',
    'tc': 'totalcholesterol',
    'tg': 'triglycerides',
    'alt': 'alanineaminotransferase',
    'sgpt': 'alanineaminotransferase',
    'ast': 'aspartateaminotransferase',
    'sgot': 'aspartateaminotransferase',
    'alp': 'alkalinephosphatase',
    'ggt': 'gammaglutamyltransferase',
    'gamagt': 'gammaglutamyltransferase',
    'tsh': 'thyroidstimulatinghormone',
    'ft4': 'freet4',
    'ft3': 'freet3',
    'hba1c': 'glycatedhaemoglobin',
    'egfr': 'estimatedgfr',
    'bun': 'bloodureanitrogen',
    'crp': 'creactiveprotein',
    'hscrp': 'highsensitivitycrp',
    'esr': 'erythrocytesedimentationrate',
    'psa': 'prostatespecificantigen',
    'vitd': 'vitamind',
    'vitb12': 'vitaminb12',
    'b12': 'vitaminb12',
    'lpa': 'lipoproteina',
    'apoa': 'apolipoproteina1',
    'apob': 'apolipoproteinb',
    'shbg': 'sexhormonebindingglobulin',
    'dhea': 'dheas',
    'dheas': 'dheasulphate',
    'igf1': 'igf1',
    'ck': 'creatinekinase',
    'cpk': 'creatinekinase',
    'ldh': 'lactatedehydrogenase',
    'mch': 'meancorpuscularhaemoglobin',
    'mchc': 'meancorpuscularhaemoglobinconcentration',
    'mcv': 'meancorpuscularvolume',
    'mpv': 'meanplateletvolume',
    'rdw': 'redcelldistributionwidth',
    'tibc': 'totalironbindingcapacity',
    'uibc': 'unsaturatedironbindingcapacity',
    'acr': 'albumincreatinineratio'
  };

  // Check if the normalized name is an abbreviation
  if (abbreviations[normalized]) {
    return abbreviations[normalized];
  }

  return normalized;
}

/**
 * Calculate confidence score based on expected vs found biomarkers
 */
function calculateConfidence(biomarkers: Biomarker[]): number {
  // Calculate total expected markers across all categories
  const totalExpected = Object.values(CATEGORY_CONFIGS)
    .reduce((sum, config) => sum + config.minExpected, 0);

  // Get unique categories found
  const categoriesFound = new Set(biomarkers.map(b => b.category));
  const categoryCoverage = categoriesFound.size / Object.keys(CATEGORY_CONFIGS).length;

  // Calculate score based on count and category coverage
  const countScore = Math.min(1, biomarkers.length / totalExpected);
  const coverageScore = categoryCoverage;

  // Weight: 60% count, 40% coverage
  const confidence = (countScore * 0.6 + coverageScore * 0.4) * 100;

  return Math.round(confidence * 10) / 10; // Round to 1 decimal
}

/**
 * Validate and deduplicate biomarkers from all batches
 */
export function validateAndDedupe(biomarkers: Biomarker[]): ValidationResult {
  const seen = new Map<string, Biomarker>();
  let duplicatesRemoved = 0;

  for (const biomarker of biomarkers) {
    const normalizedName = normalizeBiomarkerName(biomarker.name);

    if (seen.has(normalizedName)) {
      duplicatesRemoved++;
      // Keep the one with more complete data
      const existing = seen.get(normalizedName)!;
      const existingScore = scoreCompleteness(existing);
      const newScore = scoreCompleteness(biomarker);

      if (newScore > existingScore) {
        seen.set(normalizedName, biomarker);
      }
    } else {
      seen.set(normalizedName, biomarker);
    }
  }

  const uniqueBiomarkers = Array.from(seen.values());
  const confidence = calculateConfidence(uniqueBiomarkers);

  console.log(`[Blood Analyzer] Validation complete:`);
  console.log(`  - Input biomarkers: ${biomarkers.length}`);
  console.log(`  - Unique biomarkers: ${uniqueBiomarkers.length}`);
  console.log(`  - Duplicates removed: ${duplicatesRemoved}`);
  console.log(`  - Confidence: ${confidence}%`);

  return {
    biomarkers: uniqueBiomarkers,
    duplicatesRemoved,
    confidence
  };
}

/**
 * Score the completeness of a biomarker record
 */
function scoreCompleteness(biomarker: Biomarker): number {
  let score = 0;

  if (biomarker.name) score += 1;
  if (biomarker.value) score += 1;
  if (biomarker.unit) score += 1;
  if (biomarker.referenceRange && biomarker.referenceRange !== 'Not specified') score += 1;
  if (biomarker.status && biomarker.status !== 'normal') score += 0.5; // Bonus for specific status
  if (biomarker.significance) score += 0.5;
  if (biomarker.implications) score += 0.5;
  if (biomarker.category) score += 0.5;

  return score;
}

/**
 * Group biomarkers by category for display
 */
export function groupByCategory(biomarkers: Biomarker[]): Record<string, Biomarker[]> {
  const grouped: Record<string, Biomarker[]> = {};

  for (const biomarker of biomarkers) {
    const category = biomarker.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(biomarker);
  }

  // Sort biomarkers within each category alphabetically
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  return grouped;
}

/**
 * Get biomarkers with concerning status (high, low, critical)
 */
export function getConcerningBiomarkers(biomarkers: Biomarker[]): Biomarker[] {
  return biomarkers.filter(b =>
    b.status === 'high' ||
    b.status === 'low' ||
    b.status === 'critical' ||
    b.status === 'borderline'
  ).sort((a, b) => {
    // Sort by severity: critical > high/low > borderline
    const severityOrder = { critical: 0, high: 1, low: 1, borderline: 2, normal: 3, optimal: 4 };
    return (severityOrder[a.status] || 3) - (severityOrder[b.status] || 3);
  });
}

/**
 * Get biomarkers with optimal status
 */
export function getOptimalBiomarkers(biomarkers: Biomarker[]): Biomarker[] {
  return biomarkers.filter(b =>
    b.status === 'optimal' ||
    b.status === 'normal'
  );
}

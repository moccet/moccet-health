/**
 * Skin Health Assessment
 *
 * Assesses skin health needs based on age, training frequency, location (UV),
 * lab biomarkers, and inflammatory markers. Provides nutrition-based recommendations.
 *
 * @module lib/inference/skin-health
 */

import type { EcosystemFetchResult, BloodBiomarkers } from '@/lib/services/ecosystem-fetcher';

// ============================================================================
// TYPES
// ============================================================================

export interface SkinHealthInput {
  ecosystemData: EcosystemFetchResult;
  questionnaireData?: {
    age?: number;
    skinConcerns?: string[]; // ['acne', 'aging', 'dryness', 'inflammation']
    location?: string; // For UV index estimation
    sunExposure?: 'high' | 'moderate' | 'low';
  };
  trainingFrequency?: number; // From training protocol inference
}

export interface NutrientRecommendation {
  nutrient: string;
  targetAmount: string;
  foodSources: string[];
  rationale: string;
  priority: 'essential' | 'beneficial' | 'optional';
}

export interface SkinHealthResult {
  riskFactors: string[];
  nutrientDeficiencies: string[];
  recommendations: NutrientRecommendation[];
  lifestyleFactors: string[];
  confidence: number; // 0-100
  dataSource: string;
  insights: string[];
}

// ============================================================================
// ASSESSMENT FUNCTIONS
// ============================================================================

/**
 * Assess skin health needs from biomarkers
 */
function assessFromBiomarkers(biomarkerData: BloodBiomarkers): {
  deficiencies: string[];
  inflammatoryMarkers: string[];
  insights: string[];
} {
  const deficiencies: string[] = [];
  const inflammatoryMarkers: string[] = [];
  const insights: string[] = [];

  // Check for nutrient deficiencies affecting skin
  biomarkerData.biomarkers.forEach(marker => {
    const name = marker.name.toLowerCase();
    const value = parseFloat(marker.value);

    // Vitamin D (critical for skin health)
    if (name.includes('vitamin d') && !isNaN(value)) {
      if (value < 30) {
        deficiencies.push('Vitamin D deficiency');
        insights.push(`Low Vitamin D (${value} ng/mL) can impair skin barrier function and healing`);
      } else if (value < 40) {
        insights.push(`Vitamin D (${value} ng/mL) is suboptimal for skin health - aim for 40-60 ng/mL`);
      }
    }

    // Zinc (essential for wound healing and skin renewal)
    if (name.includes('zinc') && !isNaN(value)) {
      if (value < 70) {
        deficiencies.push('Zinc deficiency');
        insights.push(`Low zinc (${value} μg/dL) affects collagen synthesis and wound healing`);
      }
    }

    // Omega-3 index or EPA/DHA
    if ((name.includes('omega-3') || name.includes('epa') || name.includes('dha')) && !isNaN(value)) {
      if (value < 4) {
        deficiencies.push('Low omega-3 levels');
        insights.push('Low omega-3 levels reduce skin hydration and increase inflammation');
      }
    }

    // Inflammatory markers
    if (name.includes('crp') || name.includes('c-reactive')) {
      if (!isNaN(value) && value > 3) {
        inflammatoryMarkers.push(`Elevated CRP (${value} mg/L)`);
        insights.push('Elevated inflammation can contribute to skin aging and acne');
      }
    }

    // Testosterone (for both men and women - affects sebum production)
    if (name.includes('testosterone') && !isNaN(value)) {
      // High testosterone can increase acne risk
      // This would need gender-specific interpretation
    }
  });

  return { deficiencies, inflammatoryMarkers, insights };
}

/**
 * Assess age-related skin needs
 */
function assessAgeRelatedNeeds(age: number): {
  concerns: string[];
  recommendations: string[];
} {
  const concerns: string[] = [];
  const recommendations: string[] = [];

  if (age >= 25) {
    concerns.push('Preventive anti-aging care needed');
    recommendations.push('Increase antioxidant intake (vitamins C, E, polyphenols)');
    recommendations.push('Ensure adequate collagen-supporting nutrients (vitamin C, proline, glycine)');
  }

  if (age >= 35) {
    concerns.push('Accelerated collagen degradation');
    recommendations.push('Prioritize collagen synthesis: vitamin C (500-1000mg), bone broth, or collagen peptides');
    recommendations.push('Increase omega-3 intake to reduce inflammation-driven aging');
  }

  if (age >= 45) {
    concerns.push('Hormonal changes affecting skin');
    recommendations.push('Focus on phytoestrogens (flax seeds, soy) and skin barrier support');
    recommendations.push('Maximize antioxidant diversity (colorful vegetables, berries, green tea)');
  }

  return { concerns, recommendations };
}

/**
 * Assess training impact on skin
 */
function assessTrainingImpact(trainingFrequency: number): {
  factors: string[];
  recommendations: string[];
} {
  const factors: string[] = [];
  const recommendations: string[] = [];

  if (trainingFrequency >= 4) {
    factors.push('High sweat exposure from frequent training');
    recommendations.push('Increase water intake to 3-4L daily to maintain skin hydration');
    recommendations.push('Ensure adequate zinc (15-20mg) for skin repair and renewal');
  }

  if (trainingFrequency >= 6) {
    factors.push('Very high training volume increases oxidative stress');
    recommendations.push('Boost antioxidant intake: vitamin C (1000mg), vitamin E (400 IU), selenium-rich foods');
  }

  return { factors, recommendations };
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Assess skin health needs and generate nutrition recommendations
 */
export function assessSkinHealth(input: SkinHealthInput): SkinHealthResult {
  const { ecosystemData, questionnaireData, trainingFrequency } = input;

  const riskFactors: string[] = [];
  const nutrientDeficiencies: string[] = [];
  const recommendations: NutrientRecommendation[] = [];
  const lifestyleFactors: string[] = [];
  const insights: string[] = [];

  let confidence = 40; // Base confidence
  let dataSource = 'Questionnaire';

  // Assess from blood biomarkers if available
  if (ecosystemData.bloodBiomarkers.available && ecosystemData.bloodBiomarkers.data) {
    const biomarkerData = ecosystemData.bloodBiomarkers.data as BloodBiomarkers;
    const biomarkerAssessment = assessFromBiomarkers(biomarkerData);

    nutrientDeficiencies.push(...biomarkerAssessment.deficiencies);
    riskFactors.push(...biomarkerAssessment.inflammatoryMarkers);
    insights.push(...biomarkerAssessment.insights);

    confidence = 75; // Higher confidence with lab data
    dataSource = 'Blood Biomarkers + Questionnaire';
  }

  // Age-based assessment
  if (questionnaireData?.age) {
    const ageAssessment = assessAgeRelatedNeeds(questionnaireData.age);
    riskFactors.push(...ageAssessment.concerns);
    lifestyleFactors.push(`Age: ${questionnaireData.age} years`);
  }

  // Training impact
  if (trainingFrequency && trainingFrequency >= 4) {
    const trainingAssessment = assessTrainingImpact(trainingFrequency);
    lifestyleFactors.push(...trainingAssessment.factors);
  }

  // Build nutrient recommendations

  // Essential: Omega-3 for inflammation and skin barrier
  recommendations.push({
    nutrient: 'Omega-3 Fatty Acids (EPA/DHA)',
    targetAmount: '2000-3000mg combined EPA/DHA daily',
    foodSources: ['Salmon', 'Sardines', 'Mackerel', 'Anchovies', 'High-quality fish oil supplement'],
    rationale: 'Reduces inflammation, supports skin barrier function, and improves hydration',
    priority: 'essential',
  });

  // Essential: Vitamin C for collagen
  recommendations.push({
    nutrient: 'Vitamin C',
    targetAmount: '500-1000mg daily (from food + supplement)',
    foodSources: ['Bell peppers', 'Citrus fruits', 'Strawberries', 'Kiwi', 'Broccoli', 'Brussels sprouts'],
    rationale: 'Critical for collagen synthesis and protection against oxidative damage',
    priority: 'essential',
  });

  // Beneficial: Zinc for skin renewal
  if (nutrientDeficiencies.includes('Zinc deficiency') || trainingFrequency && trainingFrequency >= 4) {
    recommendations.push({
      nutrient: 'Zinc',
      targetAmount: '15-20mg daily',
      foodSources: ['Oysters', 'Pumpkin seeds', 'Beef', 'Chickpeas', 'Cashews'],
      rationale: 'Essential for wound healing, skin cell renewal, and sebum regulation',
      priority: 'essential',
    });
  } else {
    recommendations.push({
      nutrient: 'Zinc',
      targetAmount: '10-15mg daily',
      foodSources: ['Oysters', 'Pumpkin seeds', 'Beef', 'Chickpeas'],
      rationale: 'Supports skin renewal and immune function',
      priority: 'beneficial',
    });
  }

  // Beneficial: Vitamin E for antioxidant protection
  if (questionnaireData?.age && questionnaireData.age >= 35) {
    recommendations.push({
      nutrient: 'Vitamin E',
      targetAmount: '15-400 IU daily',
      foodSources: ['Almonds', 'Sunflower seeds', 'Avocado', 'Spinach', 'Olive oil'],
      rationale: 'Protects skin lipids from oxidative damage and supports barrier function',
      priority: 'beneficial',
    });
  }

  // Optional: Collagen peptides for aging concerns
  if (questionnaireData?.age && questionnaireData.age >= 30) {
    recommendations.push({
      nutrient: 'Collagen Peptides',
      targetAmount: '10-15g daily',
      foodSources: ['Bone broth', 'Collagen supplement (hydrolyzed)', 'Skin-on chicken', 'Fish with skin'],
      rationale: 'Provides amino acids (proline, glycine) for collagen synthesis and skin elasticity',
      priority: 'optional',
    });
  }

  // Hydration
  lifestyleFactors.push('Adequate hydration essential for skin moisture');
  const waterTarget = trainingFrequency && trainingFrequency >= 4 ? '3-4L' : '2.5-3L';
  insights.push(`Target ${waterTarget} water daily for optimal skin hydration`);

  // UV protection reminder if needed
  if (questionnaireData?.sunExposure === 'high') {
    lifestyleFactors.push('High sun exposure increases oxidative damage');
    insights.push('Maximize antioxidant intake to protect against UV-induced damage');
  }

  return {
    riskFactors,
    nutrientDeficiencies,
    recommendations,
    lifestyleFactors,
    confidence,
    dataSource,
    insights,
  };
}

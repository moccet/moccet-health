/**
 * Response Validator Service
 *
 * Validates agent responses for consistency, safety, and quality.
 * Detects conflicting advice, flags medical concerns, and ensures
 * recommendations align with user constraints.
 */

import OpenAI from 'openai';

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ValidationCategory =
  | 'conflict'
  | 'safety'
  | 'medical'
  | 'consistency'
  | 'completeness'
  | 'tone'
  | 'accuracy';

export interface ValidationIssue {
  id: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  message: string;
  details?: string;
  suggestion?: string;
  affectedText?: string;
  autoFixable: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  overallScore: number; // 0-100
  issues: ValidationIssue[];
  warnings: string[];
  safetyFlags: string[];
  suggestedRevisions?: string[];
  metadata: {
    validatedAt: string;
    validationTimeMs: number;
    rulesChecked: number;
    issuesFound: number;
  };
}

export interface UserConstraints {
  medicalConditions?: string[];
  medications?: string[];
  allergies?: string[];
  dietaryRestrictions?: string[];
  injuries?: string[];
  preferences?: string[];
  goals?: string[];
  ageGroup?: 'child' | 'teen' | 'adult' | 'senior';
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ValidationContext {
  userQuery: string;
  agentResponse: string;
  agentType: string;
  userConstraints: UserConstraints;
  previousResponses?: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
}

// ============================================================================
// Validation Rules
// ============================================================================

interface ValidationRule {
  id: string;
  name: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  check: (context: ValidationContext) => ValidationIssue | null;
}

const VALIDATION_RULES: ValidationRule[] = [
  // ===== CONFLICT RULES =====
  {
    id: 'conflict_calorie_protein',
    name: 'Calorie vs Protein Conflict',
    category: 'conflict',
    severity: 'warning',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const hasCalorieReduction = /reduce.*calorie|cut.*calorie|lower.*calorie|caloric.*deficit/i.test(response);
      const hasProteinIncrease = /increase.*protein|more.*protein|higher.*protein/i.test(response);

      if (hasCalorieReduction && hasProteinIncrease) {
        return {
          id: 'conflict_calorie_protein',
          category: 'conflict',
          severity: 'warning',
          message: 'Potentially conflicting advice: reducing calories while increasing protein',
          details: 'Increasing protein intake while cutting calories requires careful planning to ensure adequate nutrition.',
          suggestion: 'Clarify how to balance calorie reduction with protein needs, or suggest protein-dense low-calorie foods.',
          autoFixable: false,
        };
      }
      return null;
    },
  },
  {
    id: 'conflict_rest_exercise',
    name: 'Rest vs Exercise Conflict',
    category: 'conflict',
    severity: 'warning',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const suggestsRest = /take.*rest|rest.*day|recover|don't.*exercise|avoid.*workout/i.test(response);
      const suggestsExercise = /workout.*today|exercise.*more|increase.*activity|try.*training/i.test(response);

      if (suggestsRest && suggestsExercise) {
        return {
          id: 'conflict_rest_exercise',
          category: 'conflict',
          severity: 'warning',
          message: 'Conflicting advice about rest and exercise',
          suggestion: 'Clarify whether the user should rest or exercise, and under what conditions.',
          autoFixable: false,
        };
      }
      return null;
    },
  },
  {
    id: 'conflict_caffeine_sleep',
    name: 'Caffeine vs Sleep Conflict',
    category: 'conflict',
    severity: 'warning',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const mentionsCaffeine = /coffee|caffeine|energy.*drink|pre-workout/i.test(response);
      const mentionsSleepIssues = /sleep.*issue|insomnia|trouble.*sleep|can't.*sleep/i.test(ctx.userQuery.toLowerCase());

      if (mentionsCaffeine && mentionsSleepIssues && !response.includes('avoid') && !response.includes('limit')) {
        return {
          id: 'conflict_caffeine_sleep',
          category: 'conflict',
          severity: 'warning',
          message: 'Mentioning caffeine when user has sleep issues',
          suggestion: 'Add a note about caffeine timing or avoidance for sleep optimization.',
          autoFixable: false,
        };
      }
      return null;
    },
  },

  // ===== SAFETY RULES =====
  {
    id: 'safety_extreme_fasting',
    name: 'Extreme Fasting Warning',
    category: 'safety',
    severity: 'error',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const extremeFasting = /72.*hour.*fast|extended.*fast|water.*fast.*day|prolonged.*fast/i.test(response);

      if (extremeFasting) {
        return {
          id: 'safety_extreme_fasting',
          category: 'safety',
          severity: 'error',
          message: 'Response suggests extreme fasting without medical guidance',
          suggestion: 'Add disclaimer about consulting healthcare provider for extended fasting.',
          autoFixable: true,
        };
      }
      return null;
    },
  },
  {
    id: 'safety_extreme_exercise',
    name: 'Extreme Exercise Warning',
    category: 'safety',
    severity: 'warning',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const isBeginnerUser = ctx.userConstraints.fitnessLevel === 'beginner';
      const suggestsIntense = /high.*intensity|hiit|max.*effort|extreme.*workout|brutal/i.test(response);

      if (isBeginnerUser && suggestsIntense) {
        return {
          id: 'safety_extreme_exercise',
          category: 'safety',
          severity: 'warning',
          message: 'High-intensity exercise suggested for beginner user',
          suggestion: 'Modify recommendation to be appropriate for beginner fitness level.',
          autoFixable: false,
        };
      }
      return null;
    },
  },
  {
    id: 'safety_supplement_interaction',
    name: 'Supplement Interaction Check',
    category: 'safety',
    severity: 'error',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const medications = ctx.userConstraints.medications || [];

      // Check for known interactions
      const riskySupplements: Record<string, string[]> = {
        'blood thinner': ['vitamin k', 'fish oil', 'omega-3', 'ginkgo', 'garlic supplement'],
        'antidepressant': ['st john', 'sam-e', '5-htp', 'tryptophan'],
        'blood pressure': ['licorice', 'caffeine', 'ephedra'],
        'diabetes': ['chromium', 'berberine', 'bitter melon'],
      };

      for (const med of medications) {
        const medLower = med.toLowerCase();
        for (const [medType, supplements] of Object.entries(riskySupplements)) {
          if (medLower.includes(medType)) {
            for (const supp of supplements) {
              if (response.includes(supp)) {
                return {
                  id: 'safety_supplement_interaction',
                  category: 'safety',
                  severity: 'error',
                  message: `Potential interaction: ${supp} with ${med}`,
                  details: 'This supplement may interact with the user\'s medication.',
                  suggestion: 'Remove recommendation or add strong disclaimer to consult doctor.',
                  autoFixable: false,
                };
              }
            }
          }
        }
      }
      return null;
    },
  },

  // ===== MEDICAL RULES =====
  {
    id: 'medical_diagnosis',
    name: 'Medical Diagnosis Detection',
    category: 'medical',
    severity: 'critical',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const diagnosisPatterns = [
        /you.*have.*diabetes/i,
        /you.*have.*heart.*disease/i,
        /this.*is.*cancer/i,
        /you.*are.*diabetic/i,
        /diagnosing.*you.*with/i,
        /you.*suffer.*from.*\w+.*disorder/i,
      ];

      for (const pattern of diagnosisPatterns) {
        if (pattern.test(response)) {
          return {
            id: 'medical_diagnosis',
            category: 'medical',
            severity: 'critical',
            message: 'Response appears to make a medical diagnosis',
            suggestion: 'Rephrase to suggest consulting a healthcare provider for proper diagnosis.',
            autoFixable: false,
          };
        }
      }
      return null;
    },
  },
  {
    id: 'medical_medication_advice',
    name: 'Medication Advice Detection',
    category: 'medical',
    severity: 'error',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const medAdvicePatterns = [
        /stop.*taking.*medication/i,
        /increase.*dosage/i,
        /take.*\d+.*mg/i,
        /prescription.*recommend/i,
        /you.*should.*take.*\w+.*pill/i,
      ];

      for (const pattern of medAdvicePatterns) {
        if (pattern.test(response)) {
          return {
            id: 'medical_medication_advice',
            category: 'medical',
            severity: 'error',
            message: 'Response contains medication dosage or prescription advice',
            suggestion: 'Remove specific medication advice and recommend consulting a doctor.',
            autoFixable: false,
          };
        }
      }
      return null;
    },
  },
  {
    id: 'medical_emergency_symptoms',
    name: 'Emergency Symptoms Check',
    category: 'medical',
    severity: 'critical',
    check: (ctx) => {
      const query = ctx.userQuery.toLowerCase();
      const emergencySymptoms = [
        'chest pain',
        'difficulty breathing',
        'severe headache',
        'numbness',
        'slurred speech',
        'fainting',
        'blood in stool',
        'suicidal',
        'overdose',
      ];

      const hasEmergency = emergencySymptoms.some(s => query.includes(s));
      const response = ctx.agentResponse.toLowerCase();
      const hasEmergencyGuidance = /emergency|911|hospital|immediate.*medical|urgent.*care/i.test(response);

      if (hasEmergency && !hasEmergencyGuidance) {
        return {
          id: 'medical_emergency_symptoms',
          category: 'medical',
          severity: 'critical',
          message: 'User mentioned emergency symptoms but response lacks emergency guidance',
          suggestion: 'Add guidance to seek immediate medical attention.',
          autoFixable: true,
        };
      }
      return null;
    },
  },

  // ===== CONSISTENCY RULES =====
  {
    id: 'consistency_allergy',
    name: 'Allergy Consistency Check',
    category: 'consistency',
    severity: 'error',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const allergies = ctx.userConstraints.allergies || [];

      for (const allergy of allergies) {
        const allergyLower = allergy.toLowerCase();
        // Check if response suggests the allergen
        if (response.includes(allergyLower) && !response.includes('avoid') && !response.includes('allergy')) {
          return {
            id: 'consistency_allergy',
            category: 'consistency',
            severity: 'error',
            message: `Response mentions ${allergy} despite user allergy`,
            suggestion: `Remove ${allergy} from recommendations or provide alternatives.`,
            affectedText: allergy,
            autoFixable: false,
          };
        }
      }
      return null;
    },
  },
  {
    id: 'consistency_dietary',
    name: 'Dietary Restriction Consistency',
    category: 'consistency',
    severity: 'warning',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const restrictions = ctx.userConstraints.dietaryRestrictions || [];

      const restrictionViolations: Record<string, string[]> = {
        'vegan': ['meat', 'chicken', 'fish', 'dairy', 'egg', 'honey', 'whey'],
        'vegetarian': ['meat', 'chicken', 'fish', 'beef', 'pork'],
        'gluten-free': ['wheat', 'bread', 'pasta', 'barley', 'rye'],
        'dairy-free': ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'whey'],
        'keto': ['bread', 'pasta', 'rice', 'potato', 'sugar', 'fruit juice'],
      };

      for (const restriction of restrictions) {
        const restrictionLower = restriction.toLowerCase();
        const violations = restrictionViolations[restrictionLower] || [];

        for (const violation of violations) {
          if (response.includes(violation) && !response.includes('avoid') && !response.includes('instead')) {
            return {
              id: 'consistency_dietary',
              category: 'consistency',
              severity: 'warning',
              message: `Response suggests ${violation} which conflicts with ${restriction} diet`,
              suggestion: `Provide ${restriction}-compliant alternatives.`,
              autoFixable: false,
            };
          }
        }
      }
      return null;
    },
  },
  {
    id: 'consistency_injury',
    name: 'Injury Consideration Check',
    category: 'consistency',
    severity: 'warning',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const injuries = ctx.userConstraints.injuries || [];

      const injuryContraindications: Record<string, string[]> = {
        'knee': ['running', 'squats', 'lunges', 'jumping', 'leg press'],
        'back': ['deadlift', 'heavy lifting', 'sit-ups', 'crunches'],
        'shoulder': ['overhead press', 'pull-ups', 'bench press', 'swimming'],
        'ankle': ['running', 'jumping', 'plyometrics'],
        'wrist': ['push-ups', 'planks', 'weight lifting'],
      };

      for (const injury of injuries) {
        const injuryLower = injury.toLowerCase();
        for (const [bodyPart, exercises] of Object.entries(injuryContraindications)) {
          if (injuryLower.includes(bodyPart)) {
            for (const exercise of exercises) {
              if (response.includes(exercise) && !response.includes('modify') && !response.includes('avoid')) {
                return {
                  id: 'consistency_injury',
                  category: 'consistency',
                  severity: 'warning',
                  message: `Response suggests ${exercise} which may aggravate ${injury}`,
                  suggestion: `Suggest modifications or alternatives for ${injury}.`,
                  autoFixable: false,
                };
              }
            }
          }
        }
      }
      return null;
    },
  },

  // ===== COMPLETENESS RULES =====
  {
    id: 'completeness_no_action',
    name: 'Missing Actionable Advice',
    category: 'completeness',
    severity: 'info',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const queryAsksForAdvice = /how.*should|what.*can.*do|recommend|suggest|advice|help.*with/i.test(ctx.userQuery);

      if (queryAsksForAdvice) {
        const hasAction = /try|consider|start|begin|aim|goal|step|action|here's what/i.test(response);
        if (!hasAction) {
          return {
            id: 'completeness_no_action',
            category: 'completeness',
            severity: 'info',
            message: 'Response may lack actionable recommendations',
            suggestion: 'Add specific, actionable steps the user can take.',
            autoFixable: false,
          };
        }
      }
      return null;
    },
  },
  {
    id: 'completeness_unanswered_question',
    name: 'Unanswered Question Check',
    category: 'completeness',
    severity: 'warning',
    check: (ctx) => {
      // Extract questions from user query
      const questions = ctx.userQuery.split(/[.!?]/).filter(s => s.includes('?') || /^(how|what|why|when|where|who|which|can|should|do|is|are|will)/i.test(s.trim()));

      if (questions.length > 1) {
        // Check if response is too short for multiple questions
        const responseWords = ctx.agentResponse.split(/\s+/).length;
        if (responseWords < questions.length * 20) {
          return {
            id: 'completeness_unanswered_question',
            category: 'completeness',
            severity: 'warning',
            message: 'User asked multiple questions; response may not address all of them',
            suggestion: 'Ensure all user questions are addressed in the response.',
            autoFixable: false,
          };
        }
      }
      return null;
    },
  },

  // ===== TONE RULES =====
  {
    id: 'tone_dismissive',
    name: 'Dismissive Tone Detection',
    category: 'tone',
    severity: 'warning',
    check: (ctx) => {
      const response = ctx.agentResponse.toLowerCase();
      const dismissivePatterns = [
        /just.*relax/i,
        /don't.*worry.*about.*it/i,
        /it's.*not.*a.*big.*deal/i,
        /you're.*overthinking/i,
        /everyone.*feels.*that.*way/i,
      ];

      for (const pattern of dismissivePatterns) {
        if (pattern.test(response)) {
          return {
            id: 'tone_dismissive',
            category: 'tone',
            severity: 'warning',
            message: 'Response may come across as dismissive of user concerns',
            suggestion: 'Acknowledge the user\'s concerns before providing advice.',
            autoFixable: false,
          };
        }
      }
      return null;
    },
  },
];

// ============================================================================
// Core Validation Functions
// ============================================================================

function generateIssueId(): string {
  return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Run all validation rules against the response
 */
export function validateResponse(context: ValidationContext): ValidationResult {
  const startTime = Date.now();
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const safetyFlags: string[] = [];

  // Run each validation rule
  for (const rule of VALIDATION_RULES) {
    try {
      const issue = rule.check(context);
      if (issue) {
        issue.id = generateIssueId();
        issues.push(issue);

        if (issue.category === 'safety') {
          safetyFlags.push(issue.message);
        }
        if (issue.severity === 'warning') {
          warnings.push(issue.message);
        }
      }
    } catch (error) {
      console.error(`Validation rule ${rule.id} failed:`, error);
    }
  }

  // Calculate overall score
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 30; break;
      case 'error': score -= 20; break;
      case 'warning': score -= 10; break;
      case 'info': score -= 5; break;
    }
  }
  score = Math.max(0, score);

  // Determine if valid (no critical or error issues)
  const isValid = !issues.some(i => i.severity === 'critical' || i.severity === 'error');

  return {
    isValid,
    overallScore: score,
    issues,
    warnings,
    safetyFlags,
    metadata: {
      validatedAt: new Date().toISOString(),
      validationTimeMs: Date.now() - startTime,
      rulesChecked: VALIDATION_RULES.length,
      issuesFound: issues.length,
    },
  };
}

/**
 * Quick validation for common issues (faster, less thorough)
 */
export function quickValidate(response: string, userConstraints: UserConstraints): {
  hasIssues: boolean;
  criticalIssues: string[];
} {
  const criticalIssues: string[] = [];

  // Check allergies
  for (const allergy of userConstraints.allergies || []) {
    if (response.toLowerCase().includes(allergy.toLowerCase())) {
      criticalIssues.push(`Mentions allergen: ${allergy}`);
    }
  }

  // Check medical diagnosis patterns
  if (/you have \w+ disease|diagnosing you with/i.test(response)) {
    criticalIssues.push('Contains medical diagnosis');
  }

  // Check medication advice
  if (/stop taking|increase dosage|take \d+ mg/i.test(response)) {
    criticalIssues.push('Contains medication advice');
  }

  return {
    hasIssues: criticalIssues.length > 0,
    criticalIssues,
  };
}

// ============================================================================
// LLM-Based Validation (for deeper analysis)
// ============================================================================

/**
 * Use LLM to validate response for nuanced issues
 */
export async function validateWithLLM(
  context: ValidationContext,
  openai: OpenAI
): Promise<ValidationIssue[]> {
  const systemPrompt = `You are a health response validator. Analyze the following response for:
1. Conflicting advice (e.g., suggesting both rest and intense exercise)
2. Safety concerns (extreme recommendations without disclaimers)
3. Medical overreach (diagnosing conditions, prescribing medications)
4. Consistency with user constraints

User constraints:
${JSON.stringify(context.userConstraints, null, 2)}

Return a JSON array of issues found. Each issue should have:
- category: "conflict" | "safety" | "medical" | "consistency"
- severity: "info" | "warning" | "error" | "critical"
- message: brief description
- suggestion: how to fix

If no issues found, return an empty array [].`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User query: ${context.userQuery}\n\nAgent response: ${context.agentResponse}` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      category: ValidationCategory;
      severity: ValidationSeverity;
      message: string;
      suggestion?: string;
    }>;

    return parsed.map(p => ({
      id: generateIssueId(),
      category: p.category,
      severity: p.severity,
      message: p.message,
      suggestion: p.suggestion,
      autoFixable: false,
    }));
  } catch (error) {
    console.error('LLM validation failed:', error);
    return [];
  }
}

// ============================================================================
// Auto-Fix Functions
// ============================================================================

/**
 * Apply automatic fixes to response where possible
 */
export function applyAutoFixes(
  response: string,
  issues: ValidationIssue[]
): { fixedResponse: string; fixesApplied: string[] } {
  let fixedResponse = response;
  const fixesApplied: string[] = [];

  for (const issue of issues.filter(i => i.autoFixable)) {
    switch (issue.id) {
      case 'safety_extreme_fasting':
        if (!fixedResponse.includes('consult') && !fixedResponse.includes('healthcare')) {
          fixedResponse += '\n\n*Please consult with a healthcare provider before attempting extended fasting.*';
          fixesApplied.push('Added medical consultation disclaimer for fasting');
        }
        break;

      case 'medical_emergency_symptoms':
        if (!fixedResponse.toLowerCase().includes('emergency')) {
          fixedResponse = '**Important: If you are experiencing severe symptoms, please seek immediate medical attention or call emergency services.**\n\n' + fixedResponse;
          fixesApplied.push('Added emergency guidance');
        }
        break;
    }
  }

  return { fixedResponse, fixesApplied };
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format validation result for logging
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines = [
    `## Validation Result`,
    `Score: ${result.overallScore}/100 | Valid: ${result.isValid ? 'Yes' : 'No'}`,
    `Rules checked: ${result.metadata.rulesChecked} | Issues found: ${result.metadata.issuesFound}`,
    '',
  ];

  if (result.issues.length > 0) {
    lines.push('### Issues');
    for (const issue of result.issues) {
      const icon = issue.severity === 'critical' ? '🔴' :
                   issue.severity === 'error' ? '🟠' :
                   issue.severity === 'warning' ? '🟡' : '🔵';
      lines.push(`${icon} **${issue.category}**: ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`   → ${issue.suggestion}`);
      }
    }
  }

  if (result.safetyFlags.length > 0) {
    lines.push('');
    lines.push('### Safety Flags');
    for (const flag of result.safetyFlags) {
      lines.push(`⚠️ ${flag}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format issues for agent context
 */
export function formatIssuesForAgent(issues: ValidationIssue[]): string {
  if (issues.length === 0) return '';

  const critical = issues.filter(i => i.severity === 'critical');
  const errors = issues.filter(i => i.severity === 'error');

  if (critical.length === 0 && errors.length === 0) return '';

  const lines = ['## Response Validation Issues', ''];

  if (critical.length > 0) {
    lines.push('**Critical issues that must be addressed:**');
    for (const issue of critical) {
      lines.push(`- ${issue.message}`);
      if (issue.suggestion) lines.push(`  Fix: ${issue.suggestion}`);
    }
  }

  if (errors.length > 0) {
    lines.push('**Errors to correct:**');
    for (const issue of errors) {
      lines.push(`- ${issue.message}`);
      if (issue.suggestion) lines.push(`  Fix: ${issue.suggestion}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export { VALIDATION_RULES };

import { DynamicStep } from './planning-engine';
import { PlanningContext } from './context-builder';

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  score: number; // 0-100
  factors: RiskFactor[];
  requiresApproval: boolean;
  autoExecuteAllowed: boolean;
}

export interface RiskFactor {
  name: string;
  description: string;
  weight: number; // 0-1
  triggered: boolean;
}

// Risk rules by agent type
const AGENT_RISK_RULES: Record<string, RiskFactor[]> = {
  spotify: [
    {
      name: 'creates_playlist',
      description: 'Creating a new playlist is low risk',
      weight: 0.1,
      triggered: true,
    },
    {
      name: 'modifies_library',
      description: 'Modifying existing library content',
      weight: 0.3,
      triggered: false,
    },
  ],
  calendar: [
    {
      name: 'creates_event',
      description: 'Creating a new calendar event',
      weight: 0.5,
      triggered: true,
    },
    {
      name: 'modifies_existing',
      description: 'Modifying an existing event',
      weight: 0.7,
      triggered: false,
    },
    {
      name: 'invites_others',
      description: 'Event includes other participants',
      weight: 0.6,
      triggered: false,
    },
    {
      name: 'recurring_event',
      description: 'Creating a recurring event',
      weight: 0.6,
      triggered: false,
    },
  ],
  supplement: [
    {
      name: 'recommendations_only',
      description: 'Only providing supplement recommendations',
      weight: 0.2,
      triggered: true,
    },
    {
      name: 'triggers_shopping',
      description: 'Will trigger a shopping task',
      weight: 0.5,
      triggered: false,
    },
    {
      name: 'health_sensitive',
      description: 'Recommendations for health-critical supplements',
      weight: 0.6,
      triggered: false,
    },
  ],
  shopping: [
    {
      name: 'low_cost',
      description: 'Purchase under $50',
      weight: 0.3,
      triggered: false,
    },
    {
      name: 'medium_cost',
      description: 'Purchase between $50-$150',
      weight: 0.5,
      triggered: false,
    },
    {
      name: 'high_cost',
      description: 'Purchase over $150',
      weight: 0.8,
      triggered: false,
    },
    {
      name: 'requires_checkout',
      description: 'Completing actual purchase',
      weight: 0.7,
      triggered: true,
    },
    {
      name: 'uses_payment',
      description: 'Using stored payment method',
      weight: 0.6,
      triggered: true,
    },
  ],
  health_booking: [
    {
      name: 'books_appointment',
      description: 'Booking a medical appointment',
      weight: 0.8,
      triggered: true,
    },
    {
      name: 'shares_health_data',
      description: 'Sharing health data with provider',
      weight: 0.6,
      triggered: false,
    },
    {
      name: 'involves_insurance',
      description: 'Involves insurance verification',
      weight: 0.5,
      triggered: false,
    },
  ],
};

// Types that can auto-execute when low risk
const AUTO_EXECUTE_TYPES = ['spotify'];

// Types that always require approval regardless of risk
const ALWAYS_REQUIRE_APPROVAL = ['health_booking', 'shopping'];

/**
 * Assess the risk level of a task based on its type and planned steps
 */
export function assessRisk(
  task: { type: string; params?: Record<string, any> },
  steps: DynamicStep[],
  context: PlanningContext
): RiskAssessment {
  const baseRules = AGENT_RISK_RULES[task.type] || [];
  const factors: RiskFactor[] = [];

  // Evaluate base rules
  for (const rule of baseRules) {
    const factor = { ...rule };

    // Check if the factor is triggered based on task/steps
    factor.triggered = evaluateFactor(factor.name, task, steps, context);
    factors.push(factor);
  }

  // Calculate risk score (0-100)
  const triggeredFactors = factors.filter((f) => f.triggered);
  let riskScore = 0;

  if (triggeredFactors.length > 0) {
    const totalWeight = triggeredFactors.reduce((sum, f) => sum + f.weight, 0);
    riskScore = Math.min(100, (totalWeight / triggeredFactors.length) * 100);
  }

  // Determine risk level
  let level: 'low' | 'medium' | 'high';
  if (riskScore <= 30) {
    level = 'low';
  } else if (riskScore <= 60) {
    level = 'medium';
  } else {
    level = 'high';
  }

  // Determine approval requirements
  const requiresApproval =
    ALWAYS_REQUIRE_APPROVAL.includes(task.type) || level !== 'low';
  const autoExecuteAllowed =
    AUTO_EXECUTE_TYPES.includes(task.type) && level === 'low';

  return {
    level,
    score: riskScore,
    factors,
    requiresApproval,
    autoExecuteAllowed,
  };
}

/**
 * Evaluate if a specific risk factor is triggered
 */
function evaluateFactor(
  factorName: string,
  task: { type: string; params?: Record<string, any> },
  steps: DynamicStep[],
  context: PlanningContext
): boolean {
  const params = task.params || {};

  switch (factorName) {
    // Spotify factors
    case 'creates_playlist':
      return true; // Default for spotify tasks
    case 'modifies_library':
      return steps.some((s) => s.description.toLowerCase().includes('modify'));

    // Calendar factors
    case 'creates_event':
      return true; // Default for calendar tasks
    case 'modifies_existing':
      return !!params.existingEventId;
    case 'invites_others':
      return !!params.attendees && params.attendees.length > 0;
    case 'recurring_event':
      return !!params.recurrence;

    // Supplement factors
    case 'recommendations_only':
      return !params.enableShopping;
    case 'triggers_shopping':
      return !!params.enableShopping;
    case 'health_sensitive':
      return !!params.targetAreas?.some((area: string) =>
        ['heart', 'blood_pressure', 'diabetes'].includes(area.toLowerCase())
      );

    // Shopping factors
    case 'low_cost':
      return (params.estimatedCost || 0) < 50;
    case 'medium_cost':
      return (params.estimatedCost || 0) >= 50 && (params.estimatedCost || 0) < 150;
    case 'high_cost':
      return (params.estimatedCost || 0) >= 150;
    case 'requires_checkout':
      return !params.addToCartOnly;
    case 'uses_payment':
      return true; // Shopping always uses payment

    // Health booking factors
    case 'books_appointment':
      return true; // Default for health booking
    case 'shares_health_data':
      return !!params.includeHealthSummary;
    case 'involves_insurance':
      return !!params.verifyInsurance;

    default:
      return false;
  }
}

/**
 * Get a human-readable explanation of the risk assessment
 */
export function explainRisk(assessment: RiskAssessment): string {
  const triggeredFactors = assessment.factors.filter((f) => f.triggered);

  if (triggeredFactors.length === 0) {
    return 'This task has minimal risk factors.';
  }

  const explanations = triggeredFactors.map((f) => `- ${f.description}`);

  return `Risk Level: ${assessment.level.toUpperCase()} (Score: ${assessment.score.toFixed(0)}/100)\n\nRisk Factors:\n${explanations.join('\n')}`;
}

/**
 * Check if a task type can ever auto-execute
 */
export function canTypeAutoExecute(taskType: string): boolean {
  return AUTO_EXECUTE_TYPES.includes(taskType);
}

/**
 * Check if a task type always requires approval
 */
export function alwaysRequiresApproval(taskType: string): boolean {
  return ALWAYS_REQUIRE_APPROVAL.includes(taskType);
}

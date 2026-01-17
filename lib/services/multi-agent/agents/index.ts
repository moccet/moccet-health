/**
 * Agent Exports - Full Suite of 12 Specialist Agents
 */

// Health & Recovery Domain
export { RecoveryAgent } from './recovery-agent';
export { SleepAgent } from './sleep-agent';
export { GlucoseAgent } from './glucose-agent';
export { BloodAgent } from './blood-agent';

// Activity & Fitness Domain
export { ActivityAgent } from './activity-agent';
export { CardioAgent } from './cardio-agent';
export { MovementAgent } from './movement-agent';

// Work & Stress Domain
export { StressAgent } from './stress-agent';
export { CalendarAgent } from './calendar-agent';
export { DeepContentAgent } from './deep-content-agent';

// Lifestyle Domain
export { MusicAgent } from './music-agent';
export { ContextAgent } from './context-agent';
export { NutritionAgent } from './nutrition-agent';
export { TravelContextAgent } from './travel-context-agent';

// Post-processing Agents
export {
  enhanceInsights,
  getEnhancedInsights,
  hasLocationData,
} from './insight-enhancer-agent';

// Re-export base agent
export { BaseAgent } from '../base-agent';

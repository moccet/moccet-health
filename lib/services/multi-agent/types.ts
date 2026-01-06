/**
 * Multi-Agent Insight Generation System - Types
 */

// ============================================================
// AGENT INSIGHT TYPES
// ============================================================

export interface AgentInsight {
  id: string;
  title: string;
  finding: string;
  dataQuote: string; // Must contain specific numbers
  recommendation: string;
  scienceExplanation: string;
  actionSteps: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  sources: string[];
  crossDomainRelevance?: string; // Which other domain this relates to
}

export interface AgentFinding {
  agentId: string;
  agentName: string;
  domain: AgentDomain;
  insights: AgentInsight[];
  confidence: number;
  dataPointsUsed: string[];
  potentialConflicts: string[]; // IDs of other agents this might conflict with
  analyzedAt: Date;
  processingTimeMs: number;
}

// ============================================================
// AGENT CONFIGURATION
// ============================================================

export type AgentDomain =
  | 'RECOVERY'
  | 'SLEEP'
  | 'GLUCOSE'
  | 'STRESS'
  | 'BLOOD'
  | 'ACTIVITY'
  | 'CARDIO'
  | 'MOVEMENT'
  | 'MUSIC'
  | 'CONTEXT'
  | 'NUTRITION'
  | 'CALENDAR';

export type DataSource =
  | 'whoop'
  | 'oura'
  | 'dexcom'
  | 'gmail'
  | 'slack'
  | 'outlook'
  | 'teams'
  | 'apple_health'
  | 'fitbit'
  | 'strava'
  | 'spotify'
  | 'blood_biomarkers'
  | 'vital';

export interface AgentConfig {
  agentId: string;
  agentName: string;
  domain: AgentDomain;
  requiredDataSources: DataSource[];
  optionalDataSources: DataSource[];
  insightCategory: string;
}

// ============================================================
// CONFLICT RESOLUTION
// ============================================================

export interface AgentConflict {
  id: string;
  insight1: AgentInsight;
  agent1Id: string;
  insight2: AgentInsight;
  agent2Id: string;
  conflictType: 'CONTRADICTORY' | 'PRIORITY' | 'TIMING';
  description: string;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'AGENT1_WINS' | 'AGENT2_WINS' | 'SYNTHESIS' | 'BOTH_VALID';
  synthesizedInsight?: AgentInsight;
  rationale: string;
  confidence: number;
}

// ============================================================
// CROSS-DOMAIN INSIGHTS
// ============================================================

export interface CrossDomainInsight {
  id: string;
  title: string;
  dataQuote: string;
  recommendation: string;
  scienceExplanation: string;
  actionSteps: string[];
  contributingAgents: string[];
  sources: string[];
  correlation: string; // How the domains are connected
  confidence: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================================
// EXECUTION CONFIG
// ============================================================

export type ExecutionMode = 'quick' | 'standard' | 'deep';

export interface ExecutionConfig {
  mode: ExecutionMode;
  maxAgents: number;
  enableDebate: boolean;
  enableCrossDomainSynthesis: boolean;
  enableDeepContentAnalysis: boolean;
  timeoutMs: number;
}

export const EXECUTION_CONFIGS: Record<ExecutionMode, ExecutionConfig> = {
  quick: {
    mode: 'quick',
    maxAgents: 3,
    enableDebate: false,
    enableCrossDomainSynthesis: false,
    enableDeepContentAnalysis: false,
    timeoutMs: 15000,
  },
  standard: {
    mode: 'standard',
    maxAgents: 12,
    enableDebate: true,
    enableCrossDomainSynthesis: true,
    enableDeepContentAnalysis: false,
    timeoutMs: 30000,
  },
  deep: {
    mode: 'deep',
    maxAgents: 12,
    enableDebate: true,
    enableCrossDomainSynthesis: true,
    enableDeepContentAnalysis: true,
    timeoutMs: 60000,
  },
};

// ============================================================
// ORCHESTRATOR RESULT
// ============================================================

export interface MultiAgentResult {
  agentFindings: AgentFinding[];
  conflicts: AgentConflict[];
  resolutions: ConflictResolution[];
  crossDomainInsights: CrossDomainInsight[];
  finalInsights: StructuredInsight[];
  totalProcessingTimeMs: number;
  apiCallsUsed: number;
  mode: ExecutionMode;
}

// ============================================================
// FINAL INSIGHT FORMAT (matches Flutter model)
// ============================================================

export interface StructuredInsight {
  id: string;
  category: string;
  designCategory?: 'PREDICTION' | 'OPTIMIZATION' | 'ANALYSIS' | 'IKIGAI' | 'SOCIAL';
  title: string;
  dataQuote: string;
  recommendation: string;
  sources: string[];
  impact: string;
  confidence: number;
  scienceExplanation: string;
  actionSteps: string[];
  searchTerms?: string;
  contributingAgents?: string[];
}

// ============================================================
// USER CONTEXT FOR AGENTS
// ============================================================

export interface UserContext {
  email: string;
  userId?: string;

  // Connector data (fetched from database)
  whoop?: WhoopData;
  oura?: OuraData;
  dexcom?: DexcomData;
  gmail?: GmailPatterns;
  slack?: SlackPatterns;
  appleHealth?: AppleHealthData;
  bloodBiomarkers?: BloodBiomarkers;
  spotify?: SpotifyData;
  strava?: StravaData;
  fitbit?: FitbitData;

  // Life context for deep analysis
  lifeContext?: LifeContext;

  // Available data sources
  availableDataSources: DataSource[];
}

// Data type interfaces (simplified - actual types may be more complex)
export interface WhoopData {
  avgRecoveryScore?: number;
  avgStrainScore?: number;
  avgHRV?: number;
  avgRestingHR?: number;
  recoveryTrend?: string;
  strainTrend?: string;
  recoveryZones?: {
    greenDays: number;
    yellowDays: number;
    redDays: number;
  };
  hrvPatterns?: {
    baseline: number;
    currentWeekAvg: number;
    trend: string;
  };
  sleepPerformance?: number;
}

export interface OuraData {
  avgSleepScore?: number;
  avgReadinessScore?: number;
  avgHRV?: number;
  sleepArchitecture?: {
    deepSleepPercent: number;
    remSleepPercent: number;
    lightSleepPercent: number;
    avgDeepSleepMins: number;
    avgRemSleepMins: number;
    sleepEfficiency: number;
  };
  sleepConsistency?: {
    avgBedtime: string;
    avgWakeTime: string;
    bedtimeVariability: number;
    consistencyScore: number;
  };
  sleepDebt?: {
    accumulatedHours: number;
    weeklyDeficit: number;
  };
}

export interface DexcomData {
  avgGlucose?: number;
  avgFastingGlucose?: number;
  glucoseVariability?: number;
  timeInRange?: number;
  spikeTimes?: string[];
  spikeEvents?: Array<{ time: string; value: number; trigger?: string }>;
}

export interface GmailPatterns {
  meetingDensity?: {
    peakHours: string[];
    avgMeetingsPerDay: number;
    backToBackPercentage: number;
  };
  emailVolume?: {
    avgPerDay: number;
    peakHours: string[];
    afterHoursPercentage: number;
  };
  focusTime?: {
    avgFocusBlocksPerDay: number;
    longestFocusBlock: number;
    meetingFreeDays: number;
    focusScore: string;
  };
  stressIndicators?: {
    highEmailVolume: boolean;
    frequentAfterHoursWork: boolean;
    shortMeetingBreaks: boolean;
  };
}

export interface SlackPatterns {
  messageVolume?: {
    avgPerDay: number;
    peakHours: string[];
    afterHoursPercentage: number;
  };
  collaborationIntensity?: string;
  stressIndicators?: {
    constantAvailability: boolean;
    lateNightMessages: boolean;
    noBreakPeriods: boolean;
  };
  focusMetrics?: {
    deepWorkWindows: number;
    longestFocusPeriod: number;
    contextSwitchingScore: string;
  };
}

export interface AppleHealthData {
  steps?: { average: number; trend: string };
  activeEnergy?: { average: number };
  heartRate?: { average: number; resting: number };
  sleep?: { averageHours: number; quality: string };
  workouts?: Array<{ type: string; duration: number; calories: number }>;
}

export interface BloodBiomarkers {
  summary?: string;
  concerns?: string[];
  positives?: string[];
  biomarkers?: Array<{
    name: string;
    value: number;
    unit: string;
    status: string;
    healthImplications?: string;
  }>;
}

export interface SpotifyData {
  recentTracks?: Array<{ name: string; artist: string; playedAt: string }>;
  topGenres?: string[];
  listeningPatterns?: {
    peakHours: string[];
    avgDailyMinutes: number;
  };
  moodIndicators?: {
    energyLevel: number;
    valence: number;
  };
}

export interface StravaData {
  recentWorkouts?: Array<{
    type: string;
    duration: number;
    distance: number;
    avgHeartRate?: number;
  }>;
  weeklyStats?: {
    totalDistance: number;
    totalDuration: number;
    workoutCount: number;
  };
}

export interface FitbitData {
  steps?: { daily: number; weeklyAvg: number };
  sleep?: { duration: number; efficiency: number };
  heartRate?: { resting: number; zones: Record<string, number> };
  activeMinutes?: number;
}

export interface LifeContext {
  upcomingEvents?: Array<{
    type: string;
    description: string;
    date: string;
    urgency: string;
  }>;
  activePatterns?: Array<{
    type: string;
    description: string;
    intensity: string;
  }>;
  workContext?: {
    recentSuccesses?: string[];
    ongoingChallenges?: string[];
    teamDynamics?: string;
  };
}

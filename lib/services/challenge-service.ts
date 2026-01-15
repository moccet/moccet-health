/**
 * Challenge Service
 *
 * Manages time-limited health and fitness challenges for engagement.
 * Supports individual, group, and global challenges with various metrics.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type ChallengeType = 'individual' | 'group' | 'global';
export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ChallengeMetric =
  | 'total_steps'
  | 'active_minutes'
  | 'sleep_score_avg'
  | 'glucose_time_in_range'
  | 'workout_count'
  | 'meditation_minutes'
  | 'water_intake'
  | 'check_in_streak'
  | 'weight_loss_percentage'
  | 'custom';

export type ChallengeDuration = '3_days' | '1_week' | '2_weeks' | '1_month' | 'custom';

export interface Challenge {
  id: string;
  type: ChallengeType;
  name: string;
  description: string;
  metric: ChallengeMetric;
  customMetricConfig?: {
    tableName: string;
    column: string;
    aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  };
  target: number;
  targetUnit: string;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  creatorEmail?: string;
  groupId?: string;
  participantCount: number;
  prizeDescription?: string;
  imageUrl?: string;
  rules: string[];
  minParticipants: number;
  maxParticipants?: number;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
}

export interface ChallengeParticipant {
  challengeId: string;
  userEmail: string;
  displayName: string;
  avatarUrl?: string;
  currentProgress: number;
  progressPercentage: number;
  rank: number;
  joinedAt: string;
  lastActivityAt?: string;
  isCompleted: boolean;
  completedAt?: string;
  badges: string[];
}

export interface ChallengeProgress {
  challengeId: string;
  userEmail: string;
  currentValue: number;
  targetValue: number;
  progressPercentage: number;
  rank: number;
  totalParticipants: number;
  daysRemaining: number;
  projectedCompletion: boolean;
  dailyProgress: Array<{
    date: string;
    value: number;
  }>;
  milestones: Array<{
    percentage: number;
    reached: boolean;
    reachedAt?: string;
  }>;
}

export interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  metric: ChallengeMetric;
  suggestedTarget: number;
  targetUnit: string;
  suggestedDuration: ChallengeDuration;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  category: string;
  tags: string[];
  imageUrl?: string;
  popularityScore: number;
}

// ============================================================================
// Configuration
// ============================================================================

const METRIC_CONFIG: Record<ChallengeMetric, {
  tableName: string;
  column: string;
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  defaultTarget: number;
  unit: string;
  description: string;
}> = {
  total_steps: {
    tableName: 'daily_metrics',
    column: 'steps',
    aggregation: 'sum',
    defaultTarget: 70000,
    unit: 'steps',
    description: 'Total steps walked during challenge',
  },
  active_minutes: {
    tableName: 'daily_metrics',
    column: 'active_minutes',
    aggregation: 'sum',
    defaultTarget: 300,
    unit: 'minutes',
    description: 'Total active minutes during challenge',
  },
  sleep_score_avg: {
    tableName: 'sleep_logs',
    column: 'score',
    aggregation: 'avg',
    defaultTarget: 80,
    unit: 'score',
    description: 'Average sleep score during challenge',
  },
  glucose_time_in_range: {
    tableName: 'glucose_readings',
    column: 'value',
    aggregation: 'avg',
    defaultTarget: 80,
    unit: '%',
    description: 'Percentage of time with glucose in healthy range',
  },
  workout_count: {
    tableName: 'workouts',
    column: 'id',
    aggregation: 'count',
    defaultTarget: 7,
    unit: 'workouts',
    description: 'Number of workouts completed',
  },
  meditation_minutes: {
    tableName: 'meditation_logs',
    column: 'duration_minutes',
    aggregation: 'sum',
    defaultTarget: 100,
    unit: 'minutes',
    description: 'Total meditation time',
  },
  water_intake: {
    tableName: 'water_logs',
    column: 'amount_ml',
    aggregation: 'sum',
    defaultTarget: 14000,
    unit: 'ml',
    description: 'Total water consumed',
  },
  check_in_streak: {
    tableName: 'daily_checkins',
    column: 'id',
    aggregation: 'count',
    defaultTarget: 7,
    unit: 'days',
    description: 'Consecutive check-in days',
  },
  weight_loss_percentage: {
    tableName: 'weight_logs',
    column: 'weight',
    aggregation: 'avg',
    defaultTarget: 2,
    unit: '%',
    description: 'Percentage of body weight lost',
  },
  custom: {
    tableName: '',
    column: '',
    aggregation: 'sum',
    defaultTarget: 100,
    unit: 'units',
    description: 'Custom metric',
  },
};

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'step-warrior',
    name: 'Step Warrior',
    description: 'Walk 10,000 steps every day for a week',
    metric: 'total_steps',
    suggestedTarget: 70000,
    targetUnit: 'steps',
    suggestedDuration: '1_week',
    difficulty: 'medium',
    category: 'activity',
    tags: ['steps', 'walking', 'cardio'],
    popularityScore: 95,
  },
  {
    id: 'sleep-master',
    name: 'Sleep Master',
    description: 'Achieve an average sleep score of 85+ for two weeks',
    metric: 'sleep_score_avg',
    suggestedTarget: 85,
    targetUnit: 'score',
    suggestedDuration: '2_weeks',
    difficulty: 'hard',
    category: 'sleep',
    tags: ['sleep', 'recovery', 'wellness'],
    popularityScore: 88,
  },
  {
    id: 'active-achiever',
    name: 'Active Achiever',
    description: 'Log 30 active minutes daily for a month',
    metric: 'active_minutes',
    suggestedTarget: 900,
    targetUnit: 'minutes',
    suggestedDuration: '1_month',
    difficulty: 'hard',
    category: 'activity',
    tags: ['exercise', 'fitness', 'cardio'],
    popularityScore: 82,
  },
  {
    id: 'hydration-hero',
    name: 'Hydration Hero',
    description: 'Drink 2L of water daily for a week',
    metric: 'water_intake',
    suggestedTarget: 14000,
    targetUnit: 'ml',
    suggestedDuration: '1_week',
    difficulty: 'easy',
    category: 'nutrition',
    tags: ['hydration', 'water', 'health'],
    popularityScore: 90,
  },
  {
    id: 'mindful-march',
    name: 'Mindful March',
    description: 'Meditate for 100 minutes total this week',
    metric: 'meditation_minutes',
    suggestedTarget: 100,
    targetUnit: 'minutes',
    suggestedDuration: '1_week',
    difficulty: 'medium',
    category: 'mindfulness',
    tags: ['meditation', 'stress', 'mental health'],
    popularityScore: 75,
  },
  {
    id: 'workout-warrior',
    name: 'Workout Warrior',
    description: 'Complete 12 workouts in two weeks',
    metric: 'workout_count',
    suggestedTarget: 12,
    targetUnit: 'workouts',
    suggestedDuration: '2_weeks',
    difficulty: 'hard',
    category: 'activity',
    tags: ['workout', 'strength', 'fitness'],
    popularityScore: 85,
  },
  {
    id: 'glucose-guardian',
    name: 'Glucose Guardian',
    description: 'Keep glucose in range 80% of the time for a week',
    metric: 'glucose_time_in_range',
    suggestedTarget: 80,
    targetUnit: '%',
    suggestedDuration: '1_week',
    difficulty: 'hard',
    category: 'metabolic',
    tags: ['glucose', 'cgm', 'metabolic'],
    popularityScore: 70,
  },
  {
    id: 'consistency-king',
    name: 'Consistency King',
    description: 'Check in every day for 30 days straight',
    metric: 'check_in_streak',
    suggestedTarget: 30,
    targetUnit: 'days',
    suggestedDuration: '1_month',
    difficulty: 'extreme',
    category: 'habits',
    tags: ['consistency', 'habits', 'streak'],
    popularityScore: 78,
  },
];

const MILESTONES = [25, 50, 75, 100];

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDurationDays(duration: ChallengeDuration): number {
  switch (duration) {
    case '3_days': return 3;
    case '1_week': return 7;
    case '2_weeks': return 14;
    case '1_month': return 30;
    default: return 7;
  }
}

function calculateDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function calculateProjectedCompletion(
  currentProgress: number,
  target: number,
  daysElapsed: number,
  totalDays: number
): boolean {
  if (currentProgress >= target) return true;
  if (daysElapsed === 0) return false;

  const dailyRate = currentProgress / daysElapsed;
  const daysRemaining = totalDays - daysElapsed;
  const projectedFinal = currentProgress + (dailyRate * daysRemaining);

  return projectedFinal >= target;
}

// ============================================================================
// Challenge Management Functions
// ============================================================================

export async function createChallenge(
  challenge: Omit<Challenge, 'id' | 'participantCount' | 'status' | 'createdAt'>,
  supabase: SupabaseClient
): Promise<Challenge> {
  const newChallenge: Challenge = {
    ...challenge,
    id: generateId(),
    participantCount: 0,
    status: new Date(challenge.startDate) > new Date() ? 'upcoming' : 'active',
    createdAt: new Date().toISOString(),
  };

  await supabase.from('challenges').insert({
    id: newChallenge.id,
    type: newChallenge.type,
    name: newChallenge.name,
    description: newChallenge.description,
    metric: newChallenge.metric,
    custom_metric_config: newChallenge.customMetricConfig,
    target: newChallenge.target,
    target_unit: newChallenge.targetUnit,
    start_date: newChallenge.startDate,
    end_date: newChallenge.endDate,
    status: newChallenge.status,
    creator_email: newChallenge.creatorEmail,
    group_id: newChallenge.groupId,
    prize_description: newChallenge.prizeDescription,
    image_url: newChallenge.imageUrl,
    rules: newChallenge.rules,
    min_participants: newChallenge.minParticipants,
    max_participants: newChallenge.maxParticipants,
    is_public: newChallenge.isPublic,
    tags: newChallenge.tags,
    created_at: newChallenge.createdAt,
  });

  return newChallenge;
}

export async function createChallengeFromTemplate(
  templateId: string,
  options: {
    type: ChallengeType;
    creatorEmail?: string;
    groupId?: string;
    startDate?: string;
    customTarget?: number;
    customDuration?: ChallengeDuration;
    isPublic?: boolean;
  },
  supabase: SupabaseClient
): Promise<Challenge | null> {
  const template = CHALLENGE_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  const duration = options.customDuration || template.suggestedDuration;
  const durationDays = getDurationDays(duration);
  const startDate = options.startDate || new Date().toISOString().split('T')[0];
  const endDate = new Date(new Date(startDate).getTime() + durationDays * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  return createChallenge({
    type: options.type,
    name: template.name,
    description: template.description,
    metric: template.metric,
    target: options.customTarget || template.suggestedTarget,
    targetUnit: template.targetUnit,
    startDate,
    endDate,
    creatorEmail: options.creatorEmail,
    groupId: options.groupId,
    rules: [
      `Complete ${options.customTarget || template.suggestedTarget} ${template.targetUnit} by the end date`,
      'Progress is tracked automatically from connected devices',
      'Rankings are updated hourly',
    ],
    minParticipants: options.type === 'individual' ? 1 : 2,
    isPublic: options.isPublic ?? true,
    tags: template.tags,
  }, supabase);
}

export async function joinChallenge(
  challengeId: string,
  userEmail: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  // Get challenge
  const { data: challengeData } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single();

  if (!challengeData) {
    return { success: false, error: 'Challenge not found' };
  }

  type ChallengeRow = {
    status: string;
    max_participants?: number;
    participant_count: number;
  };
  const challenge = challengeData as ChallengeRow;

  if (challenge.status !== 'upcoming' && challenge.status !== 'active') {
    return { success: false, error: 'Challenge is not open for joining' };
  }

  if (challenge.max_participants && challenge.participant_count >= challenge.max_participants) {
    return { success: false, error: 'Challenge is full' };
  }

  // Check if already joined
  const { data: existing } = await supabase
    .from('challenge_participants')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_email', userEmail)
    .single();

  if (existing) {
    return { success: false, error: 'Already joined this challenge' };
  }

  // Get user info
  const { data: userData } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('email', userEmail)
    .single();

  type UserRow = { name?: string; avatar_url?: string };
  const user = userData as UserRow | null;

  // Join challenge
  await supabase.from('challenge_participants').insert({
    challenge_id: challengeId,
    user_email: userEmail,
    display_name: user?.name || userEmail.split('@')[0],
    avatar_url: user?.avatar_url,
    current_progress: 0,
    progress_percentage: 0,
    rank: 0,
    joined_at: new Date().toISOString(),
    is_completed: false,
  });

  // Update participant count
  await supabase
    .from('challenges')
    .update({ participant_count: challenge.participant_count + 1 })
    .eq('id', challengeId);

  return { success: true };
}

export async function leaveChallenge(
  challengeId: string,
  userEmail: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const { data: participant } = await supabase
    .from('challenge_participants')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_email', userEmail)
    .single();

  if (!participant) {
    return { success: false, error: 'Not a participant in this challenge' };
  }

  await supabase
    .from('challenge_participants')
    .delete()
    .eq('challenge_id', challengeId)
    .eq('user_email', userEmail);

  // Update participant count
  await supabase.rpc('decrement_participant_count', { challenge_id: challengeId });

  return { success: true };
}

// ============================================================================
// Progress Tracking Functions
// ============================================================================

export async function calculateUserProgress(
  challengeId: string,
  userEmail: string,
  supabase: SupabaseClient
): Promise<number> {
  // Get challenge details
  const { data: challengeData } = await supabase
    .from('challenges')
    .select('metric, custom_metric_config, start_date, end_date')
    .eq('id', challengeId)
    .single();

  if (!challengeData) return 0;

  type ChallengeRow = {
    metric: ChallengeMetric;
    custom_metric_config?: { tableName: string; column: string; aggregation: string };
    start_date: string;
    end_date: string;
  };
  const challenge = challengeData as ChallengeRow;

  const config = challenge.metric === 'custom' && challenge.custom_metric_config
    ? challenge.custom_metric_config
    : METRIC_CONFIG[challenge.metric];

  if (!config || !config.tableName) return 0;

  // Special handling for different metrics
  if (challenge.metric === 'glucose_time_in_range') {
    return calculateGlucoseTIR(userEmail, challenge.start_date, challenge.end_date, supabase);
  }

  if (challenge.metric === 'weight_loss_percentage') {
    return calculateWeightLossPercentage(userEmail, challenge.start_date, supabase);
  }

  // Generic aggregation query
  const dateField = ['daily_metrics', 'sleep_logs', 'daily_checkins'].includes(config.tableName)
    ? 'date'
    : 'created_at';

  let query = supabase
    .from(config.tableName)
    .select(config.column)
    .eq('user_email', userEmail)
    .gte(dateField, challenge.start_date)
    .lte(dateField, challenge.end_date);

  const { data } = await query;
  if (!data || data.length === 0) return 0;

  // Calculate based on aggregation type
  type DataRow = Record<string, number>;
  const values = (data as unknown as DataRow[]).map(row => row[config.column]).filter(v => v != null);

  switch (config.aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    case 'count':
      return values.length;
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    default:
      return 0;
  }
}

async function calculateGlucoseTIR(
  userEmail: string,
  startDate: string,
  endDate: string,
  supabase: SupabaseClient
): Promise<number> {
  const { data } = await supabase
    .from('glucose_readings')
    .select('value')
    .eq('user_email', userEmail)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  if (!data || data.length === 0) return 0;

  type GlucoseRow = { value: number };
  const readings = data as GlucoseRow[];
  const inRangeCount = readings.filter(r => r.value >= 70 && r.value <= 140).length;

  return Math.round((inRangeCount / readings.length) * 100);
}

async function calculateWeightLossPercentage(
  userEmail: string,
  startDate: string,
  supabase: SupabaseClient
): Promise<number> {
  // Get starting weight
  const { data: startWeight } = await supabase
    .from('weight_logs')
    .select('weight')
    .eq('user_email', userEmail)
    .lte('date', startDate)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (!startWeight) return 0;

  // Get current weight
  const { data: currentWeight } = await supabase
    .from('weight_logs')
    .select('weight')
    .eq('user_email', userEmail)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (!currentWeight) return 0;

  type WeightRow = { weight: number };
  const start = (startWeight as WeightRow).weight;
  const current = (currentWeight as WeightRow).weight;

  if (start <= 0) return 0;

  const percentageLost = ((start - current) / start) * 100;
  return Math.max(0, Math.round(percentageLost * 10) / 10);
}

export async function updateChallengeProgress(
  challengeId: string,
  supabase: SupabaseClient
): Promise<void> {
  // Get challenge
  const { data: challengeData } = await supabase
    .from('challenges')
    .select('target, start_date, end_date')
    .eq('id', challengeId)
    .single();

  if (!challengeData) return;

  type ChallengeRow = { target: number; start_date: string; end_date: string };
  const challenge = challengeData as ChallengeRow;

  // Get all participants
  const { data: participants } = await supabase
    .from('challenge_participants')
    .select('user_email')
    .eq('challenge_id', challengeId);

  if (!participants) return;

  type ParticipantRow = { user_email: string };
  const participantList = participants as ParticipantRow[];

  // Calculate progress for each participant
  const progressData = await Promise.all(
    participantList.map(async (p) => {
      const progress = await calculateUserProgress(challengeId, p.user_email, supabase);
      return {
        userEmail: p.user_email,
        progress,
        percentage: Math.min(100, Math.round((progress / challenge.target) * 100)),
      };
    })
  );

  // Sort by progress and assign ranks
  progressData.sort((a, b) => b.progress - a.progress);

  // Update each participant
  for (let i = 0; i < progressData.length; i++) {
    const p = progressData[i];
    const isCompleted = p.progress >= challenge.target;

    await supabase
      .from('challenge_participants')
      .update({
        current_progress: p.progress,
        progress_percentage: p.percentage,
        rank: i + 1,
        last_activity_at: new Date().toISOString(),
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('challenge_id', challengeId)
      .eq('user_email', p.userEmail);
  }
}

export async function getChallengeProgress(
  challengeId: string,
  userEmail: string,
  supabase: SupabaseClient
): Promise<ChallengeProgress | null> {
  // Get challenge
  const { data: challengeData } = await supabase
    .from('challenges')
    .select('target, start_date, end_date')
    .eq('id', challengeId)
    .single();

  if (!challengeData) return null;

  type ChallengeRow = { target: number; start_date: string; end_date: string };
  const challenge = challengeData as ChallengeRow;

  // Get participant data
  const { data: participantData } = await supabase
    .from('challenge_participants')
    .select('current_progress, rank')
    .eq('challenge_id', challengeId)
    .eq('user_email', userEmail)
    .single();

  if (!participantData) return null;

  type ParticipantRow = { current_progress: number; rank: number };
  const participant = participantData as ParticipantRow;

  // Get total participants
  const { count } = await supabase
    .from('challenge_participants')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_id', challengeId);

  // Get daily progress
  const { data: dailyData } = await supabase
    .from('challenge_daily_progress')
    .select('date, value')
    .eq('challenge_id', challengeId)
    .eq('user_email', userEmail)
    .order('date', { ascending: true });

  type DailyRow = { date: string; value: number };
  const dailyProgress = (dailyData as DailyRow[] | null) || [];

  // Calculate days
  const startDate = new Date(challenge.start_date);
  const endDate = new Date(challenge.end_date);
  const now = new Date();
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = calculateDaysRemaining(challenge.end_date);

  // Calculate milestones
  const progressPercentage = Math.min(100, Math.round((participant.current_progress / challenge.target) * 100));
  const milestones = MILESTONES.map(pct => ({
    percentage: pct,
    reached: progressPercentage >= pct,
    reachedAt: progressPercentage >= pct ? new Date().toISOString() : undefined,
  }));

  return {
    challengeId,
    userEmail,
    currentValue: participant.current_progress,
    targetValue: challenge.target,
    progressPercentage,
    rank: participant.rank,
    totalParticipants: count || 0,
    daysRemaining,
    projectedCompletion: calculateProjectedCompletion(
      participant.current_progress,
      challenge.target,
      daysElapsed,
      totalDays
    ),
    dailyProgress: dailyProgress.map(d => ({ date: d.date, value: d.value })),
    milestones,
  };
}

// ============================================================================
// Query Functions
// ============================================================================

export async function getActiveChallenges(
  userEmail: string,
  supabase: SupabaseClient
): Promise<Array<Challenge & { userProgress?: ChallengeProgress }>> {
  // Get user's active challenges
  const { data: participations } = await supabase
    .from('challenge_participants')
    .select('challenge_id')
    .eq('user_email', userEmail);

  if (!participations || participations.length === 0) return [];

  type PartRow = { challenge_id: string };
  const challengeIds = (participations as PartRow[]).map(p => p.challenge_id);

  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .in('id', challengeIds)
    .eq('status', 'active');

  if (!challenges) return [];

  // Add progress to each challenge
  const results = await Promise.all(
    challenges.map(async (c) => {
      const progress = await getChallengeProgress(c.id, userEmail, supabase);
      return {
        ...mapChallengeRow(c),
        userProgress: progress || undefined,
      };
    })
  );

  return results;
}

export async function getAvailableChallenges(
  userEmail: string,
  options: {
    type?: ChallengeType;
    category?: string;
    excludeJoined?: boolean;
  },
  supabase: SupabaseClient
): Promise<Challenge[]> {
  let query = supabase
    .from('challenges')
    .select('*')
    .in('status', ['upcoming', 'active'])
    .eq('is_public', true);

  if (options.type) {
    query = query.eq('type', options.type);
  }

  if (options.category) {
    query = query.contains('tags', [options.category]);
  }

  const { data: challenges } = await query;
  if (!challenges) return [];

  if (options.excludeJoined) {
    // Get user's joined challenges
    const { data: joined } = await supabase
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_email', userEmail);

    type JoinedRow = { challenge_id: string };
    const joinedIds = new Set((joined as JoinedRow[] || []).map(j => j.challenge_id));

    return challenges
      .filter(c => !joinedIds.has(c.id))
      .map(mapChallengeRow);
  }

  return challenges.map(mapChallengeRow);
}

export async function getChallengeLeaderboard(
  challengeId: string,
  limit: number = 50,
  supabase: SupabaseClient
): Promise<ChallengeParticipant[]> {
  const { data } = await supabase
    .from('challenge_participants')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('rank', { ascending: true })
    .limit(limit);

  if (!data) return [];

  return data.map(mapParticipantRow);
}

export function getChallengeTemplates(
  options?: {
    category?: string;
    difficulty?: string;
  }
): ChallengeTemplate[] {
  let templates = [...CHALLENGE_TEMPLATES];

  if (options?.category) {
    templates = templates.filter(t => t.category === options.category);
  }

  if (options?.difficulty) {
    templates = templates.filter(t => t.difficulty === options.difficulty);
  }

  return templates.sort((a, b) => b.popularityScore - a.popularityScore);
}

// ============================================================================
// Status Management
// ============================================================================

export async function updateChallengeStatuses(
  supabase: SupabaseClient
): Promise<{ started: number; ended: number }> {
  const now = new Date().toISOString();
  let started = 0;
  let ended = 0;

  // Activate upcoming challenges
  const { data: toStart } = await supabase
    .from('challenges')
    .select('id')
    .eq('status', 'upcoming')
    .lte('start_date', now);

  if (toStart && toStart.length > 0) {
    type IdRow = { id: string };
    const ids = (toStart as IdRow[]).map(c => c.id);

    await supabase
      .from('challenges')
      .update({ status: 'active' })
      .in('id', ids);

    started = ids.length;
  }

  // Complete ended challenges
  const { data: toEnd } = await supabase
    .from('challenges')
    .select('id')
    .eq('status', 'active')
    .lt('end_date', now);

  if (toEnd && toEnd.length > 0) {
    type IdRow = { id: string };
    const ids = (toEnd as IdRow[]).map(c => c.id);

    await supabase
      .from('challenges')
      .update({ status: 'completed' })
      .in('id', ids);

    ended = ids.length;
  }

  return { started, ended };
}

// ============================================================================
// Helper Mappers
// ============================================================================

function mapChallengeRow(row: Record<string, unknown>): Challenge {
  return {
    id: row.id as string,
    type: row.type as ChallengeType,
    name: row.name as string,
    description: row.description as string,
    metric: row.metric as ChallengeMetric,
    customMetricConfig: row.custom_metric_config as Challenge['customMetricConfig'],
    target: row.target as number,
    targetUnit: row.target_unit as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    status: row.status as ChallengeStatus,
    creatorEmail: row.creator_email as string | undefined,
    groupId: row.group_id as string | undefined,
    participantCount: row.participant_count as number,
    prizeDescription: row.prize_description as string | undefined,
    imageUrl: row.image_url as string | undefined,
    rules: row.rules as string[],
    minParticipants: row.min_participants as number,
    maxParticipants: row.max_participants as number | undefined,
    isPublic: row.is_public as boolean,
    tags: row.tags as string[],
    createdAt: row.created_at as string,
  };
}

function mapParticipantRow(row: Record<string, unknown>): ChallengeParticipant {
  return {
    challengeId: row.challenge_id as string,
    userEmail: row.user_email as string,
    displayName: row.display_name as string,
    avatarUrl: row.avatar_url as string | undefined,
    currentProgress: row.current_progress as number,
    progressPercentage: row.progress_percentage as number,
    rank: row.rank as number,
    joinedAt: row.joined_at as string,
    lastActivityAt: row.last_activity_at as string | undefined,
    isCompleted: row.is_completed as boolean,
    completedAt: row.completed_at as string | undefined,
    badges: (row.badges as string[]) || [],
  };
}

// ============================================================================
// Agent Formatting
// ============================================================================

export function formatChallengesForAgent(
  challenges: Array<Challenge & { userProgress?: ChallengeProgress }>
): string {
  if (challenges.length === 0) {
    return 'No active challenges.';
  }

  const lines = ['## Active Challenges', ''];

  for (const c of challenges) {
    lines.push(`**${c.name}** (${c.type})`);
    lines.push(`- Metric: ${c.metric.replace('_', ' ')}`);
    lines.push(`- Target: ${c.target} ${c.targetUnit}`);

    if (c.userProgress) {
      lines.push(`- Progress: ${c.userProgress.currentValue}/${c.userProgress.targetValue} (${c.userProgress.progressPercentage}%)`);
      lines.push(`- Rank: #${c.userProgress.rank} of ${c.userProgress.totalParticipants}`);
      lines.push(`- Days remaining: ${c.userProgress.daysRemaining}`);
      if (c.userProgress.projectedCompletion) {
        lines.push(`- On track to complete!`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

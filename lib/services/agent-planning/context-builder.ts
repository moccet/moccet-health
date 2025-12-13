import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UserProfile {
  email: string;
  name?: string;
  goals?: string[];
  preferences?: Record<string, any>;
  connectedServices: string[];
}

export interface CalendarContext {
  upcomingEvents: Array<{
    title: string;
    start: string;
    end: string;
  }>;
  busySlots: Array<{
    start: string;
    end: string;
  }>;
  workingHours?: {
    start: number;
    end: number;
  };
}

export interface HealthContext {
  recentMetrics?: {
    avgHRV?: number;
    avgSleep?: number;
    readinessScore?: number;
    stressLevel?: string;
  };
  biomarkers?: Record<string, any>;
}

export interface Constraint {
  type: string;
  description: string;
  severity: 'soft' | 'hard';
}

export interface PlanningContext {
  userProfile: UserProfile;
  calendar?: CalendarContext;
  health?: HealthContext;
  constraints: Constraint[];
  availableData: string[];
  previousPlan?: any;
  failureReason?: string;
}

export interface BuildContextOptions {
  previousPlan?: any;
  failureReason?: string;
}

/**
 * Build comprehensive context for the planning phase
 */
export async function buildPlanningContext(
  task: { type: string; params?: Record<string, any>; user_email?: string },
  userEmail: string,
  options?: BuildContextOptions
): Promise<PlanningContext> {
  // Fetch user profile and connected services
  const userProfile = await fetchUserProfile(userEmail);

  // Build context based on task type
  const context: PlanningContext = {
    userProfile,
    constraints: [],
    availableData: [],
    previousPlan: options?.previousPlan,
    failureReason: options?.failureReason,
  };

  // Add task-specific context
  switch (task.type) {
    case 'calendar':
      context.calendar = await fetchCalendarContext(userEmail);
      context.availableData.push('calendar');
      context.constraints.push({
        type: 'calendar',
        description: 'Must not overlap with existing events',
        severity: 'hard',
      });
      break;

    case 'spotify':
      context.availableData.push('spotify');
      // Spotify tasks are simple - minimal context needed
      break;

    case 'supplement':
      context.health = await fetchHealthContext(userEmail);
      context.availableData.push('biomarkers', 'health_metrics');
      break;

    case 'health_booking':
      context.calendar = await fetchCalendarContext(userEmail);
      context.health = await fetchHealthContext(userEmail);
      context.availableData.push('calendar', 'health_metrics', 'insurance');
      context.constraints.push({
        type: 'calendar',
        description: 'Must find available slot for appointment',
        severity: 'hard',
      });
      break;

    case 'shopping':
      context.availableData.push('payment_methods', 'addresses');
      context.constraints.push({
        type: 'financial',
        description: 'Stay within budget if specified',
        severity: 'soft',
      });
      break;
  }

  // Add user preferences as soft constraints
  if (userProfile.preferences) {
    if (userProfile.preferences.preferMornings) {
      context.constraints.push({
        type: 'time_preference',
        description: 'User prefers morning activities',
        severity: 'soft',
      });
    }
    if (userProfile.preferences.quietHours) {
      context.constraints.push({
        type: 'quiet_hours',
        description: `No notifications between ${userProfile.preferences.quietHours.start} and ${userProfile.preferences.quietHours.end}`,
        severity: 'soft',
      });
    }
  }

  return context;
}

/**
 * Fetch user profile and connected services
 */
async function fetchUserProfile(userEmail: string): Promise<UserProfile> {
  // Get connected services
  const { data: connectors } = await supabase
    .from('user_connectors')
    .select('connector_name, is_connected')
    .eq('user_email', userEmail)
    .eq('is_connected', true);

  // Get onboarding data for preferences
  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('*')
    .eq('user_email', userEmail)
    .single();

  const connectedServices = connectors?.map((c) => c.connector_name) || [];

  return {
    email: userEmail,
    name: onboarding?.name,
    goals: onboarding?.health_goals,
    preferences: {
      preferMornings: onboarding?.preferred_time === 'morning',
      activityLevel: onboarding?.activity_level,
      dietaryRestrictions: onboarding?.dietary_restrictions,
    },
    connectedServices,
  };
}

/**
 * Fetch calendar context (upcoming events, busy slots)
 */
async function fetchCalendarContext(userEmail: string): Promise<CalendarContext> {
  // This would integrate with the calendar API
  // For now, return placeholder structure
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('access_token')
    .eq('user_email', userEmail)
    .eq('provider', 'google')
    .single();

  if (!tokens?.access_token) {
    return {
      upcomingEvents: [],
      busySlots: [],
    };
  }

  // TODO: Fetch actual calendar data using Google Calendar API
  // For now, return empty structure
  return {
    upcomingEvents: [],
    busySlots: [],
    workingHours: {
      start: 9,
      end: 17,
    },
  };
}

/**
 * Fetch health context (metrics, biomarkers)
 */
async function fetchHealthContext(userEmail: string): Promise<HealthContext> {
  // Fetch recent ecosystem data
  const { data: ecosystemData } = await supabase
    .from('ecosystem_context')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Fetch biomarkers
  const { data: biomarkers } = await supabase
    .from('user_biomarkers')
    .select('*')
    .eq('user_email', userEmail)
    .order('test_date', { ascending: false })
    .limit(10);

  return {
    recentMetrics: ecosystemData?.summary || {},
    biomarkers: biomarkers?.reduce((acc, b) => {
      acc[b.marker_name] = {
        value: b.value,
        unit: b.unit,
        status: b.status,
        testDate: b.test_date,
      };
      return acc;
    }, {} as Record<string, any>),
  };
}

/**
 * Format context for prompt inclusion
 */
export function formatContextForPrompt(context: PlanningContext): string {
  const sections: string[] = [];

  // User profile
  sections.push(`## User Profile
- Email: ${context.userProfile.email}
- Name: ${context.userProfile.name || 'Unknown'}
- Goals: ${context.userProfile.goals?.join(', ') || 'Not specified'}
- Connected Services: ${context.userProfile.connectedServices.join(', ') || 'None'}`);

  // Available data
  sections.push(`## Available Data Sources
${context.availableData.map((d) => `- ${d}`).join('\n')}`);

  // Calendar context
  if (context.calendar) {
    sections.push(`## Calendar Context
- Upcoming Events: ${context.calendar.upcomingEvents.length}
- Working Hours: ${context.calendar.workingHours?.start || 9}:00 - ${context.calendar.workingHours?.end || 17}:00`);
  }

  // Health context
  if (context.health?.recentMetrics) {
    sections.push(`## Health Metrics
- HRV: ${context.health.recentMetrics.avgHRV || 'Unknown'}
- Sleep: ${context.health.recentMetrics.avgSleep || 'Unknown'} hours
- Readiness: ${context.health.recentMetrics.readinessScore || 'Unknown'}`);
  }

  // Constraints
  if (context.constraints.length > 0) {
    sections.push(`## Constraints
${context.constraints.map((c) => `- [${c.severity.toUpperCase()}] ${c.description}`).join('\n')}`);
  }

  // Previous failure context
  if (context.failureReason) {
    sections.push(`## Previous Attempt Failed
Reason: ${context.failureReason}
Please consider this when creating the new plan.`);
  }

  return sections.join('\n\n');
}

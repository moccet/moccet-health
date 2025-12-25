/**
 * Pattern Analysis Service
 * Analyzes health, activity, and social patterns for friend matching
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface UserHealthPattern {
  email: string;
  // Sleep patterns
  avg_sleep_score: number;
  sleep_consistency: number; // 0-1, how consistent their sleep schedule is
  typical_bedtime: string; // HH:MM format
  typical_waketime: string;
  // Stress patterns
  avg_stress_level: number; // 0-100
  stress_trend: 'improving' | 'stable' | 'worsening';
  high_stress_days: string[]; // Days of week with typically high stress
  // Activity patterns
  avg_activity_score: number;
  workout_days: string[]; // Days they typically work out
  preferred_workout_times: string[]; // 'morning', 'afternoon', 'evening'
  workout_types: string[]; // 'gym', 'run', 'yoga', etc.
  // Recovery
  avg_hrv: number;
  recovery_score: number;
  // Social patterns
  social_energy_level: number; // How social they are (0-100)
  preferred_meeting_times: string[];
  preferred_activities: string[];
}

export interface FriendCompatibility {
  user_email_1: string;
  user_email_2: string;
  overall_score: number; // 0-1
  // Component scores
  schedule_compatibility: number;
  activity_compatibility: number;
  stress_sync: number; // Do they have stress at similar times?
  energy_match: number;
  // Best activities for this pair
  recommended_activities: string[];
  // Best times for this pair
  recommended_times: {
    day: string;
    time_range: string;
    score: number;
  }[];
}

export interface SocialMetrics {
  user_email: string;
  week_start: string;
  connections_count: number;
  unique_friends_seen: number;
  activities_completed: Record<string, number>;
  total_social_time_mins: number;
  isolation_score: number;
  loneliness_risk: 'low' | 'moderate' | 'high' | 'critical';
  days_since_last_connection: number;
  week_over_week_change: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class PatternAnalysisService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ---------------------------------------------------------------------------
  // HEALTH PATTERN ANALYSIS
  // ---------------------------------------------------------------------------

  /**
   * Analyze and extract health patterns for a user
   */
  async analyzeUserHealthPatterns(userEmail: string): Promise<UserHealthPattern | null> {
    try {
      // Fetch ecosystem context cache (aggregated health data)
      const { data: contextCache } = await this.supabase
        .from('ecosystem_context_cache')
        .select('unified_profile, key_insights')
        .eq('user_email', userEmail)
        .single();

      // Fetch training data
      const { data: trainingData } = await this.supabase
        .from('forge_training_data')
        .select('*')
        .eq('user_email', userEmail)
        .single();

      // Fetch behavioral patterns
      const { data: behavioralData } = await this.supabase
        .from('behavioral_patterns')
        .select('*')
        .eq('user_email', userEmail)
        .single();

      if (!contextCache && !trainingData) {
        return null;
      }

      const profile = contextCache?.unified_profile || {};
      const physiological = profile.physiological || {};
      const behavioral = profile.behavioral || {};
      const lifestyle = profile.lifestyle || {};

      // Extract patterns
      const pattern: UserHealthPattern = {
        email: userEmail,
        // Sleep patterns
        avg_sleep_score: physiological.sleep?.avg_score || 70,
        sleep_consistency: physiological.sleep?.consistency || 0.7,
        typical_bedtime: physiological.sleep?.typical_bedtime || '23:00',
        typical_waketime: physiological.sleep?.typical_waketime || '07:00',
        // Stress patterns
        avg_stress_level: behavioral.stress?.avg_level || 50,
        stress_trend: this.calculateTrend(behavioral.stress?.trend_data),
        high_stress_days: behavioral.stress?.high_days || ['Monday', 'Tuesday'],
        // Activity patterns
        avg_activity_score: physiological.activity?.avg_score || 60,
        workout_days: trainingData?.workout_days || ['Monday', 'Wednesday', 'Friday'],
        preferred_workout_times: this.extractWorkoutTimes(trainingData),
        workout_types: trainingData?.workout_types || ['gym'],
        // Recovery
        avg_hrv: physiological.hrv?.avg || 50,
        recovery_score: physiological.recovery?.avg_score || 70,
        // Social patterns
        social_energy_level: lifestyle.social?.energy_level || 60,
        preferred_meeting_times: lifestyle.social?.preferred_times || ['evening'],
        preferred_activities: lifestyle.social?.preferred_activities || ['coffee', 'dinner'],
      };

      return pattern;
    } catch (error) {
      console.error('[PatternAnalysis] Error analyzing user patterns:', error);
      return null;
    }
  }

  /**
   * Calculate compatibility score between two users
   */
  async calculateCompatibility(
    email1: string,
    email2: string
  ): Promise<FriendCompatibility | null> {
    const [pattern1, pattern2] = await Promise.all([
      this.analyzeUserHealthPatterns(email1),
      this.analyzeUserHealthPatterns(email2),
    ]);

    if (!pattern1 || !pattern2) {
      return null;
    }

    // Calculate component scores
    const scheduleCompat = this.calculateScheduleCompatibility(pattern1, pattern2);
    const activityCompat = this.calculateActivityCompatibility(pattern1, pattern2);
    const stressSync = this.calculateStressSync(pattern1, pattern2);
    const energyMatch = this.calculateEnergyMatch(pattern1, pattern2);

    // Weighted overall score
    const overallScore =
      scheduleCompat * 0.3 +
      activityCompat * 0.3 +
      stressSync * 0.2 +
      energyMatch * 0.2;

    // Find recommended activities
    const recommendedActivities = this.findRecommendedActivities(pattern1, pattern2);

    // Find recommended times
    const recommendedTimes = this.findRecommendedTimes(pattern1, pattern2);

    const compatibility: FriendCompatibility = {
      user_email_1: email1,
      user_email_2: email2,
      overall_score: Math.round(overallScore * 100) / 100,
      schedule_compatibility: Math.round(scheduleCompat * 100) / 100,
      activity_compatibility: Math.round(activityCompat * 100) / 100,
      stress_sync: Math.round(stressSync * 100) / 100,
      energy_match: Math.round(energyMatch * 100) / 100,
      recommended_activities: recommendedActivities,
      recommended_times: recommendedTimes,
    };

    // Update friend_activity_patterns table
    await this.updateFriendPatterns(compatibility);

    return compatibility;
  }

  // ---------------------------------------------------------------------------
  // SOCIAL METRICS
  // ---------------------------------------------------------------------------

  /**
   * Calculate and store weekly social metrics for a user
   */
  async calculateSocialMetrics(userEmail: string): Promise<SocialMetrics> {
    const weekStart = this.getWeekStart();

    // Count meetings this week
    const { data: meetups } = await this.supabase
      .from('scheduled_meetups')
      .select('*')
      .or(`organizer_email.eq.${userEmail},participant_emails.cs.{${userEmail}}`)
      .gte('scheduled_time', weekStart.toISOString())
      .eq('status', 'completed');

    const connectionsCount = meetups?.length || 0;

    // Count unique friends
    const uniqueFriends = new Set<string>();
    for (const meetup of meetups || []) {
      for (const participant of meetup.participant_emails) {
        if (participant !== userEmail) {
          uniqueFriends.add(participant);
        }
      }
      if (meetup.organizer_email !== userEmail) {
        uniqueFriends.add(meetup.organizer_email);
      }
    }

    // Count activities by type
    const activitiesCompleted: Record<string, number> = {};
    let totalSocialTimeMins = 0;
    for (const meetup of meetups || []) {
      const activityType = meetup.activity_type || 'other';
      activitiesCompleted[activityType] = (activitiesCompleted[activityType] || 0) + 1;
      totalSocialTimeMins += meetup.duration_mins || 60;
    }

    // Calculate days since last connection
    const { data: lastMeetup } = await this.supabase
      .from('scheduled_meetups')
      .select('scheduled_time')
      .or(`organizer_email.eq.${userEmail},participant_emails.cs.{${userEmail}}`)
      .eq('status', 'completed')
      .order('scheduled_time', { ascending: false })
      .limit(1)
      .single();

    const daysSinceLastConnection = lastMeetup
      ? Math.floor(
          (Date.now() - new Date(lastMeetup.scheduled_time).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 30;

    // Calculate isolation score using database function
    const { data: isolationScore } = await this.supabase.rpc(
      'calculate_isolation_score',
      { p_user_email: userEmail }
    );

    // Determine loneliness risk
    const lonelinessRisk = this.calculateLonelinessRisk(
      isolationScore || 0.5,
      daysSinceLastConnection,
      connectionsCount
    );

    // Get previous week for comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const { data: prevMetrics } = await this.supabase
      .from('social_health_metrics')
      .select('connections_count')
      .eq('user_email', userEmail)
      .eq('week_start', prevWeekStart.toISOString().split('T')[0])
      .single();

    const prevCount = prevMetrics?.connections_count || 0;
    const weekOverWeekChange =
      prevCount > 0
        ? ((connectionsCount - prevCount) / prevCount) * 100
        : connectionsCount > 0
        ? 100
        : 0;

    const metrics: SocialMetrics = {
      user_email: userEmail,
      week_start: weekStart.toISOString().split('T')[0],
      connections_count: connectionsCount,
      unique_friends_seen: uniqueFriends.size,
      activities_completed: activitiesCompleted,
      total_social_time_mins: totalSocialTimeMins,
      isolation_score: isolationScore || 0.5,
      loneliness_risk: lonelinessRisk,
      days_since_last_connection: daysSinceLastConnection,
      week_over_week_change: Math.round(weekOverWeekChange),
    };

    // Store metrics
    await this.supabase.from('social_health_metrics').upsert(
      {
        user_email: userEmail,
        week_start: metrics.week_start,
        connections_count: metrics.connections_count,
        unique_friends_seen: metrics.unique_friends_seen,
        activities_completed: metrics.activities_completed,
        total_social_time_mins: metrics.total_social_time_mins,
        isolation_score: metrics.isolation_score,
        loneliness_risk: metrics.loneliness_risk,
        days_since_last_connection: metrics.days_since_last_connection,
        week_over_week_change: metrics.week_over_week_change,
      },
      { onConflict: 'user_email,week_start' }
    );

    // Check for intervention triggers
    if (lonelinessRisk === 'high' || lonelinessRisk === 'critical') {
      await this.triggerIsolationAlert(userEmail, metrics);
    }

    return metrics;
  }

  /**
   * Get social metrics for a user over time
   */
  async getSocialMetricsHistory(
    userEmail: string,
    weeks: number = 8
  ): Promise<SocialMetrics[]> {
    const { data, error } = await this.supabase
      .from('social_health_metrics')
      .select('*')
      .eq('user_email', userEmail)
      .order('week_start', { ascending: false })
      .limit(weeks);

    if (error) {
      console.error('[PatternAnalysis] Error fetching metrics history:', error);
      return [];
    }

    return data || [];
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private calculateTrend(trendData: any): 'improving' | 'stable' | 'worsening' {
    if (!trendData) return 'stable';
    // Simple trend calculation based on recent values
    const values = trendData.values || [];
    if (values.length < 2) return 'stable';
    const recent = values.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3;
    const older = values.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
    if (recent < older * 0.9) return 'improving';
    if (recent > older * 1.1) return 'worsening';
    return 'stable';
  }

  private extractWorkoutTimes(trainingData: any): string[] {
    if (!trainingData?.workouts) return ['morning'];
    // Analyze workout timestamps to determine preferred times
    return ['morning']; // Simplified for now
  }

  private calculateScheduleCompatibility(
    p1: UserHealthPattern,
    p2: UserHealthPattern
  ): number {
    // Check overlap in workout days
    const commonWorkoutDays = p1.workout_days.filter((d) =>
      p2.workout_days.includes(d)
    ).length;
    const workoutScore = commonWorkoutDays / Math.max(p1.workout_days.length, 1);

    // Check overlap in preferred meeting times
    const commonMeetingTimes = p1.preferred_meeting_times.filter((t) =>
      p2.preferred_meeting_times.includes(t)
    ).length;
    const meetingScore =
      commonMeetingTimes / Math.max(p1.preferred_meeting_times.length, 1);

    // Check sleep schedule compatibility (similar sleep times = easier to coordinate)
    const bedtimeDiff = this.getTimeDifference(
      p1.typical_bedtime,
      p2.typical_bedtime
    );
    const sleepScore = Math.max(0, 1 - bedtimeDiff / 180); // 3 hours max diff

    return (workoutScore + meetingScore + sleepScore) / 3;
  }

  private calculateActivityCompatibility(
    p1: UserHealthPattern,
    p2: UserHealthPattern
  ): number {
    // Check overlap in workout types
    const commonWorkouts = p1.workout_types.filter((w) =>
      p2.workout_types.includes(w)
    ).length;
    const workoutScore = commonWorkouts / Math.max(p1.workout_types.length, 1);

    // Check overlap in preferred activities
    const commonActivities = p1.preferred_activities.filter((a) =>
      p2.preferred_activities.includes(a)
    ).length;
    const activityScore =
      commonActivities / Math.max(p1.preferred_activities.length, 1);

    return (workoutScore + activityScore) / 2;
  }

  private calculateStressSync(
    p1: UserHealthPattern,
    p2: UserHealthPattern
  ): number {
    // Check if they have similar stress patterns (can support each other)
    const stressDiff = Math.abs(p1.avg_stress_level - p2.avg_stress_level);
    const stressLevelScore = Math.max(0, 1 - stressDiff / 50);

    // Check if they have stress on different days (can help each other)
    const commonStressDays = p1.high_stress_days.filter((d) =>
      p2.high_stress_days.includes(d)
    ).length;
    // Less overlap is better here - they can support each other
    const stressDayScore =
      1 - commonStressDays / Math.max(p1.high_stress_days.length, 1);

    return (stressLevelScore + stressDayScore) / 2;
  }

  private calculateEnergyMatch(
    p1: UserHealthPattern,
    p2: UserHealthPattern
  ): number {
    // Similar social energy levels work better together
    const socialDiff = Math.abs(p1.social_energy_level - p2.social_energy_level);
    const socialScore = Math.max(0, 1 - socialDiff / 50);

    // Similar activity scores
    const activityDiff = Math.abs(p1.avg_activity_score - p2.avg_activity_score);
    const activityScore = Math.max(0, 1 - activityDiff / 50);

    // Similar recovery states
    const recoveryDiff = Math.abs(p1.recovery_score - p2.recovery_score);
    const recoveryScore = Math.max(0, 1 - recoveryDiff / 50);

    return (socialScore + activityScore + recoveryScore) / 3;
  }

  private findRecommendedActivities(
    p1: UserHealthPattern,
    p2: UserHealthPattern
  ): string[] {
    // Find activities both enjoy
    const common = p1.preferred_activities.filter((a) =>
      p2.preferred_activities.includes(a)
    );

    // If low recovery for either, suggest low-impact activities
    if (p1.recovery_score < 50 || p2.recovery_score < 50) {
      return ['coffee', 'walk', 'lunch'].filter(
        (a) => common.includes(a) || common.length === 0
      );
    }

    // If both have high activity, suggest workout
    if (p1.avg_activity_score > 70 && p2.avg_activity_score > 70) {
      const workoutCommon = p1.workout_types.filter((w) =>
        p2.workout_types.includes(w)
      );
      if (workoutCommon.length > 0) {
        return [...workoutCommon, ...common].slice(0, 3);
      }
    }

    // Default to common activities or general suggestions
    return common.length > 0 ? common : ['coffee', 'dinner', 'walk'];
  }

  private findRecommendedTimes(
    p1: UserHealthPattern,
    p2: UserHealthPattern
  ): { day: string; time_range: string; score: number }[] {
    const recommendations: { day: string; time_range: string; score: number }[] =
      [];

    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const times = ['morning', 'afternoon', 'evening'];

    for (const day of days) {
      for (const time of times) {
        let score = 0.5;

        // Bonus if both prefer this time
        if (
          p1.preferred_meeting_times.includes(time) &&
          p2.preferred_meeting_times.includes(time)
        ) {
          score += 0.3;
        }

        // Penalty if it's a high stress day for either
        if (
          p1.high_stress_days.includes(day) ||
          p2.high_stress_days.includes(day)
        ) {
          score -= 0.2;
        }

        // Bonus for weekend
        if (day === 'Saturday' || day === 'Sunday') {
          score += 0.1;
        }

        recommendations.push({
          day,
          time_range: this.getTimeRange(time),
          score: Math.min(1, Math.max(0, score)),
        });
      }
    }

    // Sort by score and return top 5
    return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private getTimeRange(time: string): string {
    switch (time) {
      case 'morning':
        return '06:00-12:00';
      case 'afternoon':
        return '12:00-17:00';
      case 'evening':
        return '17:00-22:00';
      default:
        return '12:00-17:00';
    }
  }

  private getTimeDifference(time1: string, time2: string): number {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const mins1 = h1 * 60 + m1;
    const mins2 = h2 * 60 + m2;
    return Math.abs(mins1 - mins2);
  }

  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(now.setDate(diff));
  }

  private calculateLonelinessRisk(
    isolationScore: number,
    daysSince: number,
    weeklyConnections: number
  ): 'low' | 'moderate' | 'high' | 'critical' {
    // Weighted risk calculation
    const risk =
      isolationScore * 0.4 +
      Math.min(daysSince / 14, 1) * 0.3 +
      Math.max(0, 1 - weeklyConnections / 3) * 0.3;

    if (risk >= 0.75) return 'critical';
    if (risk >= 0.5) return 'high';
    if (risk >= 0.25) return 'moderate';
    return 'low';
  }

  private async updateFriendPatterns(
    compatibility: FriendCompatibility
  ): Promise<void> {
    const pairHash = this.generatePairHash(
      compatibility.user_email_1,
      compatibility.user_email_2
    );

    await this.supabase.from('friend_activity_patterns').upsert(
      {
        user_pair_hash: pairHash,
        user_email_1: compatibility.user_email_1,
        user_email_2: compatibility.user_email_2,
        compatibility_score: compatibility.overall_score,
        best_activities: compatibility.recommended_activities,
        best_times: compatibility.recommended_times,
      },
      { onConflict: 'user_pair_hash' }
    );
  }

  private generatePairHash(email1: string, email2: string): string {
    const sorted = [email1, email2].sort();
    return require('crypto')
      .createHash('md5')
      .update(sorted.join(':'))
      .digest('hex');
  }

  private async triggerIsolationAlert(
    userEmail: string,
    metrics: SocialMetrics
  ): Promise<void> {
    // Check if user has clinical sharing enabled
    const { data: clinicalSettings } = await this.supabase
      .from('clinical_social_sharing')
      .select('*')
      .eq('user_email', userEmail)
      .eq('is_active', true)
      .eq('share_isolation_alerts', true);

    if (clinicalSettings && clinicalSettings.length > 0) {
      // Mark intervention as triggered
      await this.supabase
        .from('social_health_metrics')
        .update({
          intervention_triggered: true,
          intervention_type: 'clinical_alert',
        })
        .eq('user_email', userEmail)
        .eq('week_start', metrics.week_start);

      // TODO: Send notification to care team
      console.log(
        `[PatternAnalysis] Isolation alert triggered for ${userEmail}`
      );
    }
  }
}

export const patternAnalysisService = new PatternAnalysisService();

/**
 * Suggestion Engine
 * AI-powered meeting suggestion system based on health patterns and availability
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  patternAnalysisService,
  UserHealthPattern,
  FriendCompatibility,
} from './pattern-analysis-service';
import { connectionService, Friend } from './connection-service';

// =============================================================================
// TYPES
// =============================================================================

export interface MeetingSuggestion {
  id?: string;
  suggestion_type: 'mutual' | 'outreach' | 'group';
  initiator_email: string;
  participant_emails: string[];
  suggested_activity: string;
  suggested_times: SuggestedTime[];
  suggested_location?: {
    name?: string;
    address?: string;
    type?: string;
  };
  reason: string;
  health_context: HealthContext;
  benefit_summary: string;
  priority_score: number;
  status: 'pending' | 'viewed' | 'accepted' | 'declined' | 'expired';
}

export interface SuggestedTime {
  start: string; // ISO date string
  end: string;
  score: number;
}

export interface HealthContext {
  initiator: {
    stress_level?: string;
    recovery_status?: string;
    activity_gap?: boolean;
    sleep_quality?: string;
  };
  friend: {
    stress_level?: string;
    recovery_status?: string;
    activity_gap?: boolean;
    sleep_quality?: string;
  };
  shared_context?: string;
}

interface CalendarSlot {
  start: Date;
  end: Date;
  duration_mins: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class SuggestionEngine {
  private supabase: SupabaseClient;
  private llm: ChatOpenAI;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.llm = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.7,
    });
  }

  // ---------------------------------------------------------------------------
  // SUGGESTION GENERATION
  // ---------------------------------------------------------------------------

  /**
   * Generate meeting suggestions for a user
   */
  async generateSuggestionsForUser(userEmail: string): Promise<MeetingSuggestion[]> {
    console.log(`[SuggestionEngine] Generating suggestions for ${userEmail}`);

    // Get user's friends
    const friends = await connectionService.getFriends(userEmail);
    if (friends.length === 0) {
      return [];
    }

    // Get user's health pattern
    const userPattern = await patternAnalysisService.analyzeUserHealthPatterns(
      userEmail
    );

    const suggestions: MeetingSuggestion[] = [];

    // Generate suggestions for each friend
    for (const friend of friends.slice(0, 10)) {
      // Limit to top 10 friends
      try {
        const suggestion = await this.generateSuggestionForPair(
          userEmail,
          friend,
          userPattern
        );

        if (suggestion && suggestion.priority_score > 0.3) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        console.error(
          `[SuggestionEngine] Error generating suggestion for ${friend.friend_email}:`,
          error
        );
      }
    }

    // Sort by priority and return top suggestions
    const topSuggestions = suggestions
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 5);

    // Store suggestions in database
    for (const suggestion of topSuggestions) {
      await this.storeSuggestion(suggestion);
    }

    return topSuggestions;
  }

  /**
   * Generate a suggestion for a specific friend pair
   */
  private async generateSuggestionForPair(
    userEmail: string,
    friend: Friend,
    userPattern: UserHealthPattern | null
  ): Promise<MeetingSuggestion | null> {
    // Get friend's pattern
    const friendPattern = await patternAnalysisService.analyzeUserHealthPatterns(
      friend.friend_email
    );

    // Get compatibility data
    const compatibility = await patternAnalysisService.calculateCompatibility(
      userEmail,
      friend.friend_email
    );

    // Get sharing preferences
    const prefs = await connectionService.getPreferences(
      userEmail,
      friend.friend_email
    );

    // Find available time slots
    const availableSlots = await this.findMutualAvailability(
      userEmail,
      friend.friend_email
    );

    if (availableSlots.length === 0) {
      return null;
    }

    // Calculate health context
    const healthContext = this.buildHealthContext(userPattern, friendPattern);

    // Determine best activity
    const activity = await this.determineActivity(
      userPattern,
      friendPattern,
      compatibility,
      prefs?.preferred_activities || []
    );

    // Calculate priority score
    const priorityScore = this.calculatePriorityScore(
      userPattern,
      friendPattern,
      friend,
      compatibility
    );

    // Generate reason and benefit using AI
    const { reason, benefit } = await this.generateContextualReason(
      userEmail,
      friend,
      activity,
      healthContext,
      compatibility
    );

    // Build suggested times
    const suggestedTimes = availableSlots.slice(0, 3).map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      score: 0.8, // Simplified scoring
    }));

    return {
      suggestion_type: 'mutual',
      initiator_email: userEmail,
      participant_emails: [userEmail, friend.friend_email],
      suggested_activity: activity,
      suggested_times: suggestedTimes,
      reason,
      health_context: healthContext,
      benefit_summary: benefit,
      priority_score: priorityScore,
      status: 'pending',
    };
  }

  /**
   * Find mutual availability between two users
   */
  private async findMutualAvailability(
    email1: string,
    email2: string
  ): Promise<CalendarSlot[]> {
    // Get busy times from Google Calendar for both users
    const [busy1, busy2] = await Promise.all([
      this.getUserBusyTimes(email1),
      this.getUserBusyTimes(email2),
    ]);

    // Find free slots in the next 7 days
    const slots: CalendarSlot[] = [];
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Check each day
    for (let d = new Date(now); d < endDate; d.setDate(d.getDate() + 1)) {
      // Check common meeting windows (8am-9pm)
      const daySlots = this.findFreeSlots(d, busy1, busy2);
      slots.push(...daySlots);
    }

    return slots.slice(0, 10); // Return up to 10 slots
  }

  /**
   * Get user's busy times from calendar
   */
  private async getUserBusyTimes(
    email: string
  ): Promise<{ start: Date; end: Date }[]> {
    // TODO: Integrate with Google Calendar API
    // For now, return empty (assume all free)
    // In production, this would call the calendar API
    return [];
  }

  /**
   * Find free slots on a given day
   */
  private findFreeSlots(
    date: Date,
    busy1: { start: Date; end: Date }[],
    busy2: { start: Date; end: Date }[]
  ): CalendarSlot[] {
    const slots: CalendarSlot[] = [];

    // Check morning (9-12), afternoon (12-17), evening (17-21)
    const windows = [
      { start: 9, end: 12, name: 'morning' },
      { start: 12, end: 17, name: 'afternoon' },
      { start: 17, end: 21, name: 'evening' },
    ];

    for (const window of windows) {
      const start = new Date(date);
      start.setHours(window.start, 0, 0, 0);

      const end = new Date(date);
      end.setHours(window.end, 0, 0, 0);

      // Check if this window overlaps with any busy time
      const isBusy = [...busy1, ...busy2].some(
        (busy) => busy.start < end && busy.end > start
      );

      if (!isBusy && start > new Date()) {
        slots.push({
          start,
          end,
          duration_mins: (window.end - window.start) * 60,
        });
      }
    }

    return slots;
  }

  /**
   * Build health context from patterns
   */
  private buildHealthContext(
    userPattern: UserHealthPattern | null,
    friendPattern: UserHealthPattern | null
  ): HealthContext {
    const context: HealthContext = {
      initiator: {},
      friend: {},
    };

    if (userPattern) {
      context.initiator = {
        stress_level:
          userPattern.avg_stress_level > 70
            ? 'high'
            : userPattern.avg_stress_level > 40
            ? 'moderate'
            : 'low',
        recovery_status:
          userPattern.recovery_score > 70
            ? 'good'
            : userPattern.recovery_score > 50
            ? 'moderate'
            : 'low',
        activity_gap: userPattern.avg_activity_score < 50,
        sleep_quality:
          userPattern.avg_sleep_score > 70
            ? 'good'
            : userPattern.avg_sleep_score > 50
            ? 'moderate'
            : 'poor',
      };
    }

    if (friendPattern) {
      context.friend = {
        stress_level:
          friendPattern.avg_stress_level > 70
            ? 'high'
            : friendPattern.avg_stress_level > 40
            ? 'moderate'
            : 'low',
        recovery_status:
          friendPattern.recovery_score > 70
            ? 'good'
            : friendPattern.recovery_score > 50
            ? 'moderate'
            : 'low',
        activity_gap: friendPattern.avg_activity_score < 50,
        sleep_quality:
          friendPattern.avg_sleep_score > 70
            ? 'good'
            : friendPattern.avg_sleep_score > 50
            ? 'moderate'
            : 'poor',
      };
    }

    // Add shared context
    if (
      context.initiator.stress_level === 'high' &&
      context.friend.stress_level === 'high'
    ) {
      context.shared_context = 'Both experiencing elevated stress';
    } else if (context.initiator.activity_gap && context.friend.activity_gap) {
      context.shared_context = 'Both have had low activity recently';
    }

    return context;
  }

  /**
   * Determine the best activity for the pair
   */
  private async determineActivity(
    userPattern: UserHealthPattern | null,
    friendPattern: UserHealthPattern | null,
    compatibility: FriendCompatibility | null,
    preferredActivities: string[]
  ): Promise<string> {
    // Use compatibility recommendations if available
    if (compatibility?.recommended_activities.length) {
      return compatibility.recommended_activities[0];
    }

    // Health-aware activity selection
    const userStress = userPattern?.avg_stress_level || 50;
    const friendStress = friendPattern?.avg_stress_level || 50;
    const userRecovery = userPattern?.recovery_score || 70;
    const friendRecovery = friendPattern?.recovery_score || 70;

    // If either is stressed and low recovery, suggest relaxing activity
    if (
      (userStress > 70 || friendStress > 70) &&
      (userRecovery < 50 || friendRecovery < 50)
    ) {
      return 'coffee';
    }

    // If both have good recovery and low stress, suggest active option
    if (
      userRecovery > 70 &&
      friendRecovery > 70 &&
      userStress < 50 &&
      friendStress < 50
    ) {
      // Check for common workout preferences
      const commonWorkouts = userPattern?.workout_types.filter((w) =>
        friendPattern?.workout_types.includes(w)
      );
      if (commonWorkouts && commonWorkouts.length > 0) {
        return commonWorkouts[0];
      }
      return 'walk';
    }

    // Use preferred activities if available
    if (preferredActivities.length > 0) {
      return preferredActivities[0];
    }

    // Default
    return 'coffee';
  }

  /**
   * Calculate priority score for the suggestion
   */
  private calculatePriorityScore(
    userPattern: UserHealthPattern | null,
    friendPattern: UserHealthPattern | null,
    friend: Friend,
    compatibility: FriendCompatibility | null
  ): number {
    let score = 0.5;

    // Boost for high compatibility
    if (compatibility) {
      score += compatibility.overall_score * 0.2;
    }

    // Boost if it's been a while since last meeting
    if (friend.last_meeting) {
      const daysSince = Math.floor(
        (Date.now() - new Date(friend.last_meeting).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSince > 14) {
        score += 0.15;
      }
      if (daysSince > 30) {
        score += 0.1;
      }
    } else {
      // Never met - boost for new connection
      score += 0.1;
    }

    // Boost if both are stressed (mutual support)
    if (
      userPattern?.avg_stress_level &&
      userPattern.avg_stress_level > 60 &&
      friendPattern?.avg_stress_level &&
      friendPattern.avg_stress_level > 60
    ) {
      score += 0.1;
    }

    // Boost if both have low activity (encourage each other)
    if (
      userPattern?.avg_activity_score &&
      userPattern.avg_activity_score < 50 &&
      friendPattern?.avg_activity_score &&
      friendPattern.avg_activity_score < 50
    ) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  /**
   * Generate contextual reason using AI
   */
  private async generateContextualReason(
    userEmail: string,
    friend: Friend,
    activity: string,
    healthContext: HealthContext,
    compatibility: FriendCompatibility | null
  ): Promise<{ reason: string; benefit: string }> {
    try {
      const prompt = `Generate a brief, warm reason for suggesting a meetup between two friends.

Friend name: ${friend.display_name || friend.friend_email.split('@')[0]}
Activity: ${activity}
Health context: ${JSON.stringify(healthContext)}
Compatibility score: ${compatibility?.overall_score || 0.5}
Days since last meeting: ${friend.last_meeting ? Math.floor((Date.now() - new Date(friend.last_meeting).getTime()) / (1000 * 60 * 60 * 24)) : 'Never met before'}

Generate:
1. A brief reason (1-2 sentences, conversational, like a helpful friend suggesting)
2. A benefit summary (1 short sentence about how this would help both)

Format your response as JSON: {"reason": "...", "benefit": "..."}`;

      const response = await this.llm.invoke([
        new SystemMessage(
          'You are a helpful assistant that suggests meetups between friends based on their health patterns. Be warm, concise, and natural.'
        ),
        new HumanMessage(prompt),
      ]);

      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[SuggestionEngine] Error generating reason:', error);
    }

    // Fallback
    return {
      reason: `It's been a while since you connected with ${friend.display_name || 'your friend'}. A ${activity} could be a great way to catch up.`,
      benefit: 'Social connection is one of the strongest predictors of wellbeing.',
    };
  }

  /**
   * Store suggestion in database
   */
  private async storeSuggestion(suggestion: MeetingSuggestion): Promise<string> {
    const { data, error } = await this.supabase
      .from('meeting_suggestions')
      .insert({
        suggestion_type: suggestion.suggestion_type,
        initiator_email: suggestion.initiator_email,
        participant_emails: suggestion.participant_emails,
        suggested_activity: suggestion.suggested_activity,
        suggested_times: suggestion.suggested_times,
        suggested_location: suggestion.suggested_location,
        reason: suggestion.reason,
        health_context: suggestion.health_context,
        benefit_summary: suggestion.benefit_summary,
        priority_score: suggestion.priority_score,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[SuggestionEngine] Error storing suggestion:', error);
      throw error;
    }

    return data.id;
  }

  // ---------------------------------------------------------------------------
  // SUGGESTION RETRIEVAL
  // ---------------------------------------------------------------------------

  /**
   * Get pending suggestions for a user
   */
  async getPendingSuggestions(userEmail: string): Promise<MeetingSuggestion[]> {
    const { data, error } = await this.supabase
      .from('meeting_suggestions')
      .select('*')
      .eq('initiator_email', userEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('priority_score', { ascending: false });

    if (error) {
      console.error('[SuggestionEngine] Error fetching suggestions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Respond to a suggestion
   */
  async respondToSuggestion(
    suggestionId: string,
    userEmail: string,
    accept: boolean,
    selectedTime?: string
  ): Promise<{ success: boolean; meetupId?: string }> {
    // Verify suggestion belongs to user
    const { data: suggestion, error: fetchError } = await this.supabase
      .from('meeting_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .eq('initiator_email', userEmail)
      .single();

    if (fetchError || !suggestion) {
      return { success: false };
    }

    // Update suggestion status
    await this.supabase
      .from('meeting_suggestions')
      .update({
        status: accept ? 'accepted' : 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', suggestionId);

    if (!accept) {
      return { success: true };
    }

    // Create scheduled meetup
    const scheduledTime = selectedTime || suggestion.suggested_times[0]?.start;

    const { data: meetup, error: meetupError } = await this.supabase
      .from('scheduled_meetups')
      .insert({
        suggestion_id: suggestionId,
        organizer_email: userEmail,
        participant_emails: suggestion.participant_emails,
        activity_type: suggestion.suggested_activity,
        title: `${suggestion.suggested_activity} with friends`,
        scheduled_time: scheduledTime,
        duration_mins: 60,
        location: suggestion.suggested_location,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (meetupError) {
      console.error('[SuggestionEngine] Error creating meetup:', meetupError);
      return { success: false };
    }

    // TODO: Create calendar events for all participants
    // TODO: Send notifications to other participants

    return { success: true, meetupId: meetup.id };
  }

  // ---------------------------------------------------------------------------
  // SCHEDULED BATCH GENERATION
  // ---------------------------------------------------------------------------

  /**
   * Generate suggestions for all active users (scheduled job)
   */
  async runBatchSuggestionGeneration(): Promise<{
    usersProcessed: number;
    suggestionsGenerated: number;
  }> {
    console.log('[SuggestionEngine] Starting batch suggestion generation');

    // Get all users with active connections
    const { data: users } = await this.supabase
      .from('user_connections')
      .select('requester_email, addressee_email')
      .eq('status', 'accepted');

    if (!users) {
      return { usersProcessed: 0, suggestionsGenerated: 0 };
    }

    // Get unique user emails
    const uniqueEmails = new Set<string>();
    for (const conn of users) {
      uniqueEmails.add(conn.requester_email);
      uniqueEmails.add(conn.addressee_email);
    }

    let suggestionsGenerated = 0;

    for (const email of uniqueEmails) {
      try {
        const suggestions = await this.generateSuggestionsForUser(email);
        suggestionsGenerated += suggestions.length;
      } catch (error) {
        console.error(
          `[SuggestionEngine] Error processing ${email}:`,
          error
        );
      }
    }

    console.log(
      `[SuggestionEngine] Batch complete: ${uniqueEmails.size} users, ${suggestionsGenerated} suggestions`
    );

    return {
      usersProcessed: uniqueEmails.size,
      suggestionsGenerated,
    };
  }
}

export const suggestionEngine = new SuggestionEngine();

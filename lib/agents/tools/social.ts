/**
 * Social Tools (Moccet Connect)
 * Tools for managing friend connections and social meetups
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// =============================================================================
// FRIEND READING TOOLS
// =============================================================================

// Get friends list
export const getFriendsTool: ToolDefinition = {
  name: 'get_friends',
  description: `Get the user's Moccet Connect friends list.
    Returns all accepted friend connections with connection level and compatibility scores.`,
  riskLevel: 'low',
  parameters: z.object({}),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      // Get accepted connections where user is either requester or addressee
      const { data: connections, error } = await context.supabase
        .from('user_connections')
        .select(`
          *,
          friend_activity_patterns!inner(
            compatibility_score,
            last_meeting,
            meeting_count,
            best_activities
          )
        `)
        .or(`requester_email.eq.${context.userEmail},addressee_email.eq.${context.userEmail}`)
        .eq('status', 'accepted');

      if (error) throw error;

      // Format friends list
      const friends = connections?.map((conn: any) => {
        const friendEmail = conn.requester_email === context.userEmail
          ? conn.addressee_email
          : conn.requester_email;

        return {
          email: friendEmail,
          connection_level: conn.connection_level,
          connected_since: conn.accepted_at,
          compatibility_score: conn.friend_activity_patterns?.[0]?.compatibility_score,
          last_meeting: conn.friend_activity_patterns?.[0]?.last_meeting,
          meeting_count: conn.friend_activity_patterns?.[0]?.meeting_count || 0,
          best_activities: conn.friend_activity_patterns?.[0]?.best_activities || [],
        };
      }) || [];

      return {
        success: true,
        data: {
          friend_count: friends.length,
          friends,
        },
        metadata: {
          source: 'moccet_connect',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get friends: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get pending friend requests
export const getPendingRequestsTool: ToolDefinition = {
  name: 'get_pending_friend_requests',
  description: `Get pending friend requests that the user needs to respond to.`,
  riskLevel: 'low',
  parameters: z.object({}),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      // Get requests where user is the addressee
      const { data: incoming, error: inError } = await context.supabase
        .from('user_connections')
        .select('*')
        .eq('addressee_email', context.userEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (inError) throw inError;

      // Get requests user has sent
      const { data: outgoing, error: outError } = await context.supabase
        .from('user_connections')
        .select('*')
        .eq('requester_email', context.userEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (outError) throw outError;

      return {
        success: true,
        data: {
          incoming: incoming?.map((r: any) => ({
            request_id: r.id,
            from_email: r.requester_email,
            sent_at: r.created_at,
          })) || [],
          outgoing: outgoing?.map((r: any) => ({
            request_id: r.id,
            to_email: r.addressee_email,
            sent_at: r.created_at,
          })) || [],
          total_pending: (incoming?.length || 0) + (outgoing?.length || 0),
        },
        metadata: {
          source: 'moccet_connect',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get pending requests: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get meeting suggestions
export const getMeetingSuggestionsTool: ToolDefinition = {
  name: 'get_meeting_suggestions',
  description: `Get AI-generated meeting suggestions for the user.
    These are health-aware recommendations for social activities with friends.`,
  riskLevel: 'low',
  parameters: z.object({
    limit: z.number().min(1).max(10).optional()
      .describe('Maximum suggestions to return. Defaults to 5.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { limit = 5 } = params;

      const { data: suggestions, error } = await context.supabase
        .from('meeting_suggestions')
        .select('*')
        .eq('initiator_email', context.userEmail)
        .eq('status', 'pending')
        .order('priority_score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formattedSuggestions = suggestions?.map((s: any) => ({
        suggestion_id: s.id,
        activity: s.suggested_activity,
        participants: s.participant_emails.filter((e: string) => e !== context.userEmail),
        suggested_times: s.suggested_times,
        location: s.suggested_location,
        reason: s.reason,
        health_benefit: s.benefit_summary,
        priority: s.priority_score,
        expires_at: s.expires_at,
      })) || [];

      return {
        success: true,
        data: {
          suggestion_count: formattedSuggestions.length,
          suggestions: formattedSuggestions,
        },
        metadata: {
          source: 'meeting_suggestions',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get meeting suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get upcoming meetups
export const getUpcomingMeetupsTool: ToolDefinition = {
  name: 'get_upcoming_meetups',
  description: `Get the user's upcoming scheduled meetups with friends.`,
  riskLevel: 'low',
  parameters: z.object({
    days: z.number().min(1).max(30).optional()
      .describe('Number of days to look ahead. Defaults to 7.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { days = 7 } = params;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const { data: meetups, error } = await context.supabase
        .from('scheduled_meetups')
        .select('*')
        .or(`organizer_email.eq.${context.userEmail},participant_emails.cs.{${context.userEmail}}`)
        .in('status', ['scheduled', 'confirmed'])
        .gte('scheduled_time', new Date().toISOString())
        .lte('scheduled_time', endDate.toISOString())
        .order('scheduled_time', { ascending: true });

      if (error) throw error;

      const formattedMeetups = meetups?.map((m: any) => ({
        meetup_id: m.id,
        activity: m.activity_type,
        title: m.title,
        scheduled_time: m.scheduled_time,
        duration_mins: m.duration_mins,
        location: m.location,
        participants: m.participant_emails.filter((e: string) => e !== context.userEmail),
        is_organizer: m.organizer_email === context.userEmail,
        status: m.status,
      })) || [];

      return {
        success: true,
        data: {
          meetup_count: formattedMeetups.length,
          meetups: formattedMeetups,
        },
        metadata: {
          source: 'scheduled_meetups',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get upcoming meetups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// FRIEND MANAGEMENT TOOLS
// =============================================================================

// Send friend request
export const sendFriendRequestTool: ToolDefinition = {
  name: 'send_friend_request',
  description: `Send a friend request to connect with someone on Moccet.
    Requires the recipient's email address.`,
  riskLevel: 'medium',
  parameters: z.object({
    email: z.string().email()
      .describe('Email address of the person to send request to'),
    message: z.string().max(200).optional()
      .describe('Optional message to include with the request'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { email, message } = params;

      if (email === context.userEmail) {
        return {
          success: false,
          error: "You can't send a friend request to yourself",
        };
      }

      // Check if connection already exists
      const { data: existing } = await context.supabase
        .from('user_connections')
        .select('status')
        .or(`and(requester_email.eq.${context.userEmail},addressee_email.eq.${email}),and(requester_email.eq.${email},addressee_email.eq.${context.userEmail})`)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `Connection already exists with status: ${existing.status}`,
        };
      }

      // Create the friend request
      const { data: request, error } = await context.supabase
        .from('user_connections')
        .insert({
          requester_email: context.userEmail,
          addressee_email: email,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          request_id: request.id,
          sent_to: email,
          message: `Friend request sent to ${email}`,
        },
        metadata: {
          source: 'friend_request',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send friend request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Accept friend request
export const acceptFriendRequestTool: ToolDefinition = {
  name: 'accept_friend_request',
  description: `Accept a pending friend request.`,
  riskLevel: 'medium',
  parameters: z.object({
    request_id: z.string().uuid()
      .describe('ID of the friend request to accept'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { request_id } = params;

      const { data: request, error } = await context.supabase
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('id', request_id)
        .eq('addressee_email', context.userEmail)
        .eq('status', 'pending')
        .select('requester_email')
        .single();

      if (error || !request) {
        return {
          success: false,
          error: 'Friend request not found or already processed',
        };
      }

      return {
        success: true,
        data: {
          accepted: true,
          friend_email: request.requester_email,
          message: `You are now connected with ${request.requester_email}`,
        },
        metadata: {
          source: 'friend_accept',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to accept friend request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Reject friend request
export const rejectFriendRequestTool: ToolDefinition = {
  name: 'reject_friend_request',
  description: `Reject a pending friend request.`,
  riskLevel: 'medium',
  parameters: z.object({
    request_id: z.string().uuid()
      .describe('ID of the friend request to reject'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { request_id } = params;

      const { data: request, error } = await context.supabase
        .from('user_connections')
        .update({ status: 'rejected' })
        .eq('id', request_id)
        .eq('addressee_email', context.userEmail)
        .eq('status', 'pending')
        .select('requester_email')
        .single();

      if (error || !request) {
        return {
          success: false,
          error: 'Friend request not found or already processed',
        };
      }

      return {
        success: true,
        data: {
          rejected: true,
          from_email: request.requester_email,
        },
        metadata: {
          source: 'friend_reject',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to reject friend request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// MEETING MANAGEMENT TOOLS
// =============================================================================

// Accept meeting suggestion
export const acceptMeetingSuggestionTool: ToolDefinition = {
  name: 'accept_meeting_suggestion',
  description: `Accept an AI-generated meeting suggestion and schedule it.`,
  riskLevel: 'medium',
  parameters: z.object({
    suggestion_id: z.string().uuid()
      .describe('ID of the meeting suggestion to accept'),
    selected_time_index: z.number().min(0).optional()
      .describe('Index of the preferred time slot (0-based). Defaults to first option.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { suggestion_id, selected_time_index = 0 } = params;

      // Get the suggestion
      const { data: suggestion, error: fetchError } = await context.supabase
        .from('meeting_suggestions')
        .select('*')
        .eq('id', suggestion_id)
        .eq('initiator_email', context.userEmail)
        .eq('status', 'pending')
        .single();

      if (fetchError || !suggestion) {
        return {
          success: false,
          error: 'Meeting suggestion not found or already processed',
        };
      }

      const selectedTime = suggestion.suggested_times[selected_time_index];
      if (!selectedTime) {
        return {
          success: false,
          error: 'Invalid time slot selection',
        };
      }

      // Create the scheduled meetup
      const { data: meetup, error: createError } = await context.supabase
        .from('scheduled_meetups')
        .insert({
          suggestion_id,
          organizer_email: context.userEmail,
          participant_emails: suggestion.participant_emails,
          activity_type: suggestion.suggested_activity,
          title: `${suggestion.suggested_activity} meetup`,
          scheduled_time: selectedTime.start,
          duration_mins: 60,
          location: suggestion.suggested_location,
          status: 'scheduled',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Update suggestion status
      await context.supabase
        .from('meeting_suggestions')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', suggestion_id);

      return {
        success: true,
        data: {
          meetup_id: meetup.id,
          activity: suggestion.suggested_activity,
          scheduled_time: selectedTime.start,
          participants: suggestion.participant_emails.filter((e: string) => e !== context.userEmail),
          message: `Meeting scheduled for ${new Date(selectedTime.start).toLocaleString()}`,
        },
        metadata: {
          source: 'meeting_schedule',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to accept meeting suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Decline meeting suggestion
export const declineMeetingSuggestionTool: ToolDefinition = {
  name: 'decline_meeting_suggestion',
  description: `Decline an AI-generated meeting suggestion.`,
  riskLevel: 'medium',
  parameters: z.object({
    suggestion_id: z.string().uuid()
      .describe('ID of the meeting suggestion to decline'),
    reason: z.string().max(200).optional()
      .describe('Optional reason for declining'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { suggestion_id, reason } = params;

      const { data, error } = await context.supabase
        .from('meeting_suggestions')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
          response_notes: reason,
        })
        .eq('id', suggestion_id)
        .eq('initiator_email', context.userEmail)
        .eq('status', 'pending')
        .select('suggested_activity')
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'Meeting suggestion not found or already processed',
        };
      }

      return {
        success: true,
        data: {
          declined: true,
          activity: data.suggested_activity,
          reason,
        },
        metadata: {
          source: 'meeting_decline',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to decline meeting suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Export all social tools
export const socialTools = [
  getFriendsTool,
  getPendingRequestsTool,
  getMeetingSuggestionsTool,
  getUpcomingMeetupsTool,
  sendFriendRequestTool,
  acceptFriendRequestTool,
  rejectFriendRequestTool,
  acceptMeetingSuggestionTool,
  declineMeetingSuggestionTool,
];

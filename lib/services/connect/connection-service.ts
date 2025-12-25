/**
 * Connection Service
 * Handles friend connections, requests, and relationship management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type ConnectionLevel = 'basic' | 'health_sharing' | 'full';

export interface Connection {
  id: string;
  requester_email: string;
  addressee_email: string;
  status: ConnectionStatus;
  connection_level: ConnectionLevel;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
}

export interface Friend {
  friend_email: string;
  connection_level: ConnectionLevel;
  connected_since: string;
  last_meeting: string | null;
  compatibility_score: number;
  // Extended profile info (fetched separately)
  display_name?: string;
  avatar_url?: string;
}

export interface PendingRequest {
  request_id: string;
  requester_email: string;
  requester_name?: string;
  created_at: string;
}

export interface ConnectionPreferences {
  share_activity: boolean;
  share_sleep: boolean;
  share_stress: boolean;
  share_calendar: boolean;
  share_location: boolean;
  preferred_activities: string[];
  meeting_frequency_preference: string;
  notify_suggestions: boolean;
  notify_friend_updates: boolean;
}

// =============================================================================
// SERVICE
// =============================================================================

export class ConnectionService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ---------------------------------------------------------------------------
  // FRIEND REQUESTS
  // ---------------------------------------------------------------------------

  /**
   * Send a friend request to another user
   */
  async sendRequest(
    requesterEmail: string,
    addresseeEmail: string
  ): Promise<{ success: boolean; error?: string; connection?: Connection }> {
    try {
      // Check if connection already exists
      const { data: existing } = await this.supabase
        .from('user_connections')
        .select('*')
        .or(
          `and(requester_email.eq.${requesterEmail},addressee_email.eq.${addresseeEmail}),` +
          `and(requester_email.eq.${addresseeEmail},addressee_email.eq.${requesterEmail})`
        )
        .single();

      if (existing) {
        if (existing.status === 'accepted') {
          return { success: false, error: 'You are already connected with this user' };
        }
        if (existing.status === 'pending') {
          // If they sent us a request, accept it instead
          if (existing.requester_email === addresseeEmail) {
            return this.respondToRequest(existing.id, requesterEmail, true);
          }
          return { success: false, error: 'Connection request already pending' };
        }
        if (existing.status === 'blocked') {
          return { success: false, error: 'Unable to connect with this user' };
        }
      }

      // Check if addressee is a moccet user
      const { data: addresseeUser } = await this.supabase
        .from('sage_onboarding_data')
        .select('email')
        .eq('email', addresseeEmail)
        .single();

      if (!addresseeUser) {
        // User doesn't exist - could trigger an invite email
        return { success: false, error: 'User not found. Would you like to invite them?' };
      }

      // Create the connection request
      const { data: connection, error } = await this.supabase
        .from('user_connections')
        .insert({
          requester_email: requesterEmail,
          addressee_email: addresseeEmail,
          status: 'pending',
          connection_level: 'basic',
        })
        .select()
        .single();

      if (error) {
        console.error('[ConnectionService] Error creating request:', error);
        return { success: false, error: 'Failed to send connection request' };
      }

      // TODO: Send push notification to addressee
      // await this.notifyNewRequest(addresseeEmail, requesterEmail);

      return { success: true, connection };
    } catch (error) {
      console.error('[ConnectionService] Error in sendRequest:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Respond to a friend request (accept or decline)
   */
  async respondToRequest(
    requestId: string,
    userEmail: string,
    accept: boolean
  ): Promise<{ success: boolean; error?: string; connection?: Connection }> {
    try {
      // Verify the request exists and is for this user
      const { data: request, error: fetchError } = await this.supabase
        .from('user_connections')
        .select('*')
        .eq('id', requestId)
        .eq('addressee_email', userEmail)
        .eq('status', 'pending')
        .single();

      if (fetchError || !request) {
        return { success: false, error: 'Connection request not found' };
      }

      const newStatus: ConnectionStatus = accept ? 'accepted' : 'rejected';

      const { data: connection, error: updateError } = await this.supabase
        .from('user_connections')
        .update({ status: newStatus })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) {
        console.error('[ConnectionService] Error updating request:', updateError);
        return { success: false, error: 'Failed to respond to request' };
      }

      // If accepted, create default preferences for both users
      if (accept) {
        await this.createDefaultPreferences(userEmail, request.requester_email);
        await this.createDefaultPreferences(request.requester_email, userEmail);

        // TODO: Notify the requester
        // await this.notifyRequestAccepted(request.requester_email, userEmail);
      }

      return { success: true, connection };
    } catch (error) {
      console.error('[ConnectionService] Error in respondToRequest:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Get pending requests for a user
   */
  async getPendingRequests(userEmail: string): Promise<PendingRequest[]> {
    const { data, error } = await this.supabase.rpc('get_pending_requests', {
      p_user_email: userEmail,
    });

    if (error) {
      console.error('[ConnectionService] Error fetching pending requests:', error);
      return [];
    }

    return data || [];
  }

  // ---------------------------------------------------------------------------
  // FRIENDS LIST
  // ---------------------------------------------------------------------------

  /**
   * Get all friends for a user
   */
  async getFriends(userEmail: string): Promise<Friend[]> {
    const { data, error } = await this.supabase.rpc('get_user_friends', {
      p_user_email: userEmail,
    });

    if (error) {
      console.error('[ConnectionService] Error fetching friends:', error);
      return [];
    }

    // Enrich with profile data
    const friendEmails = data?.map((f: Friend) => f.friend_email) || [];
    const profiles = await this.getProfilesForEmails(friendEmails);

    return (data || []).map((friend: Friend) => ({
      ...friend,
      display_name: profiles[friend.friend_email]?.display_name,
      avatar_url: profiles[friend.friend_email]?.avatar_url,
    }));
  }

  /**
   * Check if two users are connected
   */
  async areConnected(email1: string, email2: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('are_users_connected', {
      email1,
      email2,
    });

    if (error) {
      console.error('[ConnectionService] Error checking connection:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Remove a friend connection
   */
  async removeFriend(
    userEmail: string,
    friendEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('user_connections')
        .delete()
        .or(
          `and(requester_email.eq.${userEmail},addressee_email.eq.${friendEmail}),` +
          `and(requester_email.eq.${friendEmail},addressee_email.eq.${userEmail})`
        );

      if (error) {
        console.error('[ConnectionService] Error removing friend:', error);
        return { success: false, error: 'Failed to remove friend' };
      }

      // Also remove preferences
      await this.supabase
        .from('connection_preferences')
        .delete()
        .or(
          `and(user_email.eq.${userEmail},friend_email.eq.${friendEmail}),` +
          `and(user_email.eq.${friendEmail},friend_email.eq.${userEmail})`
        );

      return { success: true };
    } catch (error) {
      console.error('[ConnectionService] Error in removeFriend:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Block a user
   */
  async blockUser(
    userEmail: string,
    blockedEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check for existing connection
      const { data: existing } = await this.supabase
        .from('user_connections')
        .select('id')
        .or(
          `and(requester_email.eq.${userEmail},addressee_email.eq.${blockedEmail}),` +
          `and(requester_email.eq.${blockedEmail},addressee_email.eq.${userEmail})`
        )
        .single();

      if (existing) {
        // Update existing connection to blocked
        await this.supabase
          .from('user_connections')
          .update({ status: 'blocked' })
          .eq('id', existing.id);
      } else {
        // Create new blocked connection
        await this.supabase.from('user_connections').insert({
          requester_email: userEmail,
          addressee_email: blockedEmail,
          status: 'blocked',
        });
      }

      return { success: true };
    } catch (error) {
      console.error('[ConnectionService] Error in blockUser:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  // ---------------------------------------------------------------------------
  // PREFERENCES
  // ---------------------------------------------------------------------------

  /**
   * Get sharing preferences for a specific friend
   */
  async getPreferences(
    userEmail: string,
    friendEmail: string
  ): Promise<ConnectionPreferences | null> {
    const { data, error } = await this.supabase
      .from('connection_preferences')
      .select('*')
      .eq('user_email', userEmail)
      .eq('friend_email', friendEmail)
      .single();

    if (error) {
      return null;
    }

    return {
      share_activity: data.share_activity,
      share_sleep: data.share_sleep,
      share_stress: data.share_stress,
      share_calendar: data.share_calendar,
      share_location: data.share_location,
      preferred_activities: data.preferred_activities || [],
      meeting_frequency_preference: data.meeting_frequency_preference,
      notify_suggestions: data.notify_suggestions,
      notify_friend_updates: data.notify_friend_updates,
    };
  }

  /**
   * Update sharing preferences for a specific friend
   */
  async updatePreferences(
    userEmail: string,
    friendEmail: string,
    preferences: Partial<ConnectionPreferences>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('connection_preferences')
        .update(preferences)
        .eq('user_email', userEmail)
        .eq('friend_email', friendEmail);

      if (error) {
        console.error('[ConnectionService] Error updating preferences:', error);
        return { success: false, error: 'Failed to update preferences' };
      }

      return { success: true };
    } catch (error) {
      console.error('[ConnectionService] Error in updatePreferences:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Create default preferences for a new connection
   */
  private async createDefaultPreferences(
    userEmail: string,
    friendEmail: string
  ): Promise<void> {
    await this.supabase.from('connection_preferences').upsert(
      {
        user_email: userEmail,
        friend_email: friendEmail,
        share_activity: true,
        share_sleep: false,
        share_stress: false,
        share_calendar: true,
        share_location: false,
        preferred_activities: ['coffee', 'dinner', 'walk'],
        meeting_frequency_preference: 'weekly',
        notify_suggestions: true,
        notify_friend_updates: true,
      },
      { onConflict: 'user_email,friend_email' }
    );
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Get profile info for multiple emails
   */
  private async getProfilesForEmails(
    emails: string[]
  ): Promise<Record<string, { display_name?: string; avatar_url?: string }>> {
    if (emails.length === 0) return {};

    const { data } = await this.supabase
      .from('sage_onboarding_data')
      .select('email, form_data')
      .in('email', emails);

    const profiles: Record<string, { display_name?: string; avatar_url?: string }> = {};

    for (const user of data || []) {
      const formData = user.form_data as any;
      profiles[user.email] = {
        display_name: formData?.name || formData?.full_name || user.email.split('@')[0],
        avatar_url: formData?.avatar_url,
      };
    }

    return profiles;
  }

  // ---------------------------------------------------------------------------
  // STATISTICS
  // ---------------------------------------------------------------------------

  /**
   * Get connection statistics for a user
   */
  async getStats(userEmail: string): Promise<{
    total_friends: number;
    pending_requests: number;
    sent_requests: number;
  }> {
    const [friendsResult, pendingResult, sentResult] = await Promise.all([
      this.supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`requester_email.eq.${userEmail},addressee_email.eq.${userEmail}`),
      this.supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_email', userEmail)
        .eq('status', 'pending'),
      this.supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('requester_email', userEmail)
        .eq('status', 'pending'),
    ]);

    return {
      total_friends: friendsResult.count || 0,
      pending_requests: pendingResult.count || 0,
      sent_requests: sentResult.count || 0,
    };
  }
}

// Export singleton instance
export const connectionService = new ConnectionService();

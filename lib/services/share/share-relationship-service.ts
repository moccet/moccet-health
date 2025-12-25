/**
 * Share Relationship Service
 * Handles family health sharing relationships, invites, and permissions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type ShareStatus = 'pending' | 'active' | 'paused' | 'revoked';
export type CaregiverRole = 'primary' | 'secondary' | 'clinical' | 'emergency_only';
export type RelationshipType =
  | 'spouse'
  | 'child'
  | 'sibling'
  | 'parent'
  | 'grandparent'
  | 'friend'
  | 'clinical_provider'
  | 'professional_caregiver'
  | 'other';

export interface ShareRelationship {
  id: string;
  sharer_email: string;
  caregiver_email: string;
  relationship_type: RelationshipType;
  relationship_label: string | null;
  caregiver_role: CaregiverRole;
  status: ShareStatus;
  is_bidirectional: boolean;
  reverse_relationship_id: string | null;
  invite_code: string | null;
  invite_message: string | null;
  invite_sent_at: string | null;
  invite_accepted_at: string | null;
  created_at: string;
  updated_at: string;
  paused_at: string | null;
  pause_reason: string | null;
}

export interface SharePermissions {
  // Sleep
  share_sleep_score: boolean;
  share_sleep_details: boolean;
  share_sleep_trends: boolean;
  // Heart & Recovery
  share_hrv: boolean;
  share_resting_hr: boolean;
  share_recovery: boolean;
  // Activity
  share_activity: boolean;
  share_steps: boolean;
  share_workouts: boolean;
  share_calories: boolean;
  // Glucose
  share_glucose: boolean;
  share_glucose_alerts_only: boolean;
  share_time_in_range: boolean;
  // Medication
  share_medication_compliance: boolean;
  share_medication_list: boolean;
  share_medication_schedule: boolean;
  // Nutrition
  share_nutrition: boolean;
  share_nutrition_alerts_only: boolean;
  share_hydration: boolean;
  // Location
  share_location: boolean;
  share_location_history: boolean;
  share_geofence_alerts: boolean;
  // Calendar
  share_calendar: boolean;
  share_appointments: boolean;
  // Vitals
  share_blood_pressure: boolean;
  share_weight: boolean;
  share_temperature: boolean;
  // Alert routing
  receive_critical_alerts: boolean;
  receive_high_alerts: boolean;
  receive_medium_alerts: boolean;
  receive_low_alerts: boolean;
  receive_info_alerts: boolean;
  // Clinical
  can_see_clinical_alerts: boolean;
  can_see_clinical_details: boolean;
  // Intervention permissions
  can_create_reminders: boolean;
  can_initiate_deliveries: boolean;
  can_contact_emergency: boolean;
}

export interface MonitoredPerson {
  relationship_id: string;
  sharer_email: string;
  sharer_label: string | null;
  sharer_name: string | null;
  caregiver_role: CaregiverRole;
  relationship_type: RelationshipType;
  connected_since: string;
  is_bidirectional: boolean;
  permissions: SharePermissions | null;
  last_data_sync: string | null;
  current_status: 'good' | 'fair' | 'concerning' | 'critical' | 'unknown';
  pending_alerts_count: number;
}

export interface PendingShareInvite {
  id: string;
  sharer_email: string;
  sharer_name: string | null;
  relationship_type: RelationshipType;
  relationship_label: string | null;
  invite_message: string | null;
  invite_sent_at: string;
}

export interface InviteResult {
  success: boolean;
  error?: string;
  invite_code?: string;
  relationship?: ShareRelationship;
}

// =============================================================================
// SERVICE
// =============================================================================

export class ShareRelationshipService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ---------------------------------------------------------------------------
  // INVITE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Create a share invite for a caregiver
   */
  async createInvite(
    sharerEmail: string,
    caregiverEmail: string,
    options: {
      relationshipType: RelationshipType;
      relationshipLabel?: string;
      caregiverRole?: CaregiverRole;
      inviteMessage?: string;
      isBidirectional?: boolean;
    }
  ): Promise<InviteResult> {
    try {
      // Check if relationship already exists
      const { data: existing } = await this.supabase
        .from('share_relationships')
        .select('*')
        .eq('sharer_email', sharerEmail)
        .eq('caregiver_email', caregiverEmail)
        .single();

      if (existing) {
        if (existing.status === 'active') {
          return { success: false, error: 'Already sharing with this person' };
        }
        if (existing.status === 'pending') {
          return {
            success: false,
            error: 'Invite already pending',
            invite_code: existing.invite_code,
          };
        }
        if (existing.status === 'revoked') {
          // Allow re-inviting after revocation
          const { data: updated, error } = await this.supabase
            .from('share_relationships')
            .update({
              status: 'pending',
              invite_sent_at: new Date().toISOString(),
              invite_message: options.inviteMessage || null,
              relationship_type: options.relationshipType,
              relationship_label: options.relationshipLabel || null,
              caregiver_role: options.caregiverRole || 'secondary',
              revoked_at: null,
              revoked_reason: null,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) {
            console.error('[ShareRelationshipService] Error re-inviting:', error);
            return { success: false, error: 'Failed to send invite' };
          }

          return { success: true, invite_code: updated.invite_code, relationship: updated };
        }
      }

      // Create new relationship
      const { data: relationship, error } = await this.supabase
        .from('share_relationships')
        .insert({
          sharer_email: sharerEmail,
          caregiver_email: caregiverEmail,
          relationship_type: options.relationshipType,
          relationship_label: options.relationshipLabel || null,
          caregiver_role: options.caregiverRole || 'secondary',
          status: 'pending',
          is_bidirectional: options.isBidirectional || false,
          invite_message: options.inviteMessage || null,
          invite_sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[ShareRelationshipService] Error creating invite:', error);
        return { success: false, error: 'Failed to send invite' };
      }

      // If bidirectional, create the reverse relationship too
      if (options.isBidirectional) {
        const reverseType = this.getReverseRelationshipType(options.relationshipType);
        const { data: reverse, error: reverseError } = await this.supabase
          .from('share_relationships')
          .insert({
            sharer_email: caregiverEmail,
            caregiver_email: sharerEmail,
            relationship_type: reverseType,
            relationship_label: this.getReverseLabel(options.relationshipLabel),
            caregiver_role: options.caregiverRole || 'secondary',
            status: 'pending',
            is_bidirectional: true,
            reverse_relationship_id: relationship.id,
            invite_sent_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!reverseError && reverse) {
          // Update the original with reverse reference
          await this.supabase
            .from('share_relationships')
            .update({ reverse_relationship_id: reverse.id })
            .eq('id', relationship.id);
        }
      }

      // TODO: Send push notification to caregiver
      // await this.notifyNewInvite(caregiverEmail, sharerEmail, relationship.invite_code);

      return {
        success: true,
        invite_code: relationship.invite_code,
        relationship,
      };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in createInvite:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Accept a share invite
   */
  async acceptInvite(
    inviteCode: string,
    caregiverEmail: string
  ): Promise<{ success: boolean; error?: string; relationship?: ShareRelationship }> {
    try {
      // Find the invite
      const { data: invite, error: fetchError } = await this.supabase
        .from('share_relationships')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('caregiver_email', caregiverEmail)
        .eq('status', 'pending')
        .single();

      if (fetchError || !invite) {
        // Try looking up by email only (in case invite was created with their email)
        const { data: byEmail } = await this.supabase
          .from('share_relationships')
          .select('*')
          .eq('invite_code', inviteCode)
          .eq('status', 'pending')
          .single();

        if (!byEmail) {
          return { success: false, error: 'Invite not found or already used' };
        }

        // Update the caregiver email if it was a generic invite
        if (byEmail.caregiver_email !== caregiverEmail) {
          return { success: false, error: 'This invite is for a different email address' };
        }
      }

      // Accept the invite
      const { data: relationship, error: updateError } = await this.supabase
        .from('share_relationships')
        .update({
          status: 'active',
          invite_accepted_at: new Date().toISOString(),
        })
        .eq('invite_code', inviteCode)
        .select()
        .single();

      if (updateError) {
        console.error('[ShareRelationshipService] Error accepting invite:', updateError);
        return { success: false, error: 'Failed to accept invite' };
      }

      // If bidirectional, also accept the reverse relationship
      if (relationship.is_bidirectional && relationship.reverse_relationship_id) {
        await this.supabase
          .from('share_relationships')
          .update({
            status: 'active',
            invite_accepted_at: new Date().toISOString(),
          })
          .eq('id', relationship.reverse_relationship_id);
      }

      // Create default permissions (trigger will handle this, but ensure it exists)
      await this.ensurePermissionsExist(relationship.id);

      // TODO: Notify the sharer that their invite was accepted
      // await this.notifyInviteAccepted(relationship.sharer_email, caregiverEmail);

      return { success: true, relationship };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in acceptInvite:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Decline a share invite
   */
  async declineInvite(
    inviteCode: string,
    caregiverEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('share_relationships')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: 'declined_by_caregiver',
        })
        .eq('invite_code', inviteCode)
        .eq('caregiver_email', caregiverEmail)
        .eq('status', 'pending');

      if (error) {
        console.error('[ShareRelationshipService] Error declining invite:', error);
        return { success: false, error: 'Failed to decline invite' };
      }

      return { success: true };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in declineInvite:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Get pending invites for a caregiver
   */
  async getPendingInvites(caregiverEmail: string): Promise<PendingShareInvite[]> {
    const { data, error } = await this.supabase
      .from('share_relationships')
      .select('*')
      .eq('caregiver_email', caregiverEmail)
      .eq('status', 'pending')
      .order('invite_sent_at', { ascending: false });

    if (error) {
      console.error('[ShareRelationshipService] Error fetching pending invites:', error);
      return [];
    }

    // Get sharer names
    const sharerEmails = data?.map((r) => r.sharer_email) || [];
    const names = await this.getNamesForEmails(sharerEmails);

    return (data || []).map((r) => ({
      id: r.id,
      sharer_email: r.sharer_email,
      sharer_name: names[r.sharer_email] || null,
      relationship_type: r.relationship_type,
      relationship_label: r.relationship_label,
      invite_message: r.invite_message,
      invite_sent_at: r.invite_sent_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // RELATIONSHIP MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get all people a caregiver is monitoring
   */
  async getMonitoredPeople(caregiverEmail: string): Promise<MonitoredPerson[]> {
    const { data, error } = await this.supabase.rpc('get_share_monitored_people', {
      p_caregiver_email: caregiverEmail,
    });

    if (error) {
      console.error('[ShareRelationshipService] Error fetching monitored people:', error);
      return [];
    }

    // Enrich with permissions and status
    const results: MonitoredPerson[] = [];
    for (const row of data || []) {
      const permissions = await this.getPermissions(row.relationship_id);
      const alertCount = await this.getPendingAlertCount(row.sharer_email, caregiverEmail);
      const names = await this.getNamesForEmails([row.sharer_email]);

      results.push({
        relationship_id: row.relationship_id,
        sharer_email: row.sharer_email,
        sharer_label: row.sharer_label,
        sharer_name: names[row.sharer_email] || null,
        caregiver_role: row.caregiver_role,
        relationship_type: row.relationship_type,
        connected_since: row.connected_since,
        is_bidirectional: row.is_bidirectional,
        permissions,
        last_data_sync: null, // TODO: Get from health data
        current_status: 'unknown', // TODO: Calculate from recent health data
        pending_alerts_count: alertCount,
      });
    }

    return results;
  }

  /**
   * Get all caregivers for a sharer
   */
  async getCaregivers(sharerEmail: string): Promise<ShareRelationship[]> {
    const { data, error } = await this.supabase
      .from('share_relationships')
      .select('*')
      .eq('sharer_email', sharerEmail)
      .eq('status', 'active')
      .order('caregiver_role');

    if (error) {
      console.error('[ShareRelationshipService] Error fetching caregivers:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Pause sharing (temporarily stop sharing data)
   */
  async pauseSharing(
    sharerEmail: string,
    caregiverEmail: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('share_relationships')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_reason: reason || 'paused_by_sharer',
        })
        .eq('sharer_email', sharerEmail)
        .eq('caregiver_email', caregiverEmail)
        .eq('status', 'active');

      if (error) {
        console.error('[ShareRelationshipService] Error pausing sharing:', error);
        return { success: false, error: 'Failed to pause sharing' };
      }

      // TODO: Notify caregiver
      return { success: true };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in pauseSharing:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Resume sharing
   */
  async resumeSharing(
    sharerEmail: string,
    caregiverEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('share_relationships')
        .update({
          status: 'active',
          paused_at: null,
          pause_reason: null,
        })
        .eq('sharer_email', sharerEmail)
        .eq('caregiver_email', caregiverEmail)
        .eq('status', 'paused');

      if (error) {
        console.error('[ShareRelationshipService] Error resuming sharing:', error);
        return { success: false, error: 'Failed to resume sharing' };
      }

      // TODO: Notify caregiver
      return { success: true };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in resumeSharing:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Revoke sharing (permanently stop)
   */
  async revokeSharing(
    sharerEmail: string,
    caregiverEmail: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the relationship first
      const { data: rel } = await this.supabase
        .from('share_relationships')
        .select('*')
        .eq('sharer_email', sharerEmail)
        .eq('caregiver_email', caregiverEmail)
        .in('status', ['active', 'paused'])
        .single();

      if (!rel) {
        return { success: false, error: 'Relationship not found' };
      }

      // Revoke the relationship
      const { error } = await this.supabase
        .from('share_relationships')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: reason || 'revoked_by_sharer',
        })
        .eq('id', rel.id);

      if (error) {
        console.error('[ShareRelationshipService] Error revoking sharing:', error);
        return { success: false, error: 'Failed to revoke sharing' };
      }

      // If bidirectional, also revoke reverse
      if (rel.is_bidirectional && rel.reverse_relationship_id) {
        await this.supabase
          .from('share_relationships')
          .update({
            status: 'revoked',
            revoked_at: new Date().toISOString(),
            revoked_reason: 'revoked_by_partner',
          })
          .eq('id', rel.reverse_relationship_id);
      }

      // TODO: Notify caregiver
      return { success: true };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in revokeSharing:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Update caregiver role
   */
  async updateCaregiverRole(
    sharerEmail: string,
    caregiverEmail: string,
    role: CaregiverRole
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('share_relationships')
        .update({ caregiver_role: role })
        .eq('sharer_email', sharerEmail)
        .eq('caregiver_email', caregiverEmail)
        .eq('status', 'active');

      if (error) {
        console.error('[ShareRelationshipService] Error updating role:', error);
        return { success: false, error: 'Failed to update role' };
      }

      return { success: true };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in updateCaregiverRole:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  // ---------------------------------------------------------------------------
  // PERMISSIONS
  // ---------------------------------------------------------------------------

  /**
   * Get permissions for a relationship
   */
  async getPermissions(relationshipId: string): Promise<SharePermissions | null> {
    const { data, error } = await this.supabase
      .from('share_permissions')
      .select('*')
      .eq('relationship_id', relationshipId)
      .single();

    if (error || !data) {
      return null;
    }

    // Map to SharePermissions interface (excluding id, relationship_id, timestamps)
    const { id, relationship_id, created_at, updated_at, ...permissions } = data;
    return permissions as SharePermissions;
  }

  /**
   * Update permissions for a relationship
   */
  async updatePermissions(
    relationshipId: string,
    sharerEmail: string,
    permissions: Partial<SharePermissions>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the relationship belongs to this sharer
      const { data: rel } = await this.supabase
        .from('share_relationships')
        .select('id')
        .eq('id', relationshipId)
        .eq('sharer_email', sharerEmail)
        .single();

      if (!rel) {
        return { success: false, error: 'Relationship not found' };
      }

      const { error } = await this.supabase
        .from('share_permissions')
        .update(permissions)
        .eq('relationship_id', relationshipId);

      if (error) {
        console.error('[ShareRelationshipService] Error updating permissions:', error);
        return { success: false, error: 'Failed to update permissions' };
      }

      return { success: true };
    } catch (error) {
      console.error('[ShareRelationshipService] Error in updatePermissions:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Ensure permissions exist for a relationship
   */
  private async ensurePermissionsExist(relationshipId: string): Promise<void> {
    await this.supabase
      .from('share_permissions')
      .upsert({ relationship_id: relationshipId }, { onConflict: 'relationship_id' });
  }

  /**
   * Check if caregiver can access a specific metric
   */
  async canAccessMetric(
    sharerEmail: string,
    caregiverEmail: string,
    metricType: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('can_caregiver_access_metric', {
      p_sharer_email: sharerEmail,
      p_caregiver_email: caregiverEmail,
      p_metric_type: metricType,
    });

    if (error) {
      console.error('[ShareRelationshipService] Error checking metric access:', error);
      return false;
    }

    return data === true;
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Get display names for emails
   */
  private async getNamesForEmails(
    emails: string[]
  ): Promise<Record<string, string | null>> {
    if (emails.length === 0) return {};

    const { data } = await this.supabase
      .from('sage_onboarding_data')
      .select('email, form_data')
      .in('email', emails);

    const names: Record<string, string | null> = {};
    for (const user of data || []) {
      const formData = user.form_data as any;
      names[user.email] = formData?.name || formData?.full_name || null;
    }

    return names;
  }

  /**
   * Get pending alert count for a sharer
   */
  private async getPendingAlertCount(
    sharerEmail: string,
    caregiverEmail: string
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('share_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('sharer_email', sharerEmail)
      .contains('routed_to_caregivers', [caregiverEmail])
      .in('status', ['pending', 'sent']);

    if (error) {
      console.error('[ShareRelationshipService] Error counting alerts:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get reverse relationship type (for bidirectional)
   */
  private getReverseRelationshipType(type: RelationshipType): RelationshipType {
    const reverseMap: Record<RelationshipType, RelationshipType> = {
      spouse: 'spouse',
      child: 'parent',
      sibling: 'sibling',
      parent: 'child',
      grandparent: 'child', // Grandchild would be grandparent's child
      friend: 'friend',
      clinical_provider: 'other',
      professional_caregiver: 'other',
      other: 'other',
    };
    return reverseMap[type] || 'other';
  }

  /**
   * Get reverse label
   */
  private getReverseLabel(label: string | undefined): string | null {
    if (!label) return null;
    // Simple swap logic - could be enhanced
    const swaps: Record<string, string> = {
      Mom: 'Child',
      Dad: 'Child',
      Son: 'Parent',
      Daughter: 'Parent',
      Husband: 'Wife',
      Wife: 'Husband',
    };
    return swaps[label] || label;
  }

  // ---------------------------------------------------------------------------
  // STATISTICS
  // ---------------------------------------------------------------------------

  /**
   * Get share statistics
   */
  async getStats(userEmail: string): Promise<{
    people_i_monitor: number;
    people_monitoring_me: number;
    pending_invites_sent: number;
    pending_invites_received: number;
  }> {
    const [monitoringResult, monitoredByResult, sentResult, receivedResult] =
      await Promise.all([
        this.supabase
          .from('share_relationships')
          .select('id', { count: 'exact', head: true })
          .eq('caregiver_email', userEmail)
          .eq('status', 'active'),
        this.supabase
          .from('share_relationships')
          .select('id', { count: 'exact', head: true })
          .eq('sharer_email', userEmail)
          .eq('status', 'active'),
        this.supabase
          .from('share_relationships')
          .select('id', { count: 'exact', head: true })
          .eq('sharer_email', userEmail)
          .eq('status', 'pending'),
        this.supabase
          .from('share_relationships')
          .select('id', { count: 'exact', head: true })
          .eq('caregiver_email', userEmail)
          .eq('status', 'pending'),
      ]);

    return {
      people_i_monitor: monitoringResult.count || 0,
      people_monitoring_me: monitoredByResult.count || 0,
      pending_invites_sent: sentResult.count || 0,
      pending_invites_received: receivedResult.count || 0,
    };
  }
}

// Lazy singleton pattern to avoid build-time initialization errors
let _shareRelationshipServiceInstance: ShareRelationshipService | null = null;

export const shareRelationshipService = {
  get instance() {
    if (!_shareRelationshipServiceInstance) {
      _shareRelationshipServiceInstance = new ShareRelationshipService();
    }
    return _shareRelationshipServiceInstance;
  },
};

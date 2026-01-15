/**
 * Caregiving Tools (Moccet Share)
 * Tools for managing caregiving relationships, monitoring, and alerts
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// =============================================================================
// CAREGIVER READING TOOLS (As a sharer - who monitors me)
// =============================================================================

// Get my caregivers
export const getMyCaregiverTool: ToolDefinition = {
  name: 'get_my_caregivers',
  description: `Get the list of people who can see the user's health data (caregivers).
    Use when user asks "who can see my data?" or "who monitors my health?"`,
  riskLevel: 'low',
  parameters: z.object({}),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { data: relationships, error } = await context.supabase
        .from('share_relationships')
        .select(`
          *,
          share_permissions(*)
        `)
        .eq('sharer_email', context.userEmail)
        .eq('status', 'active');

      if (error) throw error;

      const caregivers = relationships?.map((r: any) => ({
        relationship_id: r.id,
        caregiver_email: r.caregiver_email,
        label: r.relationship_label,
        relationship_type: r.relationship_type,
        role: r.caregiver_role,
        connected_since: r.invite_accepted_at,
        permissions_summary: {
          sees_sleep: r.share_permissions?.[0]?.share_sleep_score,
          sees_activity: r.share_permissions?.[0]?.share_activity,
          sees_glucose: r.share_permissions?.[0]?.share_glucose || r.share_permissions?.[0]?.share_glucose_alerts_only,
          can_create_reminders: r.share_permissions?.[0]?.can_create_reminders,
          can_contact_emergency: r.share_permissions?.[0]?.can_contact_emergency,
        },
      })) || [];

      return {
        success: true,
        data: {
          caregiver_count: caregivers.length,
          caregivers,
        },
        metadata: {
          source: 'moccet_share',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get caregivers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get my sharing settings
export const getMySharingSettingsTool: ToolDefinition = {
  name: 'get_my_sharing_settings',
  description: `Get detailed sharing settings for a specific caregiver.
    Shows what health data they can see.`,
  riskLevel: 'low',
  parameters: z.object({
    caregiver_email: z.string().email().optional()
      .describe('Email of specific caregiver. If not provided, returns all settings.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { caregiver_email } = params;

      let query = context.supabase
        .from('share_relationships')
        .select(`
          *,
          share_permissions(*)
        `)
        .eq('sharer_email', context.userEmail)
        .eq('status', 'active');

      if (caregiver_email) {
        query = query.eq('caregiver_email', caregiver_email);
      }

      const { data: relationships, error } = await query;

      if (error) throw error;

      const settings = relationships?.map((r: any) => {
        const perms = r.share_permissions?.[0] || {};
        return {
          caregiver_email: r.caregiver_email,
          label: r.relationship_label,
          sharing: {
            sleep: { score: perms.share_sleep_score, details: perms.share_sleep_details, trends: perms.share_sleep_trends },
            heart: { hrv: perms.share_hrv, resting_hr: perms.share_resting_hr, recovery: perms.share_recovery },
            activity: { enabled: perms.share_activity, steps: perms.share_steps, workouts: perms.share_workouts },
            glucose: { full_data: perms.share_glucose, alerts_only: perms.share_glucose_alerts_only },
            nutrition: { enabled: perms.share_nutrition, alerts_only: perms.share_nutrition_alerts_only, hydration: perms.share_hydration },
            location: { enabled: perms.share_location, history: perms.share_location_history, geofence_alerts: perms.share_geofence_alerts },
          },
          alert_levels: {
            critical: perms.receive_critical_alerts,
            high: perms.receive_high_alerts,
            medium: perms.receive_medium_alerts,
            low: perms.receive_low_alerts,
          },
          actions_allowed: {
            create_reminders: perms.can_create_reminders,
            initiate_deliveries: perms.can_initiate_deliveries,
            contact_emergency: perms.can_contact_emergency,
          },
        };
      }) || [];

      return {
        success: true,
        data: {
          settings,
        },
        metadata: {
          source: 'sharing_settings',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get sharing settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// CAREGIVER READING TOOLS (As a caregiver - who I monitor)
// =============================================================================

// Get care recipients
export const getCareRecipientsTool: ToolDefinition = {
  name: 'get_care_recipients',
  description: `Get the list of people the user monitors as a caregiver.
    Use when user asks "who am I monitoring?" or "how is mom doing?"`,
  riskLevel: 'low',
  parameters: z.object({}),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { data: relationships, error } = await context.supabase
        .from('share_relationships')
        .select('*')
        .eq('caregiver_email', context.userEmail)
        .eq('status', 'active');

      if (error) throw error;

      // Get latest health snapshot for each recipient
      const recipients = await Promise.all(
        (relationships || []).map(async (r: any) => {
          const { data: snapshot } = await context.supabase
            .from('share_health_snapshots')
            .select('overall_status, metrics, snapshot_at')
            .eq('user_email', r.sharer_email)
            .eq('snapshot_type', 'daily')
            .order('snapshot_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get pending alerts
          const { count: alertCount } = await context.supabase
            .from('share_alerts')
            .select('*', { count: 'exact', head: true })
            .eq('sharer_email', r.sharer_email)
            .contains('routed_to_caregivers', [context.userEmail])
            .in('status', ['pending', 'sent']);

          return {
            email: r.sharer_email,
            label: r.relationship_label,
            relationship_type: r.relationship_type,
            your_role: r.caregiver_role,
            connected_since: r.invite_accepted_at,
            current_status: snapshot?.overall_status || 'unknown',
            last_update: snapshot?.snapshot_at,
            pending_alerts: alertCount || 0,
          };
        })
      );

      return {
        success: true,
        data: {
          recipient_count: recipients.length,
          recipients,
        },
        metadata: {
          source: 'care_recipients',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get care recipients: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get care recipient status
export const getCareRecipientStatusTool: ToolDefinition = {
  name: 'get_care_recipient_status',
  description: `Get the current health status of someone you're monitoring.
    Use when user asks about a specific care recipient's health.`,
  riskLevel: 'low',
  parameters: z.object({
    email: z.string().email()
      .describe('Email of the person to check status for'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { email } = params;

      // Verify caregiver relationship
      const { data: relationship } = await context.supabase
        .from('share_relationships')
        .select('*, share_permissions(*)')
        .eq('caregiver_email', context.userEmail)
        .eq('sharer_email', email)
        .eq('status', 'active')
        .maybeSingle();

      if (!relationship) {
        return {
          success: false,
          error: "You don't have access to this person's health data",
        };
      }

      // Get latest snapshot
      const { data: snapshot } = await context.supabase
        .from('share_health_snapshots')
        .select('*')
        .eq('user_email', email)
        .eq('snapshot_type', 'daily')
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get recent alerts
      const { data: alerts } = await context.supabase
        .from('share_alerts')
        .select('*')
        .eq('sharer_email', email)
        .contains('routed_to_caregivers', [context.userEmail])
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        success: true,
        data: {
          label: relationship.relationship_label,
          email,
          overall_status: snapshot?.overall_status || 'unknown',
          last_update: snapshot?.snapshot_at,
          metrics: snapshot?.metrics || {},
          trends: snapshot?.trends || {},
          recommendations: snapshot?.recommendations || [],
          recent_alerts: alerts?.map((a: any) => ({
            type: a.alert_type,
            severity: a.severity,
            title: a.title,
            created_at: a.created_at,
            status: a.status,
          })) || [],
        },
        metadata: {
          source: 'care_recipient_status',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get care recipient status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get care alerts
export const getCareAlertsTool: ToolDefinition = {
  name: 'get_care_alerts',
  description: `Get pending health alerts for all care recipients.
    Use when checking if anyone needs attention.`,
  riskLevel: 'low',
  parameters: z.object({
    severity: z.enum(['all', 'critical', 'high', 'medium', 'low']).optional()
      .describe('Filter by severity level. Defaults to all.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { severity = 'all' } = params;

      let query = context.supabase
        .from('share_alerts')
        .select(`
          *,
          share_relationships!inner(relationship_label)
        `)
        .contains('routed_to_caregivers', [context.userEmail])
        .in('status', ['pending', 'sent'])
        .order('severity')
        .order('created_at', { ascending: false });

      if (severity !== 'all') {
        query = query.eq('severity', severity);
      }

      const { data: alerts, error } = await query.limit(20);

      if (error) throw error;

      const formattedAlerts = alerts?.map((a: any) => ({
        alert_id: a.id,
        recipient_email: a.sharer_email,
        recipient_label: a.share_relationships?.relationship_label,
        type: a.alert_type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        recommendation: a.actionable_recommendation,
        suggested_actions: a.suggested_actions,
        created_at: a.created_at,
        status: a.status,
      })) || [];

      // Group by severity
      const bySeverity = {
        critical: formattedAlerts.filter(a => a.severity === 'critical'),
        high: formattedAlerts.filter(a => a.severity === 'high'),
        medium: formattedAlerts.filter(a => a.severity === 'medium'),
        low: formattedAlerts.filter(a => a.severity === 'low'),
        info: formattedAlerts.filter(a => a.severity === 'info'),
      };

      return {
        success: true,
        data: {
          total_alerts: formattedAlerts.length,
          by_severity: bySeverity,
          alerts: formattedAlerts,
        },
        metadata: {
          source: 'care_alerts',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get care alerts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// SHARING MANAGEMENT TOOLS
// =============================================================================

// Invite caregiver
export const inviteCaregiverTool: ToolDefinition = {
  name: 'invite_caregiver',
  description: `Invite someone to be a caregiver and monitor your health.
    Use when user wants to share their health data with a family member.`,
  riskLevel: 'medium',
  parameters: z.object({
    email: z.string().email()
      .describe('Email of the person to invite'),
    relationship_type: z.enum([
      'spouse', 'child', 'sibling', 'parent', 'grandparent',
      'friend', 'clinical_provider', 'professional_caregiver', 'other'
    ]).describe('Type of relationship'),
    label: z.string().max(50).optional()
      .describe('Custom label like "Mom" or "Dr. Smith"'),
    role: z.enum(['primary', 'secondary', 'clinical', 'emergency_only']).optional()
      .describe('Caregiver role. Defaults to secondary.'),
    message: z.string().max(200).optional()
      .describe('Optional message to include with invite'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { email, relationship_type, label, role = 'secondary', message } = params;

      if (email === context.userEmail) {
        return {
          success: false,
          error: "You can't invite yourself as a caregiver",
        };
      }

      // Check if relationship already exists
      const { data: existing } = await context.supabase
        .from('share_relationships')
        .select('status')
        .eq('sharer_email', context.userEmail)
        .eq('caregiver_email', email)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `Relationship already exists with status: ${existing.status}`,
        };
      }

      // Create the invitation
      const { data: relationship, error } = await context.supabase
        .from('share_relationships')
        .insert({
          sharer_email: context.userEmail,
          caregiver_email: email,
          relationship_type,
          relationship_label: label,
          caregiver_role: role,
          status: 'pending',
          invite_message: message,
          invite_sent_at: new Date().toISOString(),
        })
        .select('id, invite_code')
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          relationship_id: relationship.id,
          invite_code: relationship.invite_code,
          sent_to: email,
          role,
          message: `Caregiver invitation sent to ${email}`,
        },
        metadata: {
          source: 'caregiver_invite',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to invite caregiver: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Update sharing permissions
export const updateSharingPermissionsTool: ToolDefinition = {
  name: 'update_sharing_permissions',
  description: `Update what health data a caregiver can see.
    Use when user wants to change what they share with a caregiver.`,
  riskLevel: 'medium',
  parameters: z.object({
    caregiver_email: z.string().email()
      .describe('Email of the caregiver to update permissions for'),
    permissions: z.object({
      share_sleep_score: z.boolean().optional(),
      share_sleep_details: z.boolean().optional(),
      share_activity: z.boolean().optional(),
      share_steps: z.boolean().optional(),
      share_glucose: z.boolean().optional(),
      share_glucose_alerts_only: z.boolean().optional(),
      share_hrv: z.boolean().optional(),
      share_recovery: z.boolean().optional(),
      share_hydration: z.boolean().optional(),
      share_location: z.boolean().optional(),
      receive_critical_alerts: z.boolean().optional(),
      receive_high_alerts: z.boolean().optional(),
      can_create_reminders: z.boolean().optional(),
      can_contact_emergency: z.boolean().optional(),
    }).describe('Permissions to update'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { caregiver_email, permissions } = params;

      // Get relationship ID
      const { data: relationship, error: relError } = await context.supabase
        .from('share_relationships')
        .select('id')
        .eq('sharer_email', context.userEmail)
        .eq('caregiver_email', caregiver_email)
        .eq('status', 'active')
        .single();

      if (relError || !relationship) {
        return {
          success: false,
          error: 'Active caregiver relationship not found',
        };
      }

      // Update permissions
      const { error: updateError } = await context.supabase
        .from('share_permissions')
        .update(permissions)
        .eq('relationship_id', relationship.id);

      if (updateError) throw updateError;

      return {
        success: true,
        data: {
          caregiver_email,
          updated_permissions: permissions,
          message: `Sharing permissions updated for ${caregiver_email}`,
        },
        metadata: {
          source: 'sharing_permissions_update',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update sharing permissions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Pause sharing
export const pauseSharingTool: ToolDefinition = {
  name: 'pause_sharing',
  description: `Temporarily pause sharing health data with a caregiver.
    They won't see updates until sharing is resumed.`,
  riskLevel: 'medium',
  parameters: z.object({
    caregiver_email: z.string().email()
      .describe('Email of the caregiver to pause sharing with'),
    reason: z.string().max(200).optional()
      .describe('Optional reason for pausing'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { caregiver_email, reason } = params;

      const { data, error } = await context.supabase
        .from('share_relationships')
        .update({
          status: 'paused',
          pause_reason: reason,
        })
        .eq('sharer_email', context.userEmail)
        .eq('caregiver_email', caregiver_email)
        .eq('status', 'active')
        .select('relationship_label')
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'Active caregiver relationship not found',
        };
      }

      return {
        success: true,
        data: {
          paused: true,
          caregiver_email,
          label: data.relationship_label,
          reason,
          message: `Sharing paused with ${data.relationship_label || caregiver_email}`,
        },
        metadata: {
          source: 'sharing_pause',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pause sharing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Revoke sharing
export const revokeSharingTool: ToolDefinition = {
  name: 'revoke_sharing',
  description: `Permanently revoke a caregiver's access to your health data.
    This cannot be undone - they would need to be re-invited.`,
  riskLevel: 'medium',
  parameters: z.object({
    caregiver_email: z.string().email()
      .describe('Email of the caregiver to revoke access for'),
    reason: z.string().max(200).optional()
      .describe('Optional reason for revoking'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { caregiver_email, reason } = params;

      const { data, error } = await context.supabase
        .from('share_relationships')
        .update({
          status: 'revoked',
          revoked_reason: reason,
        })
        .eq('sharer_email', context.userEmail)
        .eq('caregiver_email', caregiver_email)
        .in('status', ['active', 'paused'])
        .select('relationship_label')
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'Caregiver relationship not found',
        };
      }

      return {
        success: true,
        data: {
          revoked: true,
          caregiver_email,
          label: data.relationship_label,
          reason,
          message: `Access revoked for ${data.relationship_label || caregiver_email}`,
        },
        metadata: {
          source: 'sharing_revoke',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to revoke sharing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// CAREGIVER ACTION TOOLS
// =============================================================================

// Acknowledge alert
export const acknowledgeAlertTool: ToolDefinition = {
  name: 'acknowledge_alert',
  description: `Acknowledge a care alert you've received.
    Marks it as seen so other caregivers know it's being handled.`,
  riskLevel: 'medium',
  parameters: z.object({
    alert_id: z.string().uuid()
      .describe('ID of the alert to acknowledge'),
    notes: z.string().max(500).optional()
      .describe('Optional notes about what action was taken'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { alert_id, notes } = params;

      const { data, error } = await context.supabase
        .from('share_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: context.userEmail,
          acknowledged_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq('id', alert_id)
        .contains('routed_to_caregivers', [context.userEmail])
        .select('title, sharer_email')
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'Alert not found or not routed to you',
        };
      }

      return {
        success: true,
        data: {
          acknowledged: true,
          alert_title: data.title,
          recipient_email: data.sharer_email,
          notes,
        },
        metadata: {
          source: 'alert_acknowledge',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to acknowledge alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Create reminder for care recipient
export const createReminderTool: ToolDefinition = {
  name: 'create_reminder',
  description: `Create a health reminder for someone you're caring for.
    Use to remind them about hydration, medication, activity, etc.`,
  riskLevel: 'medium',
  parameters: z.object({
    recipient_email: z.string().email()
      .describe('Email of the care recipient'),
    reminder_type: z.enum(['hydration', 'medication', 'activity', 'meal', 'stretch', 'check_in', 'other'])
      .describe('Type of reminder'),
    message: z.string().max(200)
      .describe('Custom message for the reminder'),
    scheduled_time: z.string().optional()
      .describe('ISO timestamp for when to send. Defaults to now.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { recipient_email, reminder_type, message, scheduled_time } = params;

      // Verify caregiver relationship with permission
      const { data: relationship, error: relError } = await context.supabase
        .from('share_relationships')
        .select('id, relationship_label, share_permissions(*)')
        .eq('caregiver_email', context.userEmail)
        .eq('sharer_email', recipient_email)
        .eq('status', 'active')
        .single();

      if (relError || !relationship) {
        return {
          success: false,
          error: 'Active caregiver relationship not found',
        };
      }

      if (!relationship.share_permissions?.[0]?.can_create_reminders) {
        return {
          success: false,
          error: 'You do not have permission to create reminders for this person',
        };
      }

      // Create the intervention/reminder
      const { data: intervention, error } = await context.supabase
        .from('share_interventions')
        .insert({
          user_email: recipient_email,
          intervention_type: 'reminder',
          subtype: reminder_type,
          trigger_type: 'caregiver_initiated',
          config: { message },
          next_scheduled_at: scheduled_time || new Date().toISOString(),
          created_by: context.userEmail,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          intervention_id: intervention.id,
          recipient: relationship.relationship_label || recipient_email,
          reminder_type,
          message,
          scheduled_for: intervention.next_scheduled_at,
        },
        metadata: {
          source: 'reminder_create',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Request check-in
export const requestCheckinTool: ToolDefinition = {
  name: 'request_checkin',
  description: `Request a check-in from someone you're monitoring.
    They'll receive a notification to let you know they're okay.`,
  riskLevel: 'medium',
  parameters: z.object({
    recipient_email: z.string().email()
      .describe('Email of the care recipient'),
    message: z.string().max(200).optional()
      .describe('Optional message explaining why you want to check in'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { recipient_email, message } = params;

      // Verify caregiver relationship
      const { data: relationship } = await context.supabase
        .from('share_relationships')
        .select('id, relationship_label')
        .eq('caregiver_email', context.userEmail)
        .eq('sharer_email', recipient_email)
        .eq('status', 'active')
        .single();

      if (!relationship) {
        return {
          success: false,
          error: 'Active caregiver relationship not found',
        };
      }

      // Create check-in request intervention
      const { data: intervention, error } = await context.supabase
        .from('share_interventions')
        .insert({
          user_email: recipient_email,
          intervention_type: 'scheduled_check_in',
          subtype: 'requested',
          trigger_type: 'caregiver_initiated',
          config: {
            requested_by: context.userEmail,
            message: message || 'Your caregiver would like to know how you are doing.',
          },
          next_scheduled_at: new Date().toISOString(),
          created_by: context.userEmail,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          checkin_id: intervention.id,
          recipient: relationship.relationship_label || recipient_email,
          message,
          status: 'Sent check-in request',
        },
        metadata: {
          source: 'checkin_request',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to request check-in: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Trigger emergency contact (HIGH RISK)
export const triggerEmergencyContactTool: ToolDefinition = {
  name: 'trigger_emergency_contact',
  description: `EMERGENCY: Contact emergency services for a care recipient.
    Use only in genuine emergency situations. This is a HIGH RISK action.`,
  riskLevel: 'high',
  parameters: z.object({
    recipient_email: z.string().email()
      .describe('Email of the care recipient'),
    reason: z.string().min(10).max(500)
      .describe('Detailed reason for the emergency contact'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { recipient_email, reason } = params;

      // Verify caregiver relationship with emergency permission
      const { data: relationship, error: relError } = await context.supabase
        .from('share_relationships')
        .select('id, relationship_label, share_permissions(*)')
        .eq('caregiver_email', context.userEmail)
        .eq('sharer_email', recipient_email)
        .eq('status', 'active')
        .single();

      if (relError || !relationship) {
        return {
          success: false,
          error: 'Active caregiver relationship not found',
        };
      }

      if (!relationship.share_permissions?.[0]?.can_contact_emergency) {
        return {
          success: false,
          error: 'You do not have permission to contact emergency services for this person',
        };
      }

      // Create critical alert
      const { data: alert, error } = await context.supabase
        .from('share_alerts')
        .insert({
          sharer_email: recipient_email,
          alert_type: 'fall_detected', // Using existing type for emergency
          severity: 'critical',
          title: 'Emergency Contact Triggered by Caregiver',
          message: reason,
          context_data: {
            triggered_by: context.userEmail,
            reason,
            timestamp: new Date().toISOString(),
          },
          routed_to_caregivers: [context.userEmail],
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Create emergency intervention
      await context.supabase
        .from('share_interventions')
        .insert({
          user_email: recipient_email,
          intervention_type: 'emergency_contact',
          trigger_type: 'caregiver_initiated',
          config: { reason, triggered_by: context.userEmail },
          created_by: context.userEmail,
          status: 'active',
        });

      return {
        success: true,
        data: {
          alert_id: alert.id,
          recipient: relationship.relationship_label || recipient_email,
          status: 'EMERGENCY CONTACT TRIGGERED',
          reason,
          message: 'Emergency services have been notified. Check on your loved one immediately.',
        },
        metadata: {
          source: 'emergency_contact',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to trigger emergency contact: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Export all caregiving tools
export const caregivingTools = [
  getMyCaregiverTool,
  getMySharingSettingsTool,
  getCareRecipientsTool,
  getCareRecipientStatusTool,
  getCareAlertsTool,
  inviteCaregiverTool,
  updateSharingPermissionsTool,
  pauseSharingTool,
  revokeSharingTool,
  acknowledgeAlertTool,
  createReminderTool,
  requestCheckinTool,
  triggerEmergencyContactTool,
];

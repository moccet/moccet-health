/**
 * Alert Routing Service
 * Routes health alerts to appropriate caregivers based on severity, permissions, and roles
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AnomalyResult, PatternBreak, AlertSeverity, AlertType, HealthSnapshot } from './anomaly-detection-service';

// =============================================================================
// TYPES
// =============================================================================

export type AlertStatus = 'pending' | 'sent' | 'acknowledged' | 'resolved' | 'escalated' | 'expired';

export interface ShareAlert {
  id: string;
  sharer_email: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context_data: HealthContext;
  actionable_recommendation: string | null;
  routed_to_caregivers: string[];
  routed_to_clinical: boolean;
  status: AlertStatus;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  escalated_at: string | null;
  expires_at: string | null;
}

export interface HealthContext {
  snapshot: HealthSnapshot | null;
  recentMetrics: Record<string, number>;
  trends: Record<string, string>;
  medications: MedicationStatus[];
  recentEvents: ContextEvent[];
  baselineComparisons: BaselineComparison[];
}

export interface MedicationStatus {
  name: string;
  lastTaken: string | null;
  nextDue: string | null;
  compliance24h: number;
  missedDoses: number;
}

export interface ContextEvent {
  type: string;
  description: string;
  timestamp: string;
  severity: string | null;
}

export interface BaselineComparison {
  metric: string;
  current: number;
  baseline: number;
  deviationPct: number;
  trend: string;
}

export interface CaregiverNotification {
  caregiverEmail: string;
  caregiverRole: string;
  alertId: string;
  channel: 'push' | 'sms' | 'email';
  priority: 'critical' | 'high' | 'normal';
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface EscalationRule {
  severity: AlertSeverity;
  escalateAfterMinutes: number;
  escalateTo: 'secondary' | 'all' | 'clinical' | 'emergency';
  channels: ('push' | 'sms' | 'email')[];
}

// =============================================================================
// DEFAULT ESCALATION RULES
// =============================================================================

const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    severity: 'critical',
    escalateAfterMinutes: 5,
    escalateTo: 'all',
    channels: ['push', 'sms'],
  },
  {
    severity: 'high',
    escalateAfterMinutes: 30,
    escalateTo: 'secondary',
    channels: ['push'],
  },
  {
    severity: 'medium',
    escalateAfterMinutes: 60,
    escalateTo: 'secondary',
    channels: ['push'],
  },
];

// =============================================================================
// SERVICE
// =============================================================================

export class AlertRoutingService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ---------------------------------------------------------------------------
  // ALERT CREATION
  // ---------------------------------------------------------------------------

  /**
   * Create and route an alert based on anomaly detection
   */
  async createAlert(
    sharerEmail: string,
    alertType: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    context: HealthContext,
    recommendation?: string
  ): Promise<ShareAlert> {
    // Get eligible caregivers for this severity
    const caregivers = await this.getEligibleCaregivers(sharerEmail, severity);
    const caregiverEmails = caregivers.map(c => c.caregiver_email);

    // Determine if clinical should be notified
    const routeToClinical = severity === 'critical' || alertType === 'fall_detected';

    // Calculate expiration (critical: 24h, high: 48h, medium: 72h, low: 7d)
    const expirationHours: Record<AlertSeverity, number> = {
      critical: 24,
      high: 48,
      medium: 72,
      low: 168,
      info: 336,
    };
    const expiresAt = new Date(Date.now() + expirationHours[severity] * 60 * 60 * 1000);

    // Create alert record
    const { data: alert, error } = await this.supabase
      .from('share_alerts')
      .insert({
        sharer_email: sharerEmail,
        alert_type: alertType,
        severity,
        title,
        message,
        context_data: context,
        actionable_recommendation: recommendation,
        routed_to_caregivers: caregiverEmails,
        routed_to_clinical: routeToClinical,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create alert: ${error.message}`);

    // Send notifications to caregivers
    await this.notifyCaregivers(alert as ShareAlert, caregivers);

    // Notify clinical if required
    if (routeToClinical) {
      await this.notifyClinicalTeam(sharerEmail, alert as ShareAlert);
    }

    // Update alert status to sent
    await this.supabase
      .from('share_alerts')
      .update({ status: 'sent' })
      .eq('id', alert.id);

    return alert as ShareAlert;
  }

  /**
   * Create alert from anomaly result
   */
  async createAlertFromAnomaly(
    sharerEmail: string,
    anomaly: AnomalyResult,
    context: HealthContext
  ): Promise<ShareAlert | null> {
    if (!anomaly.isAnomaly || !anomaly.severity) return null;

    return this.createAlert(
      sharerEmail,
      'anomaly_detected',
      anomaly.severity,
      anomaly.message || 'Health metric anomaly detected',
      anomaly.message || '',
      context,
      anomaly.recommendation || undefined
    );
  }

  /**
   * Create alert from pattern break
   */
  async createAlertFromPatternBreak(
    sharerEmail: string,
    patternBreak: PatternBreak,
    context: HealthContext
  ): Promise<ShareAlert> {
    const alertTypeMap: Record<string, AlertType> = {
      no_activity_data: 'activity_drop',
      low_activity: 'activity_drop',
      no_sleep_data: 'sleep_disruption',
      medication_missed: 'medication_missed',
      no_data: 'no_data_received',
      sync_gap: 'no_data_received',
    };

    const alertType = alertTypeMap[patternBreak.patternType] || 'pattern_break';

    return this.createAlert(
      sharerEmail,
      alertType,
      patternBreak.severity,
      this.getPatternBreakTitle(patternBreak),
      patternBreak.description,
      context,
      this.getPatternBreakRecommendation(patternBreak)
    );
  }

  // ---------------------------------------------------------------------------
  // CAREGIVER ROUTING
  // ---------------------------------------------------------------------------

  /**
   * Get caregivers eligible to receive alerts of a given severity
   */
  private async getEligibleCaregivers(
    sharerEmail: string,
    severity: AlertSeverity
  ): Promise<Array<{ caregiver_email: string; caregiver_role: string; permissions: Record<string, boolean> }>> {
    // Get all active relationships for this sharer
    const { data: relationships, error } = await this.supabase
      .from('share_relationships')
      .select(`
        caregiver_email,
        caregiver_role,
        share_permissions (*)
      `)
      .eq('sharer_email', sharerEmail)
      .eq('status', 'active');

    if (error || !relationships) return [];

    // Filter by alert permission based on severity
    return relationships.filter(rel => {
      const perms = rel.share_permissions as Record<string, boolean>;
      if (!perms) return false;

      switch (severity) {
        case 'critical':
          return perms.receive_critical_alerts !== false;
        case 'high':
          return perms.receive_high_alerts !== false;
        case 'medium':
          return perms.receive_medium_alerts !== false;
        case 'low':
          return perms.receive_low_alerts !== false;
        case 'info':
          return perms.receive_info_alerts !== false;
        default:
          return true;
      }
    }).map(rel => ({
      caregiver_email: rel.caregiver_email,
      caregiver_role: rel.caregiver_role,
      permissions: rel.share_permissions as Record<string, boolean>,
    }));
  }

  /**
   * Check if we should send alert to caregiver based on quiet hours, etc.
   */
  private shouldSendNow(
    caregiverEmail: string,
    severity: AlertSeverity,
    role: string
  ): { send: boolean; channel: 'push' | 'sms' | 'email' } {
    // For now, always send critical and high immediately
    // In future: check quiet hours, preferences, etc.

    if (severity === 'critical') {
      return { send: true, channel: 'push' }; // Could add SMS for critical
    }

    if (severity === 'high') {
      return { send: true, channel: 'push' };
    }

    // For medium/low, only send during reasonable hours
    const hour = new Date().getHours();
    if (hour >= 7 && hour <= 22) {
      return { send: true, channel: 'push' };
    }

    // Queue for morning if during quiet hours
    return { send: false, channel: 'push' };
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------------------------------------

  /**
   * Send notifications to all eligible caregivers
   */
  private async notifyCaregivers(
    alert: ShareAlert,
    caregivers: Array<{ caregiver_email: string; caregiver_role: string }>
  ): Promise<void> {
    const notifications: CaregiverNotification[] = [];

    for (const caregiver of caregivers) {
      const { send, channel } = this.shouldSendNow(
        caregiver.caregiver_email,
        alert.severity,
        caregiver.caregiver_role
      );

      if (!send) continue;

      const priority = alert.severity === 'critical' ? 'critical'
        : alert.severity === 'high' ? 'high'
        : 'normal';

      notifications.push({
        caregiverEmail: caregiver.caregiver_email,
        caregiverRole: caregiver.caregiver_role,
        alertId: alert.id,
        channel,
        priority,
        title: this.formatNotificationTitle(alert),
        body: this.formatNotificationBody(alert),
        data: {
          alertId: alert.id,
          sharerEmail: alert.sharer_email,
          alertType: alert.alert_type,
          severity: alert.severity,
        },
      });
    }

    // Send all notifications
    await Promise.all(notifications.map(n => this.sendNotification(n)));

    // Log notifications
    for (const n of notifications) {
      await this.logNotification(n);
    }
  }

  /**
   * Send a single notification
   */
  private async sendNotification(notification: CaregiverNotification): Promise<void> {
    // Get FCM token for caregiver
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('fcm_token')
      .eq('email', notification.caregiverEmail)
      .single();

    if (!profile?.fcm_token && notification.channel === 'push') {
      console.warn(`No FCM token for ${notification.caregiverEmail}, skipping push`);
      return;
    }

    // Use existing notification infrastructure
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: profile?.fcm_token,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          priority: notification.priority,
          channel: 'share_alerts',
        }),
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Log notification for tracking
   */
  private async logNotification(notification: CaregiverNotification): Promise<void> {
    await this.supabase.from('notification_logs').insert({
      user_email: notification.caregiverEmail,
      notification_type: 'share_alert',
      title: notification.title,
      body: notification.body,
      data: notification.data,
      channel: notification.channel,
      sent_at: new Date().toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // CLINICAL ROUTING
  // ---------------------------------------------------------------------------

  /**
   * Notify clinical team for critical alerts
   */
  private async notifyClinicalTeam(sharerEmail: string, alert: ShareAlert): Promise<void> {
    // Get clinical providers for this user
    const { data: providers } = await this.supabase
      .from('share_clinical_coordination')
      .select('*')
      .eq('user_email', sharerEmail)
      .eq('share_alerts', true);

    if (!providers || providers.length === 0) return;

    for (const provider of providers) {
      // Create clinical alert record
      const { data: clinicalAlert } = await this.supabase
        .from('share_clinical_alerts')
        .insert({
          coordination_id: provider.id,
          user_email: sharerEmail,
          provider_email: provider.provider_email,
          alert_type: alert.alert_type,
          summary: `${alert.severity.toUpperCase()}: ${alert.title}`,
          detailed_report: {
            alert,
            context: alert.context_data,
          },
          visible_to_caregivers: true,
          caregiver_view_summary: `Clinical team notified about: ${alert.title}`,
        })
        .select()
        .single();

      // In future: Send actual notification to clinical provider
      // (email, fax, portal integration)
      console.log(`Clinical alert created for provider ${provider.provider_email}`);
    }
  }

  // ---------------------------------------------------------------------------
  // ESCALATION
  // ---------------------------------------------------------------------------

  /**
   * Check and escalate unacknowledged alerts
   */
  async processEscalations(): Promise<number> {
    let escalatedCount = 0;

    for (const rule of DEFAULT_ESCALATION_RULES) {
      // Find alerts that need escalation
      const cutoff = new Date(Date.now() - rule.escalateAfterMinutes * 60 * 1000);

      const { data: alerts } = await this.supabase
        .from('share_alerts')
        .select('*')
        .eq('severity', rule.severity)
        .eq('status', 'sent')
        .lt('created_at', cutoff.toISOString())
        .is('escalated_at', null);

      if (!alerts) continue;

      for (const alert of alerts) {
        await this.escalateAlert(alert as ShareAlert, rule);
        escalatedCount++;
      }
    }

    return escalatedCount;
  }

  /**
   * Escalate a single alert
   */
  private async escalateAlert(alert: ShareAlert, rule: EscalationRule): Promise<void> {
    // Get additional caregivers to notify based on escalation target
    let additionalCaregivers: string[] = [];

    if (rule.escalateTo === 'secondary' || rule.escalateTo === 'all') {
      const { data: secondaries } = await this.supabase
        .from('share_relationships')
        .select('caregiver_email')
        .eq('sharer_email', alert.sharer_email)
        .eq('status', 'active')
        .eq('caregiver_role', 'secondary');

      if (secondaries) {
        additionalCaregivers = secondaries
          .map(s => s.caregiver_email)
          .filter(e => !alert.routed_to_caregivers.includes(e));
      }
    }

    if (rule.escalateTo === 'all') {
      const { data: allCaregivers } = await this.supabase
        .from('share_relationships')
        .select('caregiver_email')
        .eq('sharer_email', alert.sharer_email)
        .eq('status', 'active');

      if (allCaregivers) {
        additionalCaregivers = allCaregivers
          .map(c => c.caregiver_email)
          .filter(e => !alert.routed_to_caregivers.includes(e));
      }
    }

    // Update alert
    const updatedCaregivers = [...alert.routed_to_caregivers, ...additionalCaregivers];

    await this.supabase
      .from('share_alerts')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        routed_to_caregivers: updatedCaregivers,
      })
      .eq('id', alert.id);

    // Send escalation notifications
    for (const email of additionalCaregivers) {
      for (const channel of rule.channels) {
        await this.sendNotification({
          caregiverEmail: email,
          caregiverRole: 'escalation',
          alertId: alert.id,
          channel,
          priority: 'high',
          title: `ESCALATED: ${alert.title}`,
          body: `Alert not acknowledged. ${alert.message}`,
          data: { alertId: alert.id, escalated: true },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ALERT MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, caregiverEmail: string): Promise<ShareAlert> {
    const { data, error } = await this.supabase
      .from('share_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: caregiverEmail,
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw new Error(`Failed to acknowledge alert: ${error.message}`);
    return data as ShareAlert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    caregiverEmail: string,
    resolution?: string
  ): Promise<ShareAlert> {
    const { data, error } = await this.supabase
      .from('share_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: caregiverEmail,
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw new Error(`Failed to resolve alert: ${error.message}`);
    return data as ShareAlert;
  }

  /**
   * Get alerts for a caregiver
   */
  async getAlertsForCaregiver(
    caregiverEmail: string,
    options?: {
      status?: AlertStatus[];
      severity?: AlertSeverity[];
      limit?: number;
      offset?: number;
    }
  ): Promise<ShareAlert[]> {
    // Get all monitored people for this caregiver
    const { data: relationships } = await this.supabase
      .from('share_relationships')
      .select('sharer_email')
      .eq('caregiver_email', caregiverEmail)
      .eq('status', 'active');

    if (!relationships || relationships.length === 0) return [];

    const sharerEmails = relationships.map(r => r.sharer_email);

    let query = this.supabase
      .from('share_alerts')
      .select('*')
      .in('sharer_email', sharerEmails)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.in('status', options.status);
    }
    if (options?.severity) {
      query = query.in('severity', options.severity);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data } = await query;
    return (data || []) as ShareAlert[];
  }

  /**
   * Get alerts for a specific sharer
   */
  async getAlertsForSharer(
    sharerEmail: string,
    caregiverEmail: string,
    options?: {
      status?: AlertStatus[];
      limit?: number;
    }
  ): Promise<ShareAlert[]> {
    // Verify caregiver has access
    const { data: relationship } = await this.supabase
      .from('share_relationships')
      .select('id')
      .eq('sharer_email', sharerEmail)
      .eq('caregiver_email', caregiverEmail)
      .eq('status', 'active')
      .single();

    if (!relationship) return [];

    let query = this.supabase
      .from('share_alerts')
      .select('*')
      .eq('sharer_email', sharerEmail)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.in('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data } = await query;
    return (data || []) as ShareAlert[];
  }

  // ---------------------------------------------------------------------------
  // FORMATTING
  // ---------------------------------------------------------------------------

  private formatNotificationTitle(alert: ShareAlert): string {
    const severityEmoji: Record<AlertSeverity, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '📊',
      low: 'ℹ️',
      info: '📝',
    };

    return `${severityEmoji[alert.severity]} ${alert.title}`;
  }

  private formatNotificationBody(alert: ShareAlert): string {
    const maxLength = 150;
    let body = alert.message;

    if (alert.actionable_recommendation) {
      body += ` • ${alert.actionable_recommendation}`;
    }

    return body.length > maxLength ? body.substring(0, maxLength - 3) + '...' : body;
  }

  private getPatternBreakTitle(patternBreak: PatternBreak): string {
    const titles: Record<string, string> = {
      no_activity_data: 'No Activity Data Today',
      low_activity: 'Activity Significantly Below Normal',
      no_sleep_data: 'Missing Sleep Data',
      medication_missed: 'Medication Not Confirmed',
      no_data: 'No Health Data Available',
      sync_gap: 'Device Not Syncing',
    };

    return titles[patternBreak.patternType] || 'Pattern Break Detected';
  }

  private getPatternBreakRecommendation(patternBreak: PatternBreak): string {
    const recommendations: Record<string, string> = {
      no_activity_data: 'Check in to ensure device is being worn and syncing.',
      low_activity: 'Consider reaching out to check on their wellbeing.',
      no_sleep_data: 'Verify device was worn during sleep.',
      medication_missed: 'Gentle reminder about medication may be helpful.',
      no_data: 'Help set up health data syncing.',
      sync_gap: 'Device may need to be charged or app opened to sync.',
    };

    return recommendations[patternBreak.patternType] || 'Monitor situation and check in if needed.';
  }
}

// Lazy singleton pattern to avoid build-time initialization errors
let _alertRoutingServiceInstance: AlertRoutingService | null = null;

export const alertRoutingService = {
  get instance() {
    if (!_alertRoutingServiceInstance) {
      _alertRoutingServiceInstance = new AlertRoutingService();
    }
    return _alertRoutingServiceInstance;
  },
  createAlert: (...args: Parameters<AlertRoutingService['createAlert']>) =>
    alertRoutingService.instance.createAlert(...args),
  createAlertFromAnomaly: (...args: Parameters<AlertRoutingService['createAlertFromAnomaly']>) =>
    alertRoutingService.instance.createAlertFromAnomaly(...args),
  createAlertFromPatternBreak: (...args: Parameters<AlertRoutingService['createAlertFromPatternBreak']>) =>
    alertRoutingService.instance.createAlertFromPatternBreak(...args),
  processEscalations: (...args: Parameters<AlertRoutingService['processEscalations']>) =>
    alertRoutingService.instance.processEscalations(...args),
  getAlertsForSharer: (...args: Parameters<AlertRoutingService['getAlertsForSharer']>) =>
    alertRoutingService.instance.getAlertsForSharer(...args),
  getAlertsForCaregiver: (...args: Parameters<AlertRoutingService['getAlertsForCaregiver']>) =>
    alertRoutingService.instance.getAlertsForCaregiver(...args),
  getAlert: (...args: Parameters<AlertRoutingService['getAlert']>) =>
    alertRoutingService.instance.getAlert(...args),
  acknowledgeAlert: (...args: Parameters<AlertRoutingService['acknowledgeAlert']>) =>
    alertRoutingService.instance.acknowledgeAlert(...args),
  resolveAlert: (...args: Parameters<AlertRoutingService['resolveAlert']>) =>
    alertRoutingService.instance.resolveAlert(...args),
};

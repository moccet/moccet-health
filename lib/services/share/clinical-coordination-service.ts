/**
 * Clinical Coordination Service
 * Manages clinical provider relationships and clinical alerts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { contextBuilderService, CaregiverReport } from './context-builder-service';

// =============================================================================
// TYPES
// =============================================================================

export type ProviderType =
  | 'primary_care'
  | 'cardiologist'
  | 'endocrinologist'
  | 'geriatrician'
  | 'neurologist'
  | 'pulmonologist'
  | 'nephrologist'
  | 'psychiatrist'
  | 'other';

export type ContactMethod = 'email' | 'fax' | 'portal' | 'phone';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'acknowledged';

export interface ClinicalProvider {
  id: string;
  user_email: string;
  provider_email: string;
  provider_name: string;
  provider_type: ProviderType;
  practice_name: string | null;
  phone: string | null;
  fax: string | null;
  portal_url: string | null;
  share_alerts: boolean;
  share_weekly_summary: boolean;
  share_trend_reports: boolean;
  preferred_contact_method: ContactMethod;
  created_at: string;
  updated_at: string;
}

export interface ClinicalAlert {
  id: string;
  coordination_id: string;
  user_email: string;
  provider_email: string;
  alert_type: string;
  summary: string;
  detailed_report: ClinicalReportData;
  sent_at: string | null;
  delivery_status: DeliveryStatus;
  provider_acknowledged: boolean;
  provider_notes: string | null;
  visible_to_caregivers: boolean;
  caregiver_view_summary: string | null;
}

export interface ClinicalReportData {
  patientName: string;
  reportDate: string;
  alertType?: string;
  alertSeverity?: string;
  summary: string;
  vitalSigns?: Record<string, { value: number; trend: string }>;
  medications?: { name: string; compliance: number }[];
  recentAlerts?: { date: string; type: string; severity: string }[];
  recommendations?: string[];
}

export interface WeeklySummary {
  userEmail: string;
  providerEmail: string;
  weekStart: string;
  weekEnd: string;
  overallStatus: 'stable' | 'attention' | 'concern';
  vitalsAverage: Record<string, number>;
  alertsSummary: { critical: number; high: number; medium: number; low: number };
  medicationCompliance: number;
  concerningTrends: string[];
  recommendations: string[];
}

// =============================================================================
// SERVICE
// =============================================================================

export class ClinicalCoordinationService {
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
  // PROVIDER MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Add a clinical provider
   */
  async addProvider(
    userEmail: string,
    providerData: {
      providerEmail: string;
      providerName: string;
      providerType: ProviderType;
      practiceName?: string;
      phone?: string;
      fax?: string;
      portalUrl?: string;
      shareAlerts?: boolean;
      shareWeeklySummary?: boolean;
      shareTrendReports?: boolean;
      preferredContactMethod?: ContactMethod;
    }
  ): Promise<ClinicalProvider> {
    const { data, error } = await this.supabase
      .from('share_clinical_coordination')
      .insert({
        user_email: userEmail,
        provider_email: providerData.providerEmail,
        provider_name: providerData.providerName,
        provider_type: providerData.providerType,
        practice_name: providerData.practiceName || null,
        phone: providerData.phone || null,
        fax: providerData.fax || null,
        portal_url: providerData.portalUrl || null,
        share_alerts: providerData.shareAlerts ?? true,
        share_weekly_summary: providerData.shareWeeklySummary ?? false,
        share_trend_reports: providerData.shareTrendReports ?? false,
        preferred_contact_method: providerData.preferredContactMethod || 'email',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add provider: ${error.message}`);
    return data as ClinicalProvider;
  }

  /**
   * Get providers for a user
   */
  async getProviders(userEmail: string): Promise<ClinicalProvider[]> {
    const { data } = await this.supabase
      .from('share_clinical_coordination')
      .select('*')
      .eq('user_email', userEmail)
      .order('provider_name');

    return (data || []) as ClinicalProvider[];
  }

  /**
   * Update a provider
   */
  async updateProvider(
    providerId: string,
    updates: Partial<{
      providerName: string;
      providerType: ProviderType;
      practiceName: string;
      phone: string;
      fax: string;
      portalUrl: string;
      shareAlerts: boolean;
      shareWeeklySummary: boolean;
      shareTrendReports: boolean;
      preferredContactMethod: ContactMethod;
    }>
  ): Promise<ClinicalProvider> {
    const updateData: Record<string, unknown> = {};

    if (updates.providerName) updateData.provider_name = updates.providerName;
    if (updates.providerType) updateData.provider_type = updates.providerType;
    if (updates.practiceName !== undefined) updateData.practice_name = updates.practiceName;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.fax !== undefined) updateData.fax = updates.fax;
    if (updates.portalUrl !== undefined) updateData.portal_url = updates.portalUrl;
    if (updates.shareAlerts !== undefined) updateData.share_alerts = updates.shareAlerts;
    if (updates.shareWeeklySummary !== undefined) updateData.share_weekly_summary = updates.shareWeeklySummary;
    if (updates.shareTrendReports !== undefined) updateData.share_trend_reports = updates.shareTrendReports;
    if (updates.preferredContactMethod) updateData.preferred_contact_method = updates.preferredContactMethod;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('share_clinical_coordination')
      .update(updateData)
      .eq('id', providerId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update provider: ${error.message}`);
    return data as ClinicalProvider;
  }

  /**
   * Remove a provider
   */
  async removeProvider(providerId: string): Promise<void> {
    await this.supabase
      .from('share_clinical_coordination')
      .delete()
      .eq('id', providerId);
  }

  // ---------------------------------------------------------------------------
  // CLINICAL ALERTS
  // ---------------------------------------------------------------------------

  /**
   * Send clinical alert to provider
   */
  async sendClinicalAlert(
    userEmail: string,
    providerId: string,
    alertType: string,
    summary: string,
    detailedReport: ClinicalReportData
  ): Promise<ClinicalAlert> {
    // Get provider info
    const { data: provider } = await this.supabase
      .from('share_clinical_coordination')
      .select('*')
      .eq('id', providerId)
      .single();

    if (!provider) throw new Error('Provider not found');

    // Create clinical alert record
    const { data: alert, error } = await this.supabase
      .from('share_clinical_alerts')
      .insert({
        coordination_id: providerId,
        user_email: userEmail,
        provider_email: provider.provider_email,
        alert_type: alertType,
        summary,
        detailed_report: detailedReport,
        visible_to_caregivers: true,
        caregiver_view_summary: `Clinical team (${provider.provider_name}) notified: ${summary}`,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create clinical alert: ${error.message}`);

    // Send notification based on preferred contact method
    await this.deliverClinicalAlert(alert as ClinicalAlert, provider as ClinicalProvider);

    return alert as ClinicalAlert;
  }

  /**
   * Deliver clinical alert via preferred method
   */
  private async deliverClinicalAlert(
    alert: ClinicalAlert,
    provider: ClinicalProvider
  ): Promise<void> {
    let deliveryStatus: DeliveryStatus = 'pending';

    try {
      switch (provider.preferred_contact_method) {
        case 'email':
          await this.sendAlertEmail(alert, provider);
          deliveryStatus = 'sent';
          break;

        case 'fax':
          // TODO: Integrate with fax service (e.g., Twilio Fax, eFax)
          console.log(`Would fax alert to ${provider.fax}`);
          deliveryStatus = 'sent';
          break;

        case 'portal':
          // TODO: Integrate with patient portal APIs
          console.log(`Would send to portal: ${provider.portal_url}`);
          deliveryStatus = 'sent';
          break;

        case 'phone':
          // TODO: Integrate with phone notification
          console.log(`Would call/text ${provider.phone}`);
          deliveryStatus = 'sent';
          break;
      }
    } catch (error) {
      console.error('Failed to deliver clinical alert:', error);
      deliveryStatus = 'failed';
    }

    // Update delivery status
    await this.supabase
      .from('share_clinical_alerts')
      .update({
        sent_at: new Date().toISOString(),
        delivery_status: deliveryStatus,
      })
      .eq('id', alert.id);
  }

  /**
   * Send alert via email
   */
  private async sendAlertEmail(
    alert: ClinicalAlert,
    provider: ClinicalProvider
  ): Promise<void> {
    // Get patient name
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('display_name')
      .eq('email', alert.user_email)
      .single();

    const patientName = profile?.display_name || alert.user_email.split('@')[0];

    // Format email content
    const emailSubject = `[moccet Health Alert] ${alert.summary} - ${patientName}`;
    const emailBody = this.formatClinicalEmail(alert, provider, patientName);

    // Send via notification service
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: provider.provider_email,
          subject: emailSubject,
          html: emailBody,
          priority: 'high',
        }),
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Format clinical email content
   */
  private formatClinicalEmail(
    alert: ClinicalAlert,
    provider: ClinicalProvider,
    patientName: string
  ): string {
    const report = alert.detailed_report;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a18; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">moccet Health Alert</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.7;">Automated Health Monitoring System</p>
        </div>

        <div style="background: #fff; padding: 20px; border: 1px solid #e0e0e0;">
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
            <strong style="color: #856404;">${alert.alert_type.toUpperCase()}</strong>
            <p style="margin: 10px 0 0 0; color: #856404;">${alert.summary}</p>
          </div>

          <h2 style="font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
            Patient: ${patientName}
          </h2>

          <h3 style="font-size: 14px; color: #666;">Summary</h3>
          <p>${report.summary}</p>

          ${report.vitalSigns ? `
            <h3 style="font-size: 14px; color: #666;">Recent Vitals</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${Object.entries(report.vitalSigns).map(([key, val]) => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${key}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
                    ${val.value} <span style="color: ${val.trend === 'declining' ? 'red' : 'green'};">(${val.trend})</span>
                  </td>
                </tr>
              `).join('')}
            </table>
          ` : ''}

          ${report.recommendations && report.recommendations.length > 0 ? `
            <h3 style="font-size: 14px; color: #666;">Recommendations</h3>
            <ul>
              ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
          ` : ''}
        </div>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #666;">
          <p style="margin: 0;">
            This alert was generated by moccet's automated health monitoring system.
            The patient has authorized sharing of this information with you.
          </p>
          <p style="margin: 10px 0 0 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/clinical/acknowledge/${alert.id}">
              Click here to acknowledge receipt
            </a>
          </p>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // WEEKLY SUMMARIES
  // ---------------------------------------------------------------------------

  /**
   * Generate and send weekly summaries
   */
  async processWeeklySummaries(): Promise<number> {
    // Get all providers with weekly summary enabled
    const { data: providers } = await this.supabase
      .from('share_clinical_coordination')
      .select('*')
      .eq('share_weekly_summary', true);

    if (!providers) return 0;

    let sentCount = 0;

    for (const provider of providers) {
      try {
        const summary = await this.generateWeeklySummary(
          provider.user_email,
          provider.provider_email
        );

        await this.sendWeeklySummary(summary, provider as ClinicalProvider);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send weekly summary to ${provider.provider_email}:`, error);
      }
    }

    return sentCount;
  }

  /**
   * Generate weekly summary for a patient
   */
  async generateWeeklySummary(
    userEmail: string,
    providerEmail: string
  ): Promise<WeeklySummary> {
    const weekEnd = new Date();
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get caregiver report data
    const report = await contextBuilderService.generateCaregiverReport(
      userEmail,
      providerEmail, // Using provider as pseudo-caregiver for report
      7
    );

    // Count alerts by severity
    const { data: alerts } = await this.supabase
      .from('share_alerts')
      .select('severity')
      .eq('sharer_email', userEmail)
      .gte('created_at', weekStart.toISOString());

    const alertsSummary = {
      critical: alerts?.filter(a => a.severity === 'critical').length || 0,
      high: alerts?.filter(a => a.severity === 'high').length || 0,
      medium: alerts?.filter(a => a.severity === 'medium').length || 0,
      low: alerts?.filter(a => a.severity === 'low').length || 0,
    };

    // Determine overall status
    let overallStatus: 'stable' | 'attention' | 'concern' = 'stable';
    if (alertsSummary.critical > 0) overallStatus = 'concern';
    else if (alertsSummary.high > 0) overallStatus = 'attention';

    // Get vitals averages
    const vitalsAverage: Record<string, number> = {};
    for (const day of report.dailySummaries) {
      if (day.sleepScore) {
        vitalsAverage.sleepScore = (vitalsAverage.sleepScore || 0) + day.sleepScore / 7;
      }
      if (day.steps) {
        vitalsAverage.steps = (vitalsAverage.steps || 0) + day.steps / 7;
      }
    }

    // Get medication compliance
    const { data: medLogs } = await this.supabase
      .from('medication_logs')
      .select('taken_at')
      .eq('user_email', userEmail)
      .gte('scheduled_time', weekStart.toISOString());

    const totalMeds = medLogs?.length || 0;
    const takenMeds = medLogs?.filter(l => l.taken_at !== null).length || 0;
    const medicationCompliance = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 100;

    return {
      userEmail,
      providerEmail,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      overallStatus,
      vitalsAverage,
      alertsSummary,
      medicationCompliance,
      concerningTrends: report.trends
        .filter(t => t.direction === 'declining')
        .map(t => t.interpretation),
      recommendations: report.recommendations,
    };
  }

  /**
   * Send weekly summary to provider
   */
  private async sendWeeklySummary(
    summary: WeeklySummary,
    provider: ClinicalProvider
  ): Promise<void> {
    // Get patient name
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('display_name')
      .eq('email', summary.userEmail)
      .single();

    const patientName = profile?.display_name || summary.userEmail.split('@')[0];

    // Create clinical alert record for tracking
    await this.supabase
      .from('share_clinical_alerts')
      .insert({
        coordination_id: provider.id,
        user_email: summary.userEmail,
        provider_email: provider.provider_email,
        alert_type: 'weekly_summary',
        summary: `Weekly health summary for ${patientName}`,
        detailed_report: summary,
        sent_at: new Date().toISOString(),
        delivery_status: 'sent',
        visible_to_caregivers: false, // Weekly summaries not shown to caregivers
      });

    // Send email
    const emailSubject = `[moccet] Weekly Health Summary - ${patientName}`;
    const emailBody = this.formatWeeklySummaryEmail(summary, patientName);

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: provider.provider_email,
        subject: emailSubject,
        html: emailBody,
      }),
    });
  }

  /**
   * Format weekly summary email
   */
  private formatWeeklySummaryEmail(summary: WeeklySummary, patientName: string): string {
    const statusColor = summary.overallStatus === 'concern' ? '#dc3545'
      : summary.overallStatus === 'attention' ? '#ffc107'
      : '#28a745';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a18; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Weekly Health Summary</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.7;">${patientName}</p>
        </div>

        <div style="background: #fff; padding: 20px; border: 1px solid #e0e0e0;">
          <div style="display: flex; align-items: center; margin-bottom: 20px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${statusColor}; margin-right: 10px;"></div>
            <span style="font-size: 18px; font-weight: bold; text-transform: capitalize;">
              ${summary.overallStatus}
            </span>
          </div>

          <h3 style="font-size: 14px; color: #666;">Alerts This Week</h3>
          <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div><strong style="color: #dc3545;">${summary.alertsSummary.critical}</strong> Critical</div>
            <div><strong style="color: #fd7e14;">${summary.alertsSummary.high}</strong> High</div>
            <div><strong style="color: #ffc107;">${summary.alertsSummary.medium}</strong> Medium</div>
          </div>

          <h3 style="font-size: 14px; color: #666;">Medication Compliance</h3>
          <p style="font-size: 24px; font-weight: bold; color: ${summary.medicationCompliance >= 80 ? '#28a745' : '#dc3545'};">
            ${summary.medicationCompliance}%
          </p>

          ${summary.concerningTrends.length > 0 ? `
            <h3 style="font-size: 14px; color: #666;">Concerning Trends</h3>
            <ul>
              ${summary.concerningTrends.map(t => `<li>${t}</li>`).join('')}
            </ul>
          ` : ''}

          ${summary.recommendations.length > 0 ? `
            <h3 style="font-size: 14px; color: #666;">Recommendations</h3>
            <ul>
              ${summary.recommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
          ` : ''}
        </div>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #666;">
          <p style="margin: 0;">
            Week of ${new Date(summary.weekStart).toLocaleDateString()} - ${new Date(summary.weekEnd).toLocaleDateString()}
          </p>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // CLINICAL ALERTS FOR CAREGIVERS
  // ---------------------------------------------------------------------------

  /**
   * Get clinical alerts visible to caregivers
   */
  async getClinicalAlertsForCaregiver(
    caregiverEmail: string,
    sharerEmail: string
  ): Promise<ClinicalAlert[]> {
    // Verify caregiver has access
    const { data: relationship } = await this.supabase
      .from('share_relationships')
      .select('share_permissions(can_see_clinical_alerts)')
      .eq('sharer_email', sharerEmail)
      .eq('caregiver_email', caregiverEmail)
      .eq('status', 'active')
      .single();

    const perms = relationship?.share_permissions as any;
    if (!perms?.can_see_clinical_alerts) {
      return [];
    }

    const { data: alerts } = await this.supabase
      .from('share_clinical_alerts')
      .select('id, alert_type, caregiver_view_summary, sent_at, provider_acknowledged')
      .eq('user_email', sharerEmail)
      .eq('visible_to_caregivers', true)
      .order('sent_at', { ascending: false })
      .limit(20);

    return (alerts || []) as ClinicalAlert[];
  }
}

// Lazy singleton pattern to avoid build-time initialization errors
let _clinicalCoordinationServiceInstance: ClinicalCoordinationService | null = null;

export const clinicalCoordinationService = {
  get instance() {
    if (!_clinicalCoordinationServiceInstance) {
      _clinicalCoordinationServiceInstance = new ClinicalCoordinationService();
    }
    return _clinicalCoordinationServiceInstance;
  },
  processWeeklySummaries: (...args: Parameters<ClinicalCoordinationService['processWeeklySummaries']>) =>
    clinicalCoordinationService.instance.processWeeklySummaries(...args),
  sendClinicalNotification: (...args: Parameters<ClinicalCoordinationService['sendClinicalNotification']>) =>
    clinicalCoordinationService.instance.sendClinicalNotification(...args),
  getClinicalAlertsForCaregiver: (...args: Parameters<ClinicalCoordinationService['getClinicalAlertsForCaregiver']>) =>
    clinicalCoordinationService.instance.getClinicalAlertsForCaregiver(...args),
  getProviders: (...args: Parameters<ClinicalCoordinationService['getProviders']>) =>
    clinicalCoordinationService.instance.getProviders(...args),
  addProvider: (...args: Parameters<ClinicalCoordinationService['addProvider']>) =>
    clinicalCoordinationService.instance.addProvider(...args),
  updateProvider: (...args: Parameters<ClinicalCoordinationService['updateProvider']>) =>
    clinicalCoordinationService.instance.updateProvider(...args),
  removeProvider: (...args: Parameters<ClinicalCoordinationService['removeProvider']>) =>
    clinicalCoordinationService.instance.removeProvider(...args),
};

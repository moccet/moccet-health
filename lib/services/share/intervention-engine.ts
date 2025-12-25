/**
 * Intervention Engine
 * Handles smart reminders, automated deliveries, and proactive interventions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type InterventionType =
  | 'reminder'
  | 'automated_delivery'
  | 'scheduled_check_in'
  | 'suggestion'
  | 'emergency_contact';

export type TriggerType =
  | 'time_based'
  | 'metric_based'
  | 'pattern_based'
  | 'caregiver_initiated'
  | 'ai_suggested';

export type ReminderCategory =
  | 'hydration'
  | 'medication'
  | 'activity'
  | 'nutrition'
  | 'sleep'
  | 'stretch'
  | 'check_in';

export type InterventionStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ExecutionResult =
  | 'sent'
  | 'completed'
  | 'acknowledged'
  | 'ignored'
  | 'snoozed'
  | 'failed';

export interface Intervention {
  id: string;
  user_email: string;
  created_by_email: string | null;
  intervention_type: InterventionType;
  trigger_type: TriggerType;
  config: InterventionConfig;
  status: InterventionStatus;
  next_scheduled_at: string | null;
  last_executed_at: string | null;
  effectiveness_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface InterventionConfig {
  // Common
  name: string;
  description?: string;

  // Reminder specific
  reminderCategory?: ReminderCategory;
  scheduleType?: 'fixed' | 'interval' | 'smart';
  scheduleTimes?: string[]; // For fixed: ["08:00", "14:00", "20:00"]
  intervalMinutes?: number; // For interval
  message?: string;
  personalizedMessages?: string[];

  // Trigger conditions
  triggerMetric?: string;
  triggerCondition?: 'below' | 'above' | 'change';
  triggerThreshold?: number;
  triggerDays?: number; // Number of days condition must be true

  // Delivery specific
  deliveryProvider?: 'instacart' | 'amazon_fresh' | 'walmart';
  deliveryItems?: DeliveryItem[];
  deliveryFrequency?: 'once' | 'weekly' | 'monthly' | 'as_needed';
  deliveryAddress?: string;
  requiresApproval?: boolean;
  approverEmail?: string;
  maxBudget?: number;

  // Smart features
  skipIfActive?: boolean; // Skip if user is currently active
  skipIfSleeping?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  adaptToPatterns?: boolean;
}

export interface DeliveryItem {
  name: string;
  quantity: number;
  category: string;
  preferredBrand?: string;
  alternatives?: string[];
  notes?: string;
}

export interface InterventionLog {
  id: string;
  intervention_id: string;
  user_email: string;
  executed_at: string;
  execution_result: ExecutionResult;
  user_response: string | null;
  response_at: string | null;
  outcome_positive: boolean | null;
  outcome_notes: string | null;
  delivery_order_id: string | null;
  delivery_status: string | null;
}

export interface DeliveryOrder {
  id: string;
  intervention_id: string;
  user_email: string;
  provider: string;
  status: 'pending_approval' | 'approved' | 'ordered' | 'in_transit' | 'delivered' | 'cancelled';
  items: DeliveryItem[];
  total_amount: number | null;
  approved_by: string | null;
  approved_at: string | null;
  order_placed_at: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  tracking_url: string | null;
}

// =============================================================================
// SERVICE
// =============================================================================

export class InterventionEngine {
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
  // INTERVENTION MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Create a new intervention
   */
  async createIntervention(
    userEmail: string,
    type: InterventionType,
    triggerType: TriggerType,
    config: InterventionConfig,
    createdByEmail?: string
  ): Promise<Intervention> {
    // Calculate initial next scheduled time
    const nextScheduled = this.calculateNextScheduledTime(config);

    const { data, error } = await this.supabase
      .from('share_interventions')
      .insert({
        user_email: userEmail,
        created_by_email: createdByEmail || null,
        intervention_type: type,
        trigger_type: triggerType,
        config,
        status: 'active',
        next_scheduled_at: nextScheduled?.toISOString() || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create intervention: ${error.message}`);
    return data as Intervention;
  }

  /**
   * Update an intervention
   */
  async updateIntervention(
    interventionId: string,
    updates: Partial<{ config: InterventionConfig; status: InterventionStatus }>
  ): Promise<Intervention> {
    const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };

    if (updates.config) {
      updateData.next_scheduled_at = this.calculateNextScheduledTime(updates.config)?.toISOString() || null;
    }

    const { data, error } = await this.supabase
      .from('share_interventions')
      .update(updateData)
      .eq('id', interventionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update intervention: ${error.message}`);
    return data as Intervention;
  }

  /**
   * Get interventions for a user
   */
  async getInterventions(
    userEmail: string,
    options?: { status?: InterventionStatus; type?: InterventionType }
  ): Promise<Intervention[]> {
    let query = this.supabase
      .from('share_interventions')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.type) {
      query = query.eq('intervention_type', options.type);
    }

    const { data } = await query;
    return (data || []) as Intervention[];
  }

  /**
   * Cancel an intervention
   */
  async cancelIntervention(interventionId: string): Promise<void> {
    await this.supabase
      .from('share_interventions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', interventionId);
  }

  // ---------------------------------------------------------------------------
  // REMINDER EXECUTION
  // ---------------------------------------------------------------------------

  /**
   * Execute a scheduled intervention
   */
  async executeIntervention(interventionId: string): Promise<InterventionLog> {
    const { data: intervention } = await this.supabase
      .from('share_interventions')
      .select('*')
      .eq('id', interventionId)
      .single();

    if (!intervention) throw new Error('Intervention not found');

    const config = intervention.config as InterventionConfig;

    // Check skip conditions
    if (config.skipIfActive && await this.isUserActive(intervention.user_email)) {
      return this.logExecution(interventionId, intervention.user_email, 'ignored', 'User is active');
    }

    if (config.skipIfSleeping && await this.isUserSleeping(intervention.user_email)) {
      return this.logExecution(interventionId, intervention.user_email, 'ignored', 'User is sleeping');
    }

    if (this.isQuietHours(config)) {
      return this.logExecution(interventionId, intervention.user_email, 'ignored', 'Quiet hours');
    }

    // Execute based on type
    let result: ExecutionResult;

    switch (intervention.intervention_type) {
      case 'reminder':
        result = await this.sendReminder(intervention);
        break;
      case 'automated_delivery':
        result = await this.initiateDelivery(intervention);
        break;
      case 'scheduled_check_in':
        result = await this.sendCheckIn(intervention);
        break;
      default:
        result = 'failed';
    }

    // Update next scheduled time
    const nextScheduled = this.calculateNextScheduledTime(config);
    await this.supabase
      .from('share_interventions')
      .update({
        last_executed_at: new Date().toISOString(),
        next_scheduled_at: nextScheduled?.toISOString() || null,
      })
      .eq('id', interventionId);

    return this.logExecution(interventionId, intervention.user_email, result);
  }

  /**
   * Send a reminder notification
   */
  private async sendReminder(intervention: Intervention): Promise<ExecutionResult> {
    const config = intervention.config as InterventionConfig;

    // Get personalized message
    const message = await this.getPersonalizedMessage(
      intervention.user_email,
      config.reminderCategory || 'check_in',
      config
    );

    // Get FCM token
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('fcm_token')
      .eq('email', intervention.user_email)
      .single();

    if (!profile?.fcm_token) {
      console.warn(`No FCM token for ${intervention.user_email}`);
      return 'failed';
    }

    // Send notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: profile.fcm_token,
          title: this.getReminderTitle(config.reminderCategory || 'check_in'),
          body: message,
          data: {
            type: 'intervention',
            interventionId: intervention.id,
            category: config.reminderCategory,
          },
          channel: 'reminders',
        }),
      });
      return 'sent';
    } catch (error) {
      console.error('Failed to send reminder:', error);
      return 'failed';
    }
  }

  /**
   * Send a check-in request
   */
  private async sendCheckIn(intervention: Intervention): Promise<ExecutionResult> {
    const config = intervention.config as InterventionConfig;

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('fcm_token, display_name')
      .eq('email', intervention.user_email)
      .single();

    if (!profile?.fcm_token) return 'failed';

    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: profile.fcm_token,
          title: 'Quick Check-in',
          body: config.message || 'How are you feeling today? Tap to update your status.',
          data: {
            type: 'check_in',
            interventionId: intervention.id,
          },
          channel: 'check_ins',
        }),
      });
      return 'sent';
    } catch {
      return 'failed';
    }
  }

  // ---------------------------------------------------------------------------
  // DELIVERY AUTOMATION
  // ---------------------------------------------------------------------------

  /**
   * Initiate an automated delivery
   */
  private async initiateDelivery(intervention: Intervention): Promise<ExecutionResult> {
    const config = intervention.config as InterventionConfig;

    if (!config.deliveryItems || config.deliveryItems.length === 0) {
      return 'failed';
    }

    // Create delivery order (pending approval)
    const { data: order, error } = await this.supabase
      .from('share_delivery_orders')
      .insert({
        intervention_id: intervention.id,
        user_email: intervention.user_email,
        provider: config.deliveryProvider || 'instacart',
        status: config.requiresApproval ? 'pending_approval' : 'approved',
        items: config.deliveryItems,
        approver_email: config.approverEmail,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create delivery order:', error);
      return 'failed';
    }

    // Notify approver if approval required
    if (config.requiresApproval && config.approverEmail) {
      await this.notifyApprover(order, config.approverEmail);
    } else {
      // Auto-approved, place order
      await this.placeDeliveryOrder(order.id);
    }

    return 'sent';
  }

  /**
   * Notify caregiver for delivery approval
   */
  private async notifyApprover(order: DeliveryOrder, approverEmail: string): Promise<void> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('fcm_token')
      .eq('email', approverEmail)
      .single();

    if (!profile?.fcm_token) return;

    const itemSummary = order.items.slice(0, 3).map(i => i.name).join(', ');
    const moreCount = order.items.length > 3 ? ` +${order.items.length - 3} more` : '';

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: profile.fcm_token,
        title: 'Delivery Approval Needed',
        body: `${itemSummary}${moreCount}. Tap to review and approve.`,
        data: {
          type: 'delivery_approval',
          orderId: order.id,
        },
        priority: 'high',
        channel: 'deliveries',
      }),
    });
  }

  /**
   * Approve a delivery order
   */
  async approveDeliveryOrder(orderId: string, approverEmail: string): Promise<DeliveryOrder> {
    const { data, error } = await this.supabase
      .from('share_delivery_orders')
      .update({
        status: 'approved',
        approved_by: approverEmail,
        approved_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw new Error(`Failed to approve order: ${error.message}`);

    // Place the order
    await this.placeDeliveryOrder(orderId);

    return data as DeliveryOrder;
  }

  /**
   * Place order with delivery provider
   */
  private async placeDeliveryOrder(orderId: string): Promise<void> {
    const { data: order } = await this.supabase
      .from('share_delivery_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) return;

    // TODO: Integrate with actual delivery APIs (Instacart, Amazon Fresh, etc.)
    // For now, simulate order placement

    const estimatedDelivery = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    await this.supabase
      .from('share_delivery_orders')
      .update({
        status: 'ordered',
        order_placed_at: new Date().toISOString(),
        estimated_delivery: estimatedDelivery.toISOString(),
        // tracking_url: 'https://...' // Would come from provider
      })
      .eq('id', orderId);

    // Notify user of order
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('fcm_token')
      .eq('email', order.user_email)
      .single();

    if (profile?.fcm_token) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: profile.fcm_token,
          title: 'Delivery on the way!',
          body: `Your groceries are being prepared. Expected by ${estimatedDelivery.toLocaleTimeString()}.`,
          data: { type: 'delivery_update', orderId },
          channel: 'deliveries',
        }),
      });
    }
  }

  /**
   * Get delivery order status
   */
  async getDeliveryOrder(orderId: string): Promise<DeliveryOrder | null> {
    const { data } = await this.supabase
      .from('share_delivery_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    return data as DeliveryOrder | null;
  }

  /**
   * Get pending delivery orders for approval
   */
  async getPendingDeliveryApprovals(approverEmail: string): Promise<DeliveryOrder[]> {
    const { data } = await this.supabase
      .from('share_delivery_orders')
      .select('*')
      .eq('approver_email', approverEmail)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    return (data || []) as DeliveryOrder[];
  }

  // ---------------------------------------------------------------------------
  // AI-SUGGESTED INTERVENTIONS
  // ---------------------------------------------------------------------------

  /**
   * Suggest interventions based on health patterns
   */
  async suggestInterventions(userEmail: string): Promise<InterventionConfig[]> {
    const suggestions: InterventionConfig[] = [];

    // Get recent health data
    const { data: baselines } = await this.supabase
      .from('share_baselines')
      .select('*')
      .eq('user_email', userEmail);

    if (!baselines) return suggestions;

    // Check for hydration opportunities
    const hydrationBaseline = baselines.find(b => b.metric_type === 'hydration');
    if (hydrationBaseline && hydrationBaseline.trend_direction === 'declining') {
      suggestions.push({
        name: 'Hydration Reminder',
        description: 'Gentle reminders to drink water throughout the day',
        reminderCategory: 'hydration',
        scheduleType: 'interval',
        intervalMinutes: 120, // Every 2 hours
        message: 'Time for a glass of water!',
        skipIfActive: true,
        quietHoursStart: '21:00',
        quietHoursEnd: '08:00',
      });
    }

    // Check for activity opportunities
    const stepsBaseline = baselines.find(b => b.metric_type === 'steps');
    if (stepsBaseline && stepsBaseline.baseline_value < 3000) {
      suggestions.push({
        name: 'Activity Reminder',
        description: 'Encourage gentle movement throughout the day',
        reminderCategory: 'activity',
        scheduleType: 'smart',
        scheduleTimes: ['10:00', '14:00', '16:00'],
        message: 'A short walk would be great for you right now.',
        skipIfActive: true,
        adaptToPatterns: true,
      });
    }

    // Check for protein/nutrition
    const proteinBaseline = baselines.find(b => b.metric_type === 'protein_intake');
    if (proteinBaseline && proteinBaseline.trend_direction === 'declining') {
      suggestions.push({
        name: 'Protein-Rich Grocery Delivery',
        description: 'Automated delivery of protein-rich foods when intake is low',
        deliveryProvider: 'instacart',
        deliveryItems: [
          { name: 'Greek Yogurt', quantity: 4, category: 'dairy' },
          { name: 'Eggs (dozen)', quantity: 1, category: 'protein' },
          { name: 'Rotisserie Chicken', quantity: 1, category: 'protein' },
        ],
        deliveryFrequency: 'as_needed',
        requiresApproval: true,
        triggerMetric: 'protein_intake',
        triggerCondition: 'below',
        triggerThreshold: 40,
        triggerDays: 3,
      });
    }

    return suggestions;
  }

  // ---------------------------------------------------------------------------
  // PERSONALIZATION
  // ---------------------------------------------------------------------------

  /**
   * Get personalized message based on user preferences and history
   */
  async getPersonalizedMessage(
    userEmail: string,
    category: ReminderCategory,
    config: InterventionConfig
  ): Promise<string> {
    // Check for custom messages in config
    if (config.personalizedMessages && config.personalizedMessages.length > 0) {
      const idx = Math.floor(Math.random() * config.personalizedMessages.length);
      return config.personalizedMessages[idx];
    }

    // Default messages by category
    const defaults: Record<ReminderCategory, string[]> = {
      hydration: [
        'Time for a refreshing glass of water!',
        'Stay hydrated - have a drink!',
        'Your body thanks you for drinking water.',
      ],
      medication: [
        'Time to take your medication.',
        'Medication reminder - stay on track!',
      ],
      activity: [
        'A short walk would do wonders right now.',
        'Time to stretch and move a bit.',
        'Your body loves movement - even a few steps help!',
      ],
      nutrition: [
        'Have you eaten something nutritious today?',
        'A healthy snack could boost your energy.',
      ],
      sleep: [
        'Time to start winding down for bed.',
        'Good sleep starts with a relaxing evening routine.',
      ],
      stretch: [
        'Time for a gentle stretch.',
        'A few stretches can help you feel great.',
      ],
      check_in: [
        'How are you feeling today?',
        'Take a moment to check in with yourself.',
      ],
    };

    const messages = defaults[category] || defaults.check_in;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Record outcome and update effectiveness score
   */
  async recordOutcome(
    logId: string,
    outcomePositive: boolean,
    notes?: string
  ): Promise<void> {
    const { data: log } = await this.supabase
      .from('share_intervention_logs')
      .update({
        outcome_positive: outcomePositive,
        outcome_notes: notes,
      })
      .eq('id', logId)
      .select('intervention_id')
      .single();

    if (!log) return;

    // Update intervention effectiveness score
    const { data: allLogs } = await this.supabase
      .from('share_intervention_logs')
      .select('outcome_positive')
      .eq('intervention_id', log.intervention_id)
      .not('outcome_positive', 'is', null);

    if (allLogs && allLogs.length > 0) {
      const positiveCount = allLogs.filter(l => l.outcome_positive).length;
      const score = Math.round((positiveCount / allLogs.length) * 100);

      await this.supabase
        .from('share_interventions')
        .update({ effectiveness_score: score })
        .eq('id', log.intervention_id);
    }
  }

  // ---------------------------------------------------------------------------
  // SCHEDULING HELPERS
  // ---------------------------------------------------------------------------

  private calculateNextScheduledTime(config: InterventionConfig): Date | null {
    const now = new Date();

    if (config.scheduleType === 'fixed' && config.scheduleTimes) {
      // Find next scheduled time today or tomorrow
      for (const timeStr of config.scheduleTimes.sort()) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const scheduled = new Date(now);
        scheduled.setHours(hours, minutes, 0, 0);

        if (scheduled > now) {
          return scheduled;
        }
      }

      // All times passed today, schedule for tomorrow
      const [hours, minutes] = config.scheduleTimes[0].split(':').map(Number);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hours, minutes, 0, 0);
      return tomorrow;
    }

    if (config.scheduleType === 'interval' && config.intervalMinutes) {
      return new Date(now.getTime() + config.intervalMinutes * 60 * 1000);
    }

    // Default: 24 hours from now
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  private isQuietHours(config: InterventionConfig): boolean {
    if (!config.quietHoursStart || !config.quietHoursEnd) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = config.quietHoursStart.split(':').map(Number);
    const [endH, endM] = config.quietHoursEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes < endMinutes) {
      // Same day range (e.g., 22:00 to 06:00 spans midnight)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Overnight range
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  }

  private async isUserActive(userEmail: string): Promise<boolean> {
    // Check if user has recent activity (last 30 minutes)
    const { data } = await this.supabase
      .from('activity_logs')
      .select('id')
      .eq('user_email', userEmail)
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(1);

    return (data?.length || 0) > 0;
  }

  private async isUserSleeping(userEmail: string): Promise<boolean> {
    const hour = new Date().getHours();
    // Simple heuristic: assume sleeping between 11pm and 7am
    return hour >= 23 || hour < 7;
  }

  private getReminderTitle(category: ReminderCategory): string {
    const titles: Record<ReminderCategory, string> = {
      hydration: '💧 Hydration Reminder',
      medication: '💊 Medication Time',
      activity: '🚶 Time to Move',
      nutrition: '🍎 Nutrition Check',
      sleep: '😴 Bedtime Reminder',
      stretch: '🧘 Stretch Break',
      check_in: '💚 Check In',
    };
    return titles[category] || 'Reminder';
  }

  private async logExecution(
    interventionId: string,
    userEmail: string,
    result: ExecutionResult,
    notes?: string
  ): Promise<InterventionLog> {
    const { data, error } = await this.supabase
      .from('share_intervention_logs')
      .insert({
        intervention_id: interventionId,
        user_email: userEmail,
        executed_at: new Date().toISOString(),
        execution_result: result,
        outcome_notes: notes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to log execution: ${error.message}`);
    return data as InterventionLog;
  }

  // ---------------------------------------------------------------------------
  // SCHEDULED PROCESSING
  // ---------------------------------------------------------------------------

  /**
   * Process all due interventions (call from cron job)
   */
  async processDueInterventions(): Promise<number> {
    const now = new Date().toISOString();

    const { data: dueInterventions } = await this.supabase
      .from('share_interventions')
      .select('id')
      .eq('status', 'active')
      .lte('next_scheduled_at', now);

    if (!dueInterventions) return 0;

    let processed = 0;
    for (const intervention of dueInterventions) {
      try {
        await this.executeIntervention(intervention.id);
        processed++;
      } catch (error) {
        console.error(`Failed to execute intervention ${intervention.id}:`, error);
      }
    }

    return processed;
  }
}

// Lazy singleton pattern to avoid build-time initialization errors
let _interventionEngineInstance: InterventionEngine | null = null;

export const interventionEngine = {
  get instance() {
    if (!_interventionEngineInstance) {
      _interventionEngineInstance = new InterventionEngine();
    }
    return _interventionEngineInstance;
  },
  processDueInterventions: (...args: Parameters<InterventionEngine['processDueInterventions']>) =>
    interventionEngine.instance.processDueInterventions(...args),
  createIntervention: (...args: Parameters<InterventionEngine['createIntervention']>) =>
    interventionEngine.instance.createIntervention(...args),
  executeIntervention: (...args: Parameters<InterventionEngine['executeIntervention']>) =>
    interventionEngine.instance.executeIntervention(...args),
  updateIntervention: (...args: Parameters<InterventionEngine['updateIntervention']>) =>
    interventionEngine.instance.updateIntervention(...args),
  cancelIntervention: (...args: Parameters<InterventionEngine['cancelIntervention']>) =>
    interventionEngine.instance.cancelIntervention(...args),
  getInterventionsForUser: (...args: Parameters<InterventionEngine['getInterventionsForUser']>) =>
    interventionEngine.instance.getInterventionsForUser(...args),
  getPendingDeliveryApprovals: (...args: Parameters<InterventionEngine['getPendingDeliveryApprovals']>) =>
    interventionEngine.instance.getPendingDeliveryApprovals(...args),
  getDeliveryOrder: (...args: Parameters<InterventionEngine['getDeliveryOrder']>) =>
    interventionEngine.instance.getDeliveryOrder(...args),
  approveDeliveryOrder: (...args: Parameters<InterventionEngine['approveDeliveryOrder']>) =>
    interventionEngine.instance.approveDeliveryOrder(...args),
};

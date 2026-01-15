/**
 * Tool Types for the Health Agent
 */

import { z } from 'zod';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  parameters: z.ZodObject<any>;
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  userEmail: string;
  accessTokens: {
    google?: string;
    spotify?: string;
    oura?: string;
    dexcom?: string;
  };
  supabase: any; // Supabase client
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    source?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

// Risk level mapping for quick lookup
export const TOOL_RISK_LEVELS: Record<string, RiskLevel> = {
  // Low risk - read-only or reversible
  get_health_data: 'low',
  analyze_biomarkers: 'low',
  search_supplements: 'low',
  find_calendar_slots: 'low',
  search_products: 'low',
  find_health_providers: 'low',
  check_insurance: 'low',
  create_playlist: 'low',
  add_tracks_to_playlist: 'low',
  get_user_context: 'low',

  // Health logging tools - low risk (user-initiated, reversible)
  log_water_intake: 'low',
  quick_log_water: 'low',
  get_water_intake: 'low',
  log_food: 'low',
  get_food_log: 'low',
  log_weight: 'low',
  get_weight_history: 'low',

  // Goal tools - low risk for reading
  get_health_goals: 'low',

  // Medium risk - modifies user data
  create_calendar_event: 'medium',
  update_calendar_event: 'medium',
  delete_calendar_event: 'medium',
  add_to_cart: 'medium',
  send_notification: 'medium',

  // Health logging tools - medium risk (changes settings)
  set_water_goal: 'medium',
  set_weight_goal: 'medium',

  // Goal tools - medium risk (creates/modifies goals)
  create_health_goal: 'medium',
  update_goal_progress: 'medium',
  pause_goal: 'medium',
  resume_goal: 'medium',
  complete_goal: 'medium',
  abandon_goal: 'medium',

  // Social tools (Moccet Connect) - low risk for reading
  get_friends: 'low',
  get_pending_friend_requests: 'low',
  get_meeting_suggestions: 'low',
  get_upcoming_meetups: 'low',

  // Social tools - medium risk (social actions)
  send_friend_request: 'medium',
  accept_friend_request: 'medium',
  reject_friend_request: 'medium',
  accept_meeting_suggestion: 'medium',
  decline_meeting_suggestion: 'medium',

  // Caregiving tools (Moccet Share) - low risk for reading
  get_my_caregivers: 'low',
  get_my_sharing_settings: 'low',
  get_care_recipients: 'low',
  get_care_recipient_status: 'low',
  get_care_alerts: 'low',

  // Caregiving tools - medium risk (privacy/permission changes)
  invite_caregiver: 'medium',
  update_sharing_permissions: 'medium',
  pause_sharing: 'medium',
  revoke_sharing: 'medium',
  acknowledge_alert: 'medium',
  create_reminder: 'medium',
  request_checkin: 'medium',

  // High risk - costs money or medical
  complete_purchase: 'high',
  book_appointment: 'high',
  cancel_appointment: 'high',
  trigger_emergency_contact: 'high',
};

export function getToolRiskLevel(toolName: string): RiskLevel {
  return TOOL_RISK_LEVELS[toolName] || 'medium';
}

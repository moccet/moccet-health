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

  // Medium risk - modifies user data
  create_calendar_event: 'medium',
  update_calendar_event: 'medium',
  delete_calendar_event: 'medium',
  add_to_cart: 'medium',
  send_notification: 'medium',

  // High risk - costs money or medical
  complete_purchase: 'high',
  book_appointment: 'high',
  cancel_appointment: 'high',
};

export function getToolRiskLevel(toolName: string): RiskLevel {
  return TOOL_RISK_LEVELS[toolName] || 'medium';
}

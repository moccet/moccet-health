/**
 * Settings Service
 *
 * Manages user preferences for the meeting notetaker feature.
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  MeetingNotetakerSettings,
  UpdateNotetakerSettingsInput,
  SummaryStyle,
} from './types';

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: Omit<MeetingNotetakerSettings, 'id' | 'userEmail' | 'userCode' | 'createdAt' | 'updatedAt'> = {
  autoJoinEnabled: true,
  joinBufferMinutes: 1,
  defaultLanguage: 'en',
  enableSpeakerDiarization: true,
  defaultSummaryStyle: 'executive',
  autoSendSummary: true,
  sendToAttendees: false,
  recapDistributionEmails: [],
  autoGenerateFollowup: true,
  matchEmailStyle: true,
  retainRecordingsDays: 90,
  retainTranscriptsDays: 365,
};

// ============================================================================
// Get Settings
// ============================================================================

/**
 * Get notetaker settings for a user
 */
export async function getNotetakerSettings(
  userEmail: string,
  userCode?: string
): Promise<MeetingNotetakerSettings | null> {
  try {
    const supabase = createAdminClient();

    let query = supabase
      .from('meeting_notetaker_settings')
      .select('*');

    if (userCode) {
      query = query.or(`user_email.eq.${userEmail},user_code.eq.${userCode}`);
    } else {
      query = query.eq('user_email', userEmail);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    return mapDbToSettings(data);
  } catch (error) {
    console.error('[SettingsService] Error fetching settings:', error);
    return null;
  }
}

/**
 * Get settings or create with defaults if not exists
 */
export async function getOrCreateSettings(
  userEmail: string,
  userCode?: string
): Promise<MeetingNotetakerSettings> {
  const existing = await getNotetakerSettings(userEmail, userCode);
  if (existing) {
    return existing;
  }

  // Create default settings
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('meeting_notetaker_settings')
      .insert({
        user_email: userEmail,
        user_code: userCode,
        auto_join_enabled: DEFAULT_SETTINGS.autoJoinEnabled,
        join_buffer_minutes: DEFAULT_SETTINGS.joinBufferMinutes,
        default_language: DEFAULT_SETTINGS.defaultLanguage,
        enable_speaker_diarization: DEFAULT_SETTINGS.enableSpeakerDiarization,
        default_summary_style: DEFAULT_SETTINGS.defaultSummaryStyle,
        auto_send_summary: DEFAULT_SETTINGS.autoSendSummary,
        send_to_attendees: DEFAULT_SETTINGS.sendToAttendees,
        recap_distribution_emails: DEFAULT_SETTINGS.recapDistributionEmails,
        auto_generate_followup: DEFAULT_SETTINGS.autoGenerateFollowup,
        match_email_style: DEFAULT_SETTINGS.matchEmailStyle,
        retain_recordings_days: DEFAULT_SETTINGS.retainRecordingsDays,
        retain_transcripts_days: DEFAULT_SETTINGS.retainTranscriptsDays,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[SettingsService] Error creating settings:', error);
      // Return defaults
      return {
        id: '',
        userEmail,
        userCode,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return mapDbToSettings(data);
  } catch (error) {
    console.error('[SettingsService] Exception creating settings:', error);
    return {
      id: '',
      userEmail,
      userCode,
      ...DEFAULT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// ============================================================================
// Update Settings
// ============================================================================

/**
 * Update notetaker settings for a user
 */
export async function updateNotetakerSettings(
  userEmail: string,
  updates: UpdateNotetakerSettingsInput,
  userCode?: string
): Promise<{ success: boolean; settings?: MeetingNotetakerSettings; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Map input to DB columns
    const dbUpdates: Record<string, any> = {};

    if (updates.autoJoinEnabled !== undefined) {
      dbUpdates.auto_join_enabled = updates.autoJoinEnabled;
    }
    if (updates.joinBufferMinutes !== undefined) {
      dbUpdates.join_buffer_minutes = updates.joinBufferMinutes;
    }
    if (updates.defaultLanguage !== undefined) {
      dbUpdates.default_language = updates.defaultLanguage;
    }
    if (updates.enableSpeakerDiarization !== undefined) {
      dbUpdates.enable_speaker_diarization = updates.enableSpeakerDiarization;
    }
    if (updates.defaultSummaryStyle !== undefined) {
      dbUpdates.default_summary_style = updates.defaultSummaryStyle;
    }
    if (updates.autoSendSummary !== undefined) {
      dbUpdates.auto_send_summary = updates.autoSendSummary;
    }
    if (updates.sendToAttendees !== undefined) {
      dbUpdates.send_to_attendees = updates.sendToAttendees;
    }
    if (updates.recapDistributionEmails !== undefined) {
      dbUpdates.recap_distribution_emails = updates.recapDistributionEmails;
    }
    if (updates.autoGenerateFollowup !== undefined) {
      dbUpdates.auto_generate_followup = updates.autoGenerateFollowup;
    }
    if (updates.matchEmailStyle !== undefined) {
      dbUpdates.match_email_style = updates.matchEmailStyle;
    }
    if (updates.retainRecordingsDays !== undefined) {
      dbUpdates.retain_recordings_days = updates.retainRecordingsDays;
    }
    if (updates.retainTranscriptsDays !== undefined) {
      dbUpdates.retain_transcripts_days = updates.retainTranscriptsDays;
    }

    if (Object.keys(dbUpdates).length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    // Upsert settings
    const { data, error } = await supabase
      .from('meeting_notetaker_settings')
      .upsert(
        {
          user_email: userEmail,
          user_code: userCode,
          ...dbUpdates,
        },
        { onConflict: 'user_email' }
      )
      .select()
      .single();

    if (error) {
      console.error('[SettingsService] Error updating settings:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      settings: mapDbToSettings(data),
    };
  } catch (error) {
    console.error('[SettingsService] Exception updating settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function mapDbToSettings(data: any): MeetingNotetakerSettings {
  return {
    id: data.id,
    userEmail: data.user_email,
    userCode: data.user_code,
    autoJoinEnabled: data.auto_join_enabled ?? DEFAULT_SETTINGS.autoJoinEnabled,
    joinBufferMinutes: data.join_buffer_minutes ?? DEFAULT_SETTINGS.joinBufferMinutes,
    defaultLanguage: data.default_language ?? DEFAULT_SETTINGS.defaultLanguage,
    enableSpeakerDiarization: data.enable_speaker_diarization ?? DEFAULT_SETTINGS.enableSpeakerDiarization,
    defaultSummaryStyle: (data.default_summary_style as SummaryStyle) ?? DEFAULT_SETTINGS.defaultSummaryStyle,
    autoSendSummary: data.auto_send_summary ?? DEFAULT_SETTINGS.autoSendSummary,
    sendToAttendees: data.send_to_attendees ?? DEFAULT_SETTINGS.sendToAttendees,
    recapDistributionEmails: data.recap_distribution_emails ?? DEFAULT_SETTINGS.recapDistributionEmails,
    autoGenerateFollowup: data.auto_generate_followup ?? DEFAULT_SETTINGS.autoGenerateFollowup,
    matchEmailStyle: data.match_email_style ?? DEFAULT_SETTINGS.matchEmailStyle,
    retainRecordingsDays: data.retain_recordings_days ?? DEFAULT_SETTINGS.retainRecordingsDays,
    retainTranscriptsDays: data.retain_transcripts_days ?? DEFAULT_SETTINGS.retainTranscriptsDays,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

/**
 * Meeting Notetaker Settings API Route
 *
 * GET /api/meetings/settings - Get user's notetaker settings
 * PUT /api/meetings/settings - Update notetaker settings
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateSettings,
  updateNotetakerSettings,
} from '@/lib/services/meeting-notetaker/settings-service';

// ============================================================================
// GET - Get Settings
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const code = searchParams.get('code');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const settings = await getOrCreateSettings(email, code || undefined);

    return NextResponse.json({
      settings: {
        autoJoinEnabled: settings.autoJoinEnabled,
        joinBufferMinutes: settings.joinBufferMinutes,
        defaultLanguage: settings.defaultLanguage,
        enableSpeakerDiarization: settings.enableSpeakerDiarization,
        defaultSummaryStyle: settings.defaultSummaryStyle,
        autoSendSummary: settings.autoSendSummary,
        sendToAttendees: settings.sendToAttendees,
        recapDistributionEmails: settings.recapDistributionEmails,
        autoGenerateFollowup: settings.autoGenerateFollowup,
        matchEmailStyle: settings.matchEmailStyle,
        retainRecordingsDays: settings.retainRecordingsDays,
        retainTranscriptsDays: settings.retainTranscriptsDays,
      },
    });
  } catch (error) {
    console.error('[SettingsAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Settings
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, ...updates } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const result = await updateNotetakerSettings(email, updates, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: result.settings ? {
        autoJoinEnabled: result.settings.autoJoinEnabled,
        joinBufferMinutes: result.settings.joinBufferMinutes,
        defaultLanguage: result.settings.defaultLanguage,
        enableSpeakerDiarization: result.settings.enableSpeakerDiarization,
        defaultSummaryStyle: result.settings.defaultSummaryStyle,
        autoSendSummary: result.settings.autoSendSummary,
        sendToAttendees: result.settings.sendToAttendees,
        recapDistributionEmails: result.settings.recapDistributionEmails,
        autoGenerateFollowup: result.settings.autoGenerateFollowup,
        matchEmailStyle: result.settings.matchEmailStyle,
        retainRecordingsDays: result.settings.retainRecordingsDays,
        retainTranscriptsDays: result.settings.retainTranscriptsDays,
      } : null,
    });
  } catch (error) {
    console.error('[SettingsAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

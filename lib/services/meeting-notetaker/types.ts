/**
 * Meeting Notetaker Types
 *
 * TypeScript interfaces and types for the meeting notetaker system.
 * These match the database schema defined in 046_meeting_notetaker.sql
 */

// ============================================================================
// Core Types
// ============================================================================

export type MeetingType = 'google_meet' | 'microphone' | 'upload';

export type MeetingStatus =
  | 'scheduled'
  | 'joining'
  | 'recording'
  | 'processing'
  | 'transcribing'
  | 'summarizing'
  | 'complete'
  | 'failed';

export type SummaryStyle = 'executive' | 'chronological' | 'sales';

export type ActionItemPriority = 'high' | 'medium' | 'low';

export type ActionItemStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export type CustomWordCategory =
  | 'product_name'
  | 'company_name'
  | 'acronym'
  | 'technical_term'
  | 'person_name'
  | 'other';

// ============================================================================
// Meeting Recording
// ============================================================================

export interface MeetingAttendee {
  email: string;
  name?: string;
  responseStatus: 'accepted' | 'tentative' | 'declined' | 'needsAction';
}

export interface MeetingRecording {
  id: string;
  userEmail: string;
  userCode?: string;
  calendarEventId?: string;
  googleMeetUrl?: string;
  meetingType: MeetingType;
  title?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  durationSeconds?: number;
  organizerEmail?: string;
  organizerName?: string;
  attendees: MeetingAttendee[];
  status: MeetingStatus;
  botSessionId?: string;
  recordingUrl?: string;
  recordingSizeBytes?: number;
  notetakerEnabled: boolean;
  emailSent: boolean;
  emailSentAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMeetingRecordingInput {
  userEmail: string;
  userCode?: string;
  calendarEventId?: string;
  googleMeetUrl?: string;
  meetingType?: MeetingType;
  title?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  organizerEmail?: string;
  organizerName?: string;
  attendees?: MeetingAttendee[];
  notetakerEnabled?: boolean;
}

// ============================================================================
// Transcription
// ============================================================================

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeakerProfile {
  index: number;
  label: string;
  email?: string;
  name?: string;
  wordCount: number;
  speakingTimeSeconds: number;
}

export interface MeetingTranscript {
  id: string;
  meetingId: string;
  rawTranscript?: string;
  editedTranscript?: string;
  segments: TranscriptSegment[];
  speakers: SpeakerProfile[];
  detectedLanguage: string;
  overallConfidence?: number;
  customWordsApplied: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionResult {
  success: boolean;
  transcript?: {
    fullText: string;
    segments: TranscriptSegment[];
    speakers: SpeakerProfile[];
    detectedLanguage: string;
    overallConfidence: number;
  };
  error?: string;
}

// ============================================================================
// Summaries
// ============================================================================

export interface MeetingSummary {
  id: string;
  meetingId: string;
  summaryStyle: SummaryStyle;
  summaryText: string;
  keyPoints: string[];
  topicsDiscussed: string[];
  generationModel?: string;
  customPrompt?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateSummaryInput {
  transcript: string;
  segments: TranscriptSegment[];
  speakers: SpeakerProfile[];
  style: SummaryStyle;
  meetingTitle?: string;
  attendees: MeetingAttendee[];
  durationMinutes: number;
  customPrompt?: string;
}

export interface GenerateSummaryResult {
  success: boolean;
  summary?: {
    summaryText: string;
    keyPoints: string[];
    topicsDiscussed: string[];
  };
  error?: string;
}

// ============================================================================
// Action Items
// ============================================================================

export interface MeetingActionItem {
  id: string;
  meetingId: string;
  taskDescription: string;
  ownerEmail?: string;
  ownerName?: string;
  priority: ActionItemPriority;
  dueDate?: Date;
  status: ActionItemStatus;
  confidence?: number;
  sourceTimestamp?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedActionItem {
  description: string;
  ownerEmail?: string;
  ownerName?: string;
  priority: ActionItemPriority;
  deadline?: Date;
  confidence: number;
  sourceTimestamp?: number;
}

export interface ActionItemExtractionResult {
  success: boolean;
  items?: ExtractedActionItem[];
  error?: string;
}

// ============================================================================
// Decisions
// ============================================================================

export interface MeetingDecision {
  id: string;
  meetingId: string;
  decisionText: string;
  context?: string;
  impactArea?: string;
  confidence?: number;
  sourceTimestamp?: number;
  createdAt: Date;
}

export interface ExtractedDecision {
  decisionText: string;
  context?: string;
  impactArea?: string;
  confidence: number;
  sourceTimestamp?: number;
}

export interface DecisionExtractionResult {
  success: boolean;
  decisions?: ExtractedDecision[];
  error?: string;
}

// ============================================================================
// Custom Words
// ============================================================================

export interface MeetingCustomWord {
  id: string;
  userEmail: string;
  userCode?: string;
  word: string;
  category?: CustomWordCategory;
  phoneticHints?: string[];
  usageCount: number;
  createdAt: Date;
}

// ============================================================================
// Settings
// ============================================================================

export interface MeetingNotetakerSettings {
  id: string;
  userEmail: string;
  userCode?: string;
  autoJoinEnabled: boolean;
  joinBufferMinutes: number;
  defaultLanguage: string;
  enableSpeakerDiarization: boolean;
  defaultSummaryStyle: SummaryStyle;
  autoSendSummary: boolean;
  sendToAttendees: boolean;
  recapDistributionEmails: string[];
  autoGenerateFollowup: boolean;
  matchEmailStyle: boolean;
  retainRecordingsDays: number;
  retainTranscriptsDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateNotetakerSettingsInput {
  autoJoinEnabled?: boolean;
  joinBufferMinutes?: number;
  defaultLanguage?: string;
  enableSpeakerDiarization?: boolean;
  defaultSummaryStyle?: SummaryStyle;
  autoSendSummary?: boolean;
  sendToAttendees?: boolean;
  recapDistributionEmails?: string[];
  autoGenerateFollowup?: boolean;
  matchEmailStyle?: boolean;
  retainRecordingsDays?: number;
  retainTranscriptsDays?: number;
}

// ============================================================================
// Chat
// ============================================================================

export interface MeetingChatMessage {
  id: string;
  meetingId: string;
  userEmail: string;
  role: 'user' | 'assistant';
  content: string;
  sourceCitations?: ChatCitation[];
  confidence?: number;
  createdAt: Date;
}

export interface ChatCitation {
  timestamp: number;
  speaker: string;
  text: string;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
  confidence: number;
}

// ============================================================================
// Follow-up Email
// ============================================================================

export interface MeetingFollowupDraft {
  id: string;
  meetingId: string;
  userEmail: string;
  subject?: string;
  body?: string;
  htmlBody?: string;
  toEmails: string[];
  ccEmails: string[];
  status: 'draft' | 'sent' | 'discarded';
  gmailDraftId?: string;
  generationModel?: string;
  styleMatched: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateFollowupInput {
  meetingId: string;
  summary: MeetingSummary;
  actionItems: MeetingActionItem[];
  attendees: MeetingAttendee[];
  senderName: string;
  senderEmail: string;
  matchStyle?: boolean;
}

export interface GenerateFollowupResult {
  success: boolean;
  draft?: {
    subject: string;
    body: string;
    htmlBody: string;
    toEmails: string[];
  };
  error?: string;
}

// ============================================================================
// Bot Integration
// ============================================================================

export interface BotJoinRequest {
  meetingId: string;
  googleMeetUrl: string;
  userEmail: string;
  botName: string;
  scheduledStart: Date;
  maxDurationMinutes: number;
}

export interface BotJoinResult {
  success: boolean;
  botSessionId?: string;
  error?: string;
}

export interface BotWebhookEvent {
  event:
    | 'bot.scheduled'
    | 'bot.joining'
    | 'bot.joined'
    | 'bot.recording'
    | 'bot.left'
    | 'meeting.ended'
    | 'transcription.complete'
    | 'bot.error';
  meetingId: string;
  botSessionId?: string;
  timestamp: Date;
  data?: {
    recordingUrl?: string;
    error?: string;
    durationSeconds?: number;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface MeetingWithDetails extends MeetingRecording {
  transcript?: MeetingTranscript;
  summaries?: MeetingSummary[];
  actionItems?: MeetingActionItem[];
  decisions?: MeetingDecision[];
  followupDraft?: MeetingFollowupDraft;
}

export interface MeetingListItem {
  id: string;
  title?: string;
  scheduledStart?: Date;
  durationSeconds?: number;
  status: MeetingStatus;
  attendeeCount: number;
  primarySummary?: string;
  actionItemCount: number;
  hasPendingActionItems: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Meeting Notetaker Services
 *
 * Main export file for all meeting notetaker functionality.
 */

// Types
export * from './types';

// Services
export { transcribeAudio, getCustomWordsForUser } from './transcription-service';
export { generateSummary, regenerateSummary } from './summary-generator';
export { extractActionItems } from './action-extractor';
export { extractDecisions } from './decision-extractor';
export { answerTranscriptQuestion } from './transcript-chat';
export { generateFollowupEmail } from './followup-email-generator';
export {
  scheduleBotJoin,
  cancelBotSession,
  getBotSessionStatus,
  getBotRecording,
  processBotWebhook,
  syncUpcomingMeetingsForUser,
} from './google-meet-bot';
export {
  getNotetakerSettings,
  updateNotetakerSettings,
  getOrCreateSettings,
} from './settings-service';

/**
 * Email Tools for the Agent System
 *
 * Tools for fetching emails, creating drafts, and managing email style.
 *
 * @module lib/agents/tools/email
 */

import { z } from 'zod';
import { google, gmail_v1 } from 'googleapis';
import { ToolDefinition, ToolContext, ToolResult } from './types';
import { getEmailStyle, EmailStyleProfile } from '@/lib/services/email-style-learner';

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

function createGmailClient(accessToken: string): gmail_v1.Gmail {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  let body = '';

  if (payload.body?.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        break;
      }
      if (part.parts) {
        const nestedBody = extractBody(part);
        if (nestedBody) {
          body = nestedBody;
          break;
        }
      }
    }
  }

  return body.trim();
}

// =========================================================================
// TOOLS
// =========================================================================

/**
 * Fetch Email Content Tool
 * Fetches the full content of an email by message ID
 * IMPORTANT: Does NOT mark the email as read
 */
export const fetchEmailContentTool: ToolDefinition = {
  name: 'fetch_email_content',
  description:
    'Fetch the full content of an email by message ID. Returns headers, body, and thread context. Does NOT mark the email as read.',
  riskLevel: 'low',
  parameters: z.object({
    messageId: z.string().describe('Gmail message ID'),
    includeThread: z.boolean().optional().default(false).describe('Include full thread context'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    const { messageId, includeThread } = params;

    if (!context.accessTokens.google) {
      return { success: false, error: 'Gmail not connected' };
    }

    try {
      const gmail = createGmailClient(context.accessTokens.google);

      // Fetch the message - using 'full' format does NOT mark as read
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = message.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const email = {
        id: message.data.id,
        threadId: message.data.threadId,
        subject: getHeader('subject'),
        from: getHeader('from'),
        to: getHeader('to'),
        date: getHeader('date'),
        body: extractBody(message.data.payload!),
        labels: message.data.labelIds || [],
        snippet: message.data.snippet,
      };

      // Fetch thread if requested
      let threadMessages: any[] = [];
      if (includeThread && message.data.threadId) {
        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: message.data.threadId,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });

        threadMessages = (thread.data.messages || []).map((m) => {
          const h = m.payload?.headers || [];
          return {
            id: m.id,
            from: h.find((x) => x.name?.toLowerCase() === 'from')?.value,
            date: h.find((x) => x.name?.toLowerCase() === 'date')?.value,
            snippet: m.snippet,
          };
        });
      }

      return {
        success: true,
        data: {
          email,
          thread: includeThread ? threadMessages : undefined,
        },
        metadata: {
          source: 'gmail',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[fetchEmailContent] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch email',
      };
    }
  },
};

/**
 * Create Gmail Draft Tool
 * Creates a draft reply to an email
 * MEDIUM RISK: Creates visible draft in user's Gmail
 */
export const createGmailDraftTool: ToolDefinition = {
  name: 'create_gmail_draft',
  description:
    'Create a draft reply to an email. MEDIUM RISK: Creates visible draft in user\'s Gmail. Does NOT send the email or mark the original as read.',
  riskLevel: 'medium',
  parameters: z.object({
    threadId: z.string().describe('Thread ID to reply to'),
    inReplyTo: z.string().describe('Message ID being replied to'),
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Reply subject (usually Re: original subject)'),
    body: z.string().describe('Draft body text'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    const { threadId, inReplyTo, to, subject, body } = params;

    if (!context.accessTokens.google) {
      return { success: false, error: 'Gmail not connected' };
    }

    try {
      const gmail = createGmailClient(context.accessTokens.google);

      // Build RFC 2822 message
      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `In-Reply-To: ${inReplyTo}`,
        `References: ${inReplyTo}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].join('\r\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage,
            threadId,
          },
        },
      });

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'email_draft_created',
        action_name: 'create_gmail_draft',
        action_args: { threadId, to, subject: subject.slice(0, 100) },
        action_result: { draftId: response.data.id },
        risk_level: 'medium',
        source: 'email_agent',
      });

      return {
        success: true,
        data: {
          draftId: response.data.id,
          messageId: response.data.message?.id,
        },
        metadata: {
          source: 'gmail',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[createGmailDraft] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create draft',
      };
    }
  },
};

/**
 * Get User Email Style Tool
 * Retrieves the user's learned email writing style profile
 */
export const getUserEmailStyleTool: ToolDefinition = {
  name: 'get_user_email_style',
  description:
    'Retrieve the user\'s learned email writing style profile including greeting patterns, sign-offs, tone, and verbosity.',
  riskLevel: 'low',
  parameters: z.object({}),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const style = await getEmailStyle(context.userEmail);

      if (!style) {
        return {
          success: true,
          data: {
            available: false,
            message: 'No email style profile found. Style learning has not been run yet.',
          },
        };
      }

      return {
        success: true,
        data: {
          available: true,
          style,
        },
        metadata: {
          source: 'email_style',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[getUserEmailStyle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get email style',
      };
    }
  },
};

/**
 * List Recent Emails Tool
 * Lists recent emails from the inbox (for context gathering)
 */
export const listRecentEmailsTool: ToolDefinition = {
  name: 'list_recent_emails',
  description: 'List recent emails from the inbox. Useful for understanding email context and patterns.',
  riskLevel: 'low',
  parameters: z.object({
    maxResults: z.number().optional().default(20).describe('Maximum emails to return'),
    query: z.string().optional().describe('Gmail search query (e.g., "is:unread", "from:name@email.com")'),
    labelIds: z.array(z.string()).optional().describe('Filter by label IDs'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    const { maxResults, query, labelIds } = params;

    if (!context.accessTokens.google) {
      return { success: false, error: 'Gmail not connected' };
    }

    try {
      const gmail = createGmailClient(context.accessTokens.google);

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
        labelIds,
      });

      const messages = response.data.messages || [];

      // Fetch metadata for each message
      const emailSummaries = await Promise.all(
        messages.slice(0, maxResults).map(async (msg) => {
          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });

          const headers = full.data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          return {
            id: msg.id,
            threadId: msg.threadId,
            from: getHeader('from'),
            subject: getHeader('subject'),
            date: getHeader('date'),
            snippet: full.data.snippet,
            labels: full.data.labelIds,
            isUnread: full.data.labelIds?.includes('UNREAD'),
          };
        })
      );

      return {
        success: true,
        data: {
          emails: emailSummaries,
          totalResults: response.data.resultSizeEstimate,
        },
        metadata: {
          source: 'gmail',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[listRecentEmails] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list emails',
      };
    }
  },
};

/**
 * Get Email Drafts Tool
 * Lists generated email drafts for the user
 */
export const getEmailDraftsTool: ToolDefinition = {
  name: 'get_email_drafts',
  description: 'List AI-generated email drafts that are pending review or have been created in Gmail.',
  riskLevel: 'low',
  parameters: z.object({
    status: z
      .enum(['pending', 'created', 'sent', 'modified', 'discarded', 'all'])
      .optional()
      .default('all'),
    limit: z.number().optional().default(20),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    const { status, limit } = params;

    try {
      let query = context.supabase
        .from('email_drafts')
        .select('*')
        .eq('user_email', context.userEmail)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: {
          drafts: data || [],
          count: data?.length || 0,
        },
        metadata: {
          source: 'email_drafts',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[getEmailDrafts] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get drafts',
      };
    }
  },
};

// =========================================================================
// EXPORTS
// =========================================================================

export const emailTools: ToolDefinition[] = [
  fetchEmailContentTool,
  createGmailDraftTool,
  getUserEmailStyleTool,
  listRecentEmailsTool,
  getEmailDraftsTool,
];

export default emailTools;

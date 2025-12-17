/**
 * Gmail Label Manager Service
 *
 * Handles creation, synchronization, and application of Gmail labels.
 * Maps internal Moccet classification to visible Gmail labels.
 *
 * @module lib/services/gmail-label-manager
 */

import { gmail_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { createValidatedGmailClient } from '@/lib/services/gmail-client';

// =========================================================================
// TYPES
// =========================================================================

export const MOCCET_LABELS = {
  to_respond: {
    displayName: 'To Respond',
    description: 'Needs reply, decision, or action',
    backgroundColor: '#fb4c2f', // Red
    textColor: '#ffffff',
  },
  fyi: {
    displayName: 'FYI',
    description: 'Informational only, no response needed',
    backgroundColor: '#16a765', // Green
    textColor: '#ffffff',
  },
  awaiting_reply: {
    displayName: 'Awaiting Reply',
    description: 'User replied last, waiting on someone else',
    backgroundColor: '#ffad47', // Orange
    textColor: '#000000',
  },
  actioned: {
    displayName: 'Actioned',
    description: 'Conversation finished/resolved',
    backgroundColor: '#42d692', // Light green
    textColor: '#000000',
  },
  notifications: {
    displayName: 'Notifications',
    description: 'Automated system messages',
    backgroundColor: '#a4c2f4', // Light blue (Gmail allowed)
    textColor: '#000000',
  },
  comment: {
    displayName: 'Comment',
    description: 'Comments/mentions from collaborative tools',
    backgroundColor: '#b694e8', // Purple (Gmail allowed)
    textColor: '#000000',
  },
  meeting_update: {
    displayName: 'Meeting Update',
    description: 'Calendar-related emails',
    backgroundColor: '#4986e7', // Blue
    textColor: '#ffffff',
  },
  marketing: {
    displayName: 'Marketing',
    description: 'Promotional content',
    backgroundColor: '#cccccc', // Gray
    textColor: '#000000',
  },
} as const;

export type MoccetLabelName = keyof typeof MOCCET_LABELS;

// Label priority for conflicts (higher wins)
export const LABEL_PRIORITY: Record<MoccetLabelName, number> = {
  to_respond: 10,
  awaiting_reply: 8,
  meeting_update: 7,
  actioned: 6,
  comment: 5,
  fyi: 4,
  notifications: 3,
  marketing: 1,
};

export interface SetupResult {
  success: boolean;
  labelsCreated: number;
  labelsExisting: number;
  errors: string[];
}

export interface LabelMapping {
  labelName: MoccetLabelName;
  gmailLabelId: string;
  displayName: string;
}

// =========================================================================
// GMAIL CLIENT
// =========================================================================

async function createGmailClient(
  userEmail: string,
  userCode?: string
): Promise<gmail_v1.Gmail | null> {
  // Use validated client to ensure token actually works
  const { gmail, error, wasRefreshed } = await createValidatedGmailClient(userEmail, userCode);

  if (!gmail) {
    console.error(`[LabelManager] Failed to get Gmail client for ${userEmail}:`, error);
    return null;
  }

  if (wasRefreshed) {
    console.log(`[LabelManager] Token was auto-refreshed for ${userEmail}`);
  }

  return gmail;
}

// =========================================================================
// LABEL SETUP
// =========================================================================

/**
 * Setup all Moccet labels in user's Gmail account
 * Creates labels that don't exist, skips ones that do
 */
export async function setupUserLabels(
  userEmail: string,
  userCode?: string,
  labelPrefix: string = 'moccet'
): Promise<SetupResult> {
  console.log(`[LabelManager] Setting up labels for ${userEmail}`);

  const gmail = await createGmailClient(userEmail, userCode);
  if (!gmail) {
    return {
      success: false,
      labelsCreated: 0,
      labelsExisting: 0,
      errors: ['Failed to authenticate with Gmail'],
    };
  }

  const supabase = createAdminClient();
  const errors: string[] = [];
  let labelsCreated = 0;
  let labelsExisting = 0;

  try {
    // Get existing labels from Gmail
    const existingLabelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabels = existingLabelsResponse.data.labels || [];
    const existingLabelNames = new Map(
      existingLabels.map((l) => [l.name?.toLowerCase(), l.id])
    );

    // Create each Moccet label
    for (const [labelName, labelConfig] of Object.entries(MOCCET_LABELS)) {
      const fullDisplayName = `${labelPrefix}/${labelConfig.displayName}`;
      const existingId = existingLabelNames.get(fullDisplayName.toLowerCase());

      let gmailLabelId: string | null = existingId || null;

      if (existingId) {
        // Label already exists
        labelsExisting++;
        console.log(`[LabelManager] Label exists: ${fullDisplayName}`);
      } else {
        // Create new label
        try {
          const createResponse = await gmail.users.labels.create({
            userId: 'me',
            requestBody: {
              name: fullDisplayName,
              labelListVisibility: 'labelShow',
              messageListVisibility: 'show',
              color: {
                backgroundColor: labelConfig.backgroundColor,
                textColor: labelConfig.textColor,
              },
            },
          });

          gmailLabelId = createResponse.data.id || null;
          labelsCreated++;
          console.log(`[LabelManager] Created label: ${fullDisplayName} (${gmailLabelId})`);
        } catch (createError: any) {
          errors.push(`Failed to create ${labelName}: ${createError.message}`);
          console.error(`[LabelManager] Failed to create ${fullDisplayName}:`, createError);
        }
      }

      // Store mapping in database
      if (gmailLabelId) {
        await supabase.from('gmail_user_labels').upsert(
          {
            user_email: userEmail,
            user_code: userCode || null,
            label_name: labelName,
            gmail_label_id: gmailLabelId,
            display_name: fullDisplayName,
            background_color: labelConfig.backgroundColor,
            text_color: labelConfig.textColor,
            is_synced: true,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_email,label_name' }
        );
      }
    }

    console.log(
      `[LabelManager] Setup complete: ${labelsCreated} created, ${labelsExisting} existing`
    );

    return {
      success: errors.length === 0,
      labelsCreated,
      labelsExisting,
      errors,
    };
  } catch (error: any) {
    console.error('[LabelManager] Setup failed:', error);
    return {
      success: false,
      labelsCreated,
      labelsExisting,
      errors: [error.message],
    };
  }
}

// =========================================================================
// LABEL APPLICATION
// =========================================================================

/**
 * Get user's label mapping from database
 */
export async function getUserLabelMapping(
  userEmail: string
): Promise<Map<MoccetLabelName, string>> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('gmail_user_labels')
    .select('label_name, gmail_label_id')
    .eq('user_email', userEmail)
    .eq('is_synced', true);

  const mapping = new Map<MoccetLabelName, string>();
  if (data) {
    for (const row of data) {
      if (row.gmail_label_id) {
        mapping.set(row.label_name as MoccetLabelName, row.gmail_label_id);
      }
    }
  }

  return mapping;
}

/**
 * Apply a Moccet label to an email in Gmail
 * Also removes any other Moccet labels from the email
 */
export async function applyLabelToEmail(
  userEmail: string,
  messageId: string,
  labelName: MoccetLabelName,
  userCode?: string,
  metadata?: { from?: string; subject?: string; threadId?: string; source?: string; confidence?: number; reasoning?: string }
): Promise<{ success: boolean; error?: string }> {
  console.log(`[LabelManager] Applying label ${labelName} to message ${messageId}`);

  const gmail = await createGmailClient(userEmail, userCode);
  if (!gmail) {
    return { success: false, error: 'Failed to authenticate with Gmail' };
  }

  const supabase = createAdminClient();

  try {
    // Get label mapping
    const labelMapping = await getUserLabelMapping(userEmail);
    const gmailLabelId = labelMapping.get(labelName);

    if (!gmailLabelId) {
      // Labels not set up yet, try to set them up
      console.log(`[LabelManager] Labels not found, setting up for ${userEmail}`);
      await setupUserLabels(userEmail, userCode);
      const newMapping = await getUserLabelMapping(userEmail);
      const newLabelId = newMapping.get(labelName);

      if (!newLabelId) {
        return { success: false, error: `Label ${labelName} not found after setup` };
      }
    }

    const finalLabelId = labelMapping.get(labelName) || (await getUserLabelMapping(userEmail)).get(labelName);
    if (!finalLabelId) {
      return { success: false, error: `Label ${labelName} not found` };
    }

    // Get all Moccet label IDs to remove other labels
    const allMoccetLabelIds = Array.from(labelMapping.values()).filter(
      (id) => id !== finalLabelId
    );

    // Apply the new label and remove others
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [finalLabelId],
        removeLabelIds: allMoccetLabelIds,
      },
    });

    // Get previous label assignment for this message
    const { data: existingAssignment } = await supabase
      .from('email_label_assignments')
      .select('label_name')
      .eq('user_email', userEmail)
      .eq('message_id', messageId)
      .maybeSingle();

    // Record assignment in database
    await supabase.from('email_label_assignments').upsert(
      {
        user_email: userEmail,
        user_code: userCode || null,
        message_id: messageId,
        thread_id: metadata?.threadId || '',
        label_name: labelName,
        gmail_label_id: finalLabelId,
        classification_source: metadata?.source || 'ai',
        confidence_score: metadata?.confidence,
        classification_reasoning: metadata?.reasoning,
        previous_label: existingAssignment?.label_name || null,
        from_email: metadata?.from,
        subject: metadata?.subject,
        is_applied: true,
        applied_at: new Date().toISOString(),
      },
      { onConflict: 'user_email,message_id' }
    );

    console.log(`[LabelManager] Applied ${labelName} to ${messageId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[LabelManager] Failed to apply label:`, error);

    // Record failed assignment
    await supabase.from('email_label_assignments').upsert(
      {
        user_email: userEmail,
        user_code: userCode || null,
        message_id: messageId,
        thread_id: metadata?.threadId || '',
        label_name: labelName,
        classification_source: metadata?.source || 'ai',
        is_applied: false,
        apply_error: error.message,
      },
      { onConflict: 'user_email,message_id' }
    );

    return { success: false, error: error.message };
  }
}

/**
 * Remove a Moccet label from an email
 */
export async function removeLabelFromEmail(
  userEmail: string,
  messageId: string,
  labelName: MoccetLabelName,
  userCode?: string
): Promise<{ success: boolean; error?: string }> {
  const gmail = await createGmailClient(userEmail, userCode);
  if (!gmail) {
    return { success: false, error: 'Failed to authenticate with Gmail' };
  }

  try {
    const labelMapping = await getUserLabelMapping(userEmail);
    const gmailLabelId = labelMapping.get(labelName);

    if (!gmailLabelId) {
      return { success: true }; // Label doesn't exist, nothing to remove
    }

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: [gmailLabelId],
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[LabelManager] Failed to remove label:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current label for an email
 */
export async function getEmailLabel(
  userEmail: string,
  messageId: string
): Promise<MoccetLabelName | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_label_assignments')
    .select('label_name')
    .eq('user_email', userEmail)
    .eq('message_id', messageId)
    .eq('is_applied', true)
    .maybeSingle();

  return (data?.label_name as MoccetLabelName) || null;
}

/**
 * Get the current label for a thread (most recent message's label)
 */
export async function getThreadLabel(
  userEmail: string,
  threadId: string
): Promise<MoccetLabelName | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_label_assignments')
    .select('label_name')
    .eq('user_email', userEmail)
    .eq('thread_id', threadId)
    .eq('is_applied', true)
    .order('labeled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.label_name as MoccetLabelName) || null;
}

/**
 * Check if user has labels set up
 */
export async function hasLabelsSetup(userEmail: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('gmail_user_labels')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .eq('is_synced', true);

  return (count || 0) >= Object.keys(MOCCET_LABELS).length;
}

/**
 * Determine which label should win when there's a conflict
 */
export function resolveLabeLConflict(
  currentLabel: MoccetLabelName | null,
  newLabel: MoccetLabelName
): MoccetLabelName {
  if (!currentLabel) return newLabel;

  const currentPriority = LABEL_PRIORITY[currentLabel];
  const newPriority = LABEL_PRIORITY[newLabel];

  return newPriority >= currentPriority ? newLabel : currentLabel;
}

// =========================================================================
// BACKFILL - Label existing emails
// =========================================================================

export interface BackfillResult {
  success: boolean;
  totalFetched: number;
  labeled: number;
  skippedSelf: number;
  errors: string[];
}

/**
 * Check if an email is from the user themselves (including aliases)
 */
function isEmailFromSelf(fromEmail: string, userEmail: string): boolean {
  // Normalize emails for comparison
  const normalizeEmail = (email: string) => {
    // Extract email from "Name <email@domain.com>" format
    const match = email.match(/<([^>]+)>/);
    const extracted = match ? match[1] : email;
    return extracted.toLowerCase().trim();
  };

  const from = normalizeEmail(fromEmail);
  const user = normalizeEmail(userEmail);

  // Direct match
  if (from === user) return true;

  // Check for Gmail aliases (user+alias@gmail.com)
  const fromBase = from.split('+')[0] + '@' + from.split('@')[1];
  const userBase = user.split('+')[0] + '@' + user.split('@')[1];
  if (fromBase === userBase) return true;

  // Check for dots in Gmail (u.s.e.r@gmail.com === user@gmail.com)
  if (from.endsWith('@gmail.com') && user.endsWith('@gmail.com')) {
    const fromNoDots = from.replace(/\./g, '').replace('@gmailcom', '@gmail.com');
    const userNoDots = user.replace(/\./g, '').replace('@gmailcom', '@gmail.com');
    if (fromNoDots === userNoDots) return true;
  }

  return false;
}

/**
 * Check if user has replied in a thread after a specific message
 * Used to determine if an email should be "Awaiting Reply" instead of "To Respond"
 */
async function hasUserRepliedInThread(
  gmail: gmail_v1.Gmail,
  threadId: string,
  messageInternalDate: string,
  userEmail: string
): Promise<boolean> {
  try {
    // Get full thread
    const threadResponse = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['From', 'Date'],
    });

    const messages = threadResponse.data.messages || [];
    const messageDate = parseInt(messageInternalDate);

    // Check if any message after this one is from the user
    for (const msg of messages) {
      const msgDate = parseInt(msg.internalDate || '0');
      if (msgDate <= messageDate) continue; // Skip messages before/at current

      const headers = msg.payload?.headers || [];
      const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';

      if (isEmailFromSelf(fromHeader, userEmail)) {
        return true; // User replied after this email
      }
    }

    return false;
  } catch (error) {
    console.error('[LabelManager] Error checking thread replies:', error);
    return false;
  }
}

/**
 * Backfill labels for existing emails
 * Called after label setup to label recent emails
 */
export async function backfillExistingEmails(
  userEmail: string,
  userCode?: string,
  maxEmails: number = 50
): Promise<BackfillResult> {
  console.log(`[LabelManager] Backfilling labels for ${userEmail} (max: ${maxEmails})`);

  const gmail = await createGmailClient(userEmail, userCode);
  if (!gmail) {
    return {
      success: false,
      totalFetched: 0,
      labeled: 0,
      skippedSelf: 0,
      errors: ['Failed to authenticate with Gmail'],
    };
  }

  const errors: string[] = [];
  let labeled = 0;
  let skippedSelf = 0;

  try {
    // Import classifier dynamically to avoid circular dependency
    const { classifyEmailWithLabeling } = await import('@/lib/services/email-classifier');

    // Fetch recent emails from inbox
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: maxEmails,
    });

    const messages = listResponse.data.messages || [];
    console.log(`[LabelManager] Found ${messages.length} emails to process`);

    // Process each email
    for (const msg of messages) {
      if (!msg.id) continue;

      try {
        // Fetch full email
        const emailResponse = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = emailResponse.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const fromHeader = getHeader('from');
        const subject = getHeader('subject');

        // Skip if email is from the user themselves
        if (isEmailFromSelf(fromHeader, userEmail)) {
          console.log(`[LabelManager] Skipping self-email: ${subject.slice(0, 50)}`);
          skippedSelf++;
          continue;
        }

        // Extract body
        let body = '';
        const payload = emailResponse.data.payload;
        if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64').toString('utf-8');
              break;
            }
          }
        }

        // Parse sender
        const fromMatch = fromHeader.match(/^(.+?)\s*<(.+)>$/);
        const fromName = fromMatch ? fromMatch[1].replace(/"/g, '') : undefined;
        const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

        // Build email object for classification
        const emailToClassify = {
          messageId: msg.id,
          threadId: emailResponse.data.threadId || '',
          from: fromEmail,
          fromName,
          to: getHeader('to'),
          subject,
          body: body.trim(),
          snippet: emailResponse.data.snippet || '',
          labels: emailResponse.data.labelIds || [],
          receivedAt: new Date(parseInt(emailResponse.data.internalDate || '0')),
          isUnread: emailResponse.data.labelIds?.includes('UNREAD') || false,
        };

        // Classify email
        const classification = await classifyEmailWithLabeling(emailToClassify);

        // Check if user has already replied in this thread
        // If so, override to "awaiting_reply" regardless of classification
        let finalLabel = classification.moccetLabel;
        let labelReasoning = classification.labelReasoning;

        if (emailResponse.data.threadId && emailResponse.data.internalDate) {
          const userReplied = await hasUserRepliedInThread(
            gmail,
            emailResponse.data.threadId,
            emailResponse.data.internalDate,
            userEmail
          );

          if (userReplied) {
            finalLabel = 'awaiting_reply';
            labelReasoning = 'User has already replied in this thread';
            console.log(`[LabelManager] Override to awaiting_reply - user replied in thread: ${subject.slice(0, 30)}`);
          }
        }

        // Apply label
        const applyResult = await applyLabelToEmail(
          userEmail,
          msg.id,
          finalLabel,
          userCode,
          {
            from: fromEmail,
            subject,
            threadId: emailResponse.data.threadId || '',
            source: 'heuristic',
            confidence: classification.confidence,
            reasoning: `Backfill: ${labelReasoning}`,
          }
        );

        if (applyResult.success) {
          labeled++;
          console.log(`[LabelManager] Labeled "${subject.slice(0, 30)}..." as ${finalLabel}`);
        } else {
          errors.push(`Failed to label ${msg.id}: ${applyResult.error}`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (emailError: any) {
        errors.push(`Error processing ${msg.id}: ${emailError.message}`);
      }
    }

    console.log(
      `[LabelManager] Backfill complete: ${labeled} labeled, ${skippedSelf} skipped (self), ${errors.length} errors`
    );

    return {
      success: true,
      totalFetched: messages.length,
      labeled,
      skippedSelf,
      errors,
    };
  } catch (error: any) {
    console.error('[LabelManager] Backfill failed:', error);
    return {
      success: false,
      totalFetched: 0,
      labeled,
      skippedSelf,
      errors: [error.message],
    };
  }
}

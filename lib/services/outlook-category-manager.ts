/**
 * Outlook Category Manager Service
 *
 * Handles creation, synchronization, and application of Outlook categories.
 * Maps internal Moccet classification to visible Outlook categories.
 *
 * @module lib/services/outlook-category-manager
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  createValidatedOutlookMailClient,
  OutlookMailClient,
  OutlookCategoryColor,
} from '@/lib/services/outlook-mail-client';

// =========================================================================
// TYPES
// =========================================================================

export const MOCCET_CATEGORIES = {
  to_respond: {
    displayName: 'Moccet: To Respond',
    description: 'Needs reply, decision, or action',
    color: 'preset0' as OutlookCategoryColor, // Red
  },
  fyi: {
    displayName: 'Moccet: FYI',
    description: 'Informational only, no response needed',
    color: 'preset4' as OutlookCategoryColor, // Green
  },
  awaiting_reply: {
    displayName: 'Moccet: Awaiting Reply',
    description: 'User replied last, waiting on someone else',
    color: 'preset1' as OutlookCategoryColor, // Orange
  },
  actioned: {
    displayName: 'Moccet: Actioned',
    description: 'Conversation finished/resolved',
    color: 'preset3' as OutlookCategoryColor, // Yellow
  },
  notifications: {
    displayName: 'Moccet: Notifications',
    description: 'Automated system messages',
    color: 'preset7' as OutlookCategoryColor, // Blue
  },
  comment: {
    displayName: 'Moccet: Comment',
    description: 'Comments/mentions from collaborative tools',
    color: 'preset8' as OutlookCategoryColor, // Purple
  },
  meeting_update: {
    displayName: 'Moccet: Meeting Update',
    description: 'Calendar-related emails',
    color: 'preset5' as OutlookCategoryColor, // Teal
  },
  marketing: {
    displayName: 'Moccet: Marketing',
    description: 'Promotional content',
    color: 'preset12' as OutlookCategoryColor, // Gray
  },
} as const;

export type MoccetCategoryName = keyof typeof MOCCET_CATEGORIES;

// Folder display names (matching category names)
export const MOCCET_FOLDERS: Record<MoccetCategoryName, string> = {
  to_respond: 'To Respond',
  fyi: 'FYI',
  awaiting_reply: 'Awaiting Reply',
  actioned: 'Actioned',
  notifications: 'Notifications',
  comment: 'Comment',
  meeting_update: 'Meeting Update',
  marketing: 'Marketing',
};

export const MOCCET_PARENT_FOLDER_NAME = 'Moccet';

// Organization modes
export type OrganizationMode = 'categories' | 'folders' | 'both';

// Category priority for conflicts (higher wins)
export const CATEGORY_PRIORITY: Record<MoccetCategoryName, number> = {
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
  categoriesCreated: number;
  categoriesExisting: number;
  errors: string[];
}

export interface CategoryMapping {
  categoryName: MoccetCategoryName;
  outlookCategoryId: string;
  displayName: string;
}

// =========================================================================
// OUTLOOK CLIENT
// =========================================================================

async function createOutlookClient(
  userEmail: string,
  userCode?: string
): Promise<OutlookMailClient | null> {
  const { client, error, wasRefreshed } = await createValidatedOutlookMailClient(userEmail, userCode);

  if (!client) {
    console.error(`[CategoryManager] Failed to get Outlook client for ${userEmail}:`, error);
    return null;
  }

  if (wasRefreshed) {
    console.log(`[CategoryManager] Token was auto-refreshed for ${userEmail}`);
  }

  return client;
}

// =========================================================================
// CATEGORY SETUP
// =========================================================================

/**
 * Setup all Moccet categories in user's Outlook account
 * Creates categories that don't exist, skips ones that do
 */
export async function setupUserCategories(
  userEmail: string,
  userCode?: string
): Promise<SetupResult> {
  console.log(`[CategoryManager] Setting up categories for ${userEmail}`);

  const client = await createOutlookClient(userEmail, userCode);
  if (!client) {
    return {
      success: false,
      categoriesCreated: 0,
      categoriesExisting: 0,
      errors: ['Failed to authenticate with Outlook'],
    };
  }

  const supabase = createAdminClient();
  const errors: string[] = [];
  let categoriesCreated = 0;
  let categoriesExisting = 0;

  try {
    // Get existing categories from Outlook
    const existingCategoriesResponse = await client.getCategories();
    const existingCategories = existingCategoriesResponse.value || [];
    const existingCategoryNames = new Map(
      existingCategories.map((c) => [c.displayName.toLowerCase(), c.id])
    );

    // Create each Moccet category
    for (const [categoryName, categoryConfig] of Object.entries(MOCCET_CATEGORIES)) {
      const displayName = categoryConfig.displayName;
      const existingId = existingCategoryNames.get(displayName.toLowerCase());

      let outlookCategoryId: string | undefined = existingId;

      if (existingId) {
        // Category already exists
        categoriesExisting++;
        console.log(`[CategoryManager] Category exists: ${displayName}`);
      } else {
        // Create new category
        try {
          const createResponse = await client.createCategory({
            displayName,
            color: categoryConfig.color,
          });

          outlookCategoryId = createResponse.id;
          categoriesCreated++;
          console.log(`[CategoryManager] Created category: ${displayName} (${outlookCategoryId})`);
        } catch (createError: unknown) {
          const err = createError as { message?: string };
          errors.push(`Failed to create ${categoryName}: ${err.message}`);
          console.error(`[CategoryManager] Failed to create ${displayName}:`, createError);
        }
      }

      // Store mapping in database
      if (outlookCategoryId) {
        await supabase.from('outlook_user_categories').upsert(
          {
            user_email: userEmail,
            user_code: userCode || null,
            category_name: categoryName,
            outlook_category_id: outlookCategoryId,
            display_name: displayName,
            color_preset: categoryConfig.color,
            is_synced: true,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_email,category_name' }
        );
      }
    }

    console.log(
      `[CategoryManager] Setup complete: ${categoriesCreated} created, ${categoriesExisting} existing`
    );

    return {
      success: errors.length === 0,
      categoriesCreated,
      categoriesExisting,
      errors,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[CategoryManager] Setup failed:', error);
    return {
      success: false,
      categoriesCreated,
      categoriesExisting,
      errors: [err.message || 'Unknown error'],
    };
  }
}

// =========================================================================
// FOLDER SETUP
// =========================================================================

export interface FolderSetupResult {
  success: boolean;
  parentFolderId: string | null;
  foldersCreated: number;
  foldersExisting: number;
  errors: string[];
}

/**
 * Setup all Moccet folders in user's Outlook account
 * Creates a parent "Moccet" folder with subfolders for each category
 */
export async function setupMoccetFolders(
  userEmail: string,
  userCode?: string
): Promise<FolderSetupResult> {
  console.log(`[CategoryManager] Setting up folders for ${userEmail}`);

  const client = await createOutlookClient(userEmail, userCode);
  if (!client) {
    return {
      success: false,
      parentFolderId: null,
      foldersCreated: 0,
      foldersExisting: 0,
      errors: ['Failed to authenticate with Outlook'],
    };
  }

  const supabase = createAdminClient();
  const errors: string[] = [];
  let foldersCreated = 0;
  let foldersExisting = 0;
  let parentFolderId: string | null = null;

  try {
    // Get existing top-level folders
    const foldersResponse = await client.getFolders();
    const existingFolders = foldersResponse.value || [];
    const existingFolderMap = new Map(
      existingFolders.map((f) => [f.displayName.toLowerCase(), f])
    );

    // Find or create parent Moccet folder
    const existingParent = existingFolderMap.get(MOCCET_PARENT_FOLDER_NAME.toLowerCase());
    if (existingParent) {
      parentFolderId = existingParent.id;
      console.log(`[CategoryManager] Parent folder exists: ${parentFolderId}`);
    } else {
      const newParent = await client.createFolder(MOCCET_PARENT_FOLDER_NAME);
      parentFolderId = newParent.id;
      foldersCreated++;
      console.log(`[CategoryManager] Created parent folder: ${parentFolderId}`);
    }

    // Get existing child folders
    const childFoldersResponse = await client.getChildFolders(parentFolderId);
    const existingChildFolders = childFoldersResponse.value || [];
    const existingChildMap = new Map(
      existingChildFolders.map((f) => [f.displayName.toLowerCase(), f])
    );

    // Create each category subfolder
    for (const [categoryName, folderDisplayName] of Object.entries(MOCCET_FOLDERS)) {
      const existingChild = existingChildMap.get(folderDisplayName.toLowerCase());
      let folderId: string;

      if (existingChild) {
        folderId = existingChild.id;
        foldersExisting++;
        console.log(`[CategoryManager] Folder exists: ${folderDisplayName}`);
      } else {
        try {
          const newFolder = await client.createChildFolder(parentFolderId, folderDisplayName);
          folderId = newFolder.id;
          foldersCreated++;
          console.log(`[CategoryManager] Created folder: ${folderDisplayName} (${folderId})`);
        } catch (createError: unknown) {
          const err = createError as { message?: string };
          errors.push(`Failed to create folder ${folderDisplayName}: ${err.message}`);
          console.error(`[CategoryManager] Failed to create ${folderDisplayName}:`, createError);
          continue;
        }
      }

      // Store folder mapping in database
      await supabase.from('outlook_user_folders').upsert(
        {
          user_email: userEmail,
          user_code: userCode || null,
          folder_name: categoryName,
          outlook_folder_id: folderId,
          display_name: folderDisplayName,
          parent_folder_id: parentFolderId,
          is_synced: true,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'user_email,folder_name' }
      );
    }

    console.log(
      `[CategoryManager] Folder setup complete: ${foldersCreated} created, ${foldersExisting} existing`
    );

    return {
      success: errors.length === 0,
      parentFolderId,
      foldersCreated,
      foldersExisting,
      errors,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[CategoryManager] Folder setup failed:', error);
    return {
      success: false,
      parentFolderId,
      foldersCreated,
      foldersExisting,
      errors: [err.message || 'Unknown error'],
    };
  }
}

/**
 * Get user's folder mapping from database
 */
export async function getUserFolderMapping(
  userEmail: string
): Promise<Map<MoccetCategoryName, string>> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('outlook_user_folders')
    .select('folder_name, outlook_folder_id')
    .eq('user_email', userEmail)
    .eq('is_synced', true);

  const mapping = new Map<MoccetCategoryName, string>();
  if (data) {
    for (const row of data) {
      if (row.outlook_folder_id) {
        mapping.set(row.folder_name as MoccetCategoryName, row.outlook_folder_id);
      }
    }
  }

  return mapping;
}

/**
 * Check if user has folders set up
 */
export async function hasFoldersSetup(userEmail: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('outlook_user_folders')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .eq('is_synced', true);

  return (count || 0) >= Object.keys(MOCCET_FOLDERS).length;
}

/**
 * Get user's organization mode from settings
 */
export async function getOrganizationMode(userEmail: string): Promise<OrganizationMode> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_draft_settings')
    .select('outlook_organization_mode')
    .eq('user_email', userEmail)
    .maybeSingle();

  return (data?.outlook_organization_mode as OrganizationMode) || 'categories';
}

/**
 * Set user's organization mode
 */
export async function setOrganizationMode(
  userEmail: string,
  mode: OrganizationMode
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('email_draft_settings')
    .upsert(
      {
        user_email: userEmail,
        outlook_organization_mode: mode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' }
    );

  if (error) {
    console.error('[CategoryManager] Failed to set organization mode:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =========================================================================
// CATEGORY APPLICATION
// =========================================================================

/**
 * Get user's category mapping from database
 */
export async function getUserCategoryMapping(
  userEmail: string
): Promise<Map<MoccetCategoryName, string>> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('outlook_user_categories')
    .select('category_name, display_name')
    .eq('user_email', userEmail)
    .eq('is_synced', true);

  const mapping = new Map<MoccetCategoryName, string>();
  if (data) {
    for (const row of data) {
      // Outlook uses display_name to identify categories on messages
      if (row.display_name) {
        mapping.set(row.category_name as MoccetCategoryName, row.display_name);
      }
    }
  }

  return mapping;
}

/**
 * Apply a Moccet category/folder to an email in Outlook
 * Respects the user's organization mode setting (categories, folders, or both)
 */
export async function applyCategoryToEmail(
  userEmail: string,
  messageId: string,
  categoryName: MoccetCategoryName,
  userCode?: string,
  metadata?: {
    from?: string;
    subject?: string;
    conversationId?: string;
    source?: string;
    confidence?: number;
    reasoning?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  console.log(`[CategoryManager] Applying ${categoryName} to message ${messageId}`);

  const client = await createOutlookClient(userEmail, userCode);
  if (!client) {
    return { success: false, error: 'Failed to authenticate with Outlook' };
  }

  const supabase = createAdminClient();

  try {
    // Get user's organization mode
    const organizationMode = await getOrganizationMode(userEmail);
    console.log(`[CategoryManager] Organization mode: ${organizationMode}`);

    let categoryApplied = false;
    let folderApplied = false;
    let appliedFolderId: string | null = null;

    // Apply category if mode is 'categories' or 'both'
    if (organizationMode === 'categories' || organizationMode === 'both') {
      // Get category mapping
      let categoryMapping = await getUserCategoryMapping(userEmail);

      if (categoryMapping.size === 0) {
        console.log(`[CategoryManager] Categories not found, setting up for ${userEmail}`);
        await setupUserCategories(userEmail, userCode);
        categoryMapping = await getUserCategoryMapping(userEmail);
      }

      const categoryDisplayName = categoryMapping.get(categoryName);
      if (categoryDisplayName) {
        // Get current email to preserve non-Moccet categories
        const email = await client.getEmail(messageId);
        const existingCategories = email.categories || [];

        // Get all Moccet category display names
        const allMoccetDisplayNames = Array.from(categoryMapping.values());

        // Filter out existing Moccet categories and add the new one
        const nonMoccetCategories = existingCategories.filter(
          (cat) => !allMoccetDisplayNames.includes(cat)
        );
        const newCategories = [...nonMoccetCategories, categoryDisplayName];

        // Apply the updated categories
        await client.applyCategoryToEmail(messageId, newCategories);
        categoryApplied = true;
        console.log(`[CategoryManager] Applied category ${categoryName}`);
      }
    }

    // Move to folder if mode is 'folders' or 'both'
    if (organizationMode === 'folders' || organizationMode === 'both') {
      // Get folder mapping
      let folderMapping = await getUserFolderMapping(userEmail);

      if (folderMapping.size === 0) {
        console.log(`[CategoryManager] Folders not found, setting up for ${userEmail}`);
        await setupMoccetFolders(userEmail, userCode);
        folderMapping = await getUserFolderMapping(userEmail);
      }

      const folderId = folderMapping.get(categoryName);
      if (folderId) {
        await client.moveEmail(messageId, folderId);
        folderApplied = true;
        appliedFolderId = folderId;
        console.log(`[CategoryManager] Moved to folder ${categoryName}`);
      }
    }

    // Get previous category assignment for this message
    const { data: existingAssignment } = await supabase
      .from('email_label_assignments')
      .select('label_name')
      .eq('user_email', userEmail)
      .eq('message_id', messageId)
      .eq('email_provider', 'outlook')
      .maybeSingle();

    // Record assignment in database
    await supabase.from('email_label_assignments').upsert(
      {
        user_email: userEmail,
        user_code: userCode || null,
        message_id: messageId,
        thread_id: metadata?.conversationId || '',
        label_name: categoryName,
        gmail_label_id: null, // Not applicable for Outlook
        email_provider: 'outlook',
        classification_source: metadata?.source || 'ai',
        confidence_score: metadata?.confidence,
        classification_reasoning: metadata?.reasoning,
        previous_label: existingAssignment?.label_name || null,
        from_email: metadata?.from,
        subject: metadata?.subject,
        is_applied: true,
        applied_at: new Date().toISOString(),
        organization_method: organizationMode,
        applied_folder_id: appliedFolderId,
      },
      { onConflict: 'user_email,message_id' }
    );

    console.log(`[CategoryManager] Applied ${categoryName} to ${messageId} (category: ${categoryApplied}, folder: ${folderApplied})`);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[CategoryManager] Failed to apply category:`, error);

    // Record failed assignment
    await supabase.from('email_label_assignments').upsert(
      {
        user_email: userEmail,
        user_code: userCode || null,
        message_id: messageId,
        thread_id: metadata?.conversationId || '',
        label_name: categoryName,
        email_provider: 'outlook',
        classification_source: metadata?.source || 'ai',
        is_applied: false,
        apply_error: err.message,
      },
      { onConflict: 'user_email,message_id' }
    );

    return { success: false, error: err.message };
  }
}

/**
 * Remove a Moccet category from an email
 */
export async function removeCategoryFromEmail(
  userEmail: string,
  messageId: string,
  categoryName: MoccetCategoryName,
  userCode?: string
): Promise<{ success: boolean; error?: string }> {
  const client = await createOutlookClient(userEmail, userCode);
  if (!client) {
    return { success: false, error: 'Failed to authenticate with Outlook' };
  }

  try {
    const categoryMapping = await getUserCategoryMapping(userEmail);
    const categoryDisplayName = categoryMapping.get(categoryName);

    if (!categoryDisplayName) {
      return { success: true }; // Category doesn't exist, nothing to remove
    }

    await client.removeCategoryFromEmail(messageId, categoryDisplayName);

    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[CategoryManager] Failed to remove category:`, error);
    return { success: false, error: err.message };
  }
}

/**
 * Get the current category for an email
 */
export async function getEmailCategory(
  userEmail: string,
  messageId: string
): Promise<MoccetCategoryName | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_label_assignments')
    .select('label_name')
    .eq('user_email', userEmail)
    .eq('message_id', messageId)
    .eq('email_provider', 'outlook')
    .eq('is_applied', true)
    .maybeSingle();

  return (data?.label_name as MoccetCategoryName) || null;
}

/**
 * Get the current category for a conversation (most recent message's category)
 */
export async function getConversationCategory(
  userEmail: string,
  conversationId: string
): Promise<MoccetCategoryName | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_label_assignments')
    .select('label_name')
    .eq('user_email', userEmail)
    .eq('thread_id', conversationId)
    .eq('email_provider', 'outlook')
    .eq('is_applied', true)
    .order('labeled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.label_name as MoccetCategoryName) || null;
}

/**
 * Check if user has categories set up
 */
export async function hasCategoriesSetup(userEmail: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('outlook_user_categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .eq('is_synced', true);

  return (count || 0) >= Object.keys(MOCCET_CATEGORIES).length;
}

/**
 * Determine which category should win when there's a conflict
 */
export function resolveCategoryConflict(
  currentCategory: MoccetCategoryName | null,
  newCategory: MoccetCategoryName
): MoccetCategoryName {
  if (!currentCategory) return newCategory;

  const currentPriority = CATEGORY_PRIORITY[currentCategory];
  const newPriority = CATEGORY_PRIORITY[newCategory];

  return newPriority >= currentPriority ? newCategory : currentCategory;
}

// =========================================================================
// BACKFILL - Categorize existing emails
// =========================================================================

export interface BackfillResult {
  success: boolean;
  totalFetched: number;
  categorized: number;
  skippedSelf: number;
  errors: string[];
}

/**
 * Check if an email is from the user themselves
 */
function isEmailFromSelf(fromEmail: string, userEmail: string): boolean {
  const normalizeEmail = (email: string) => email.toLowerCase().trim();

  const from = normalizeEmail(fromEmail);
  const user = normalizeEmail(userEmail);

  // Direct match
  if (from === user) return true;

  // Check for aliases (user+alias@domain.com)
  const fromBase = from.split('+')[0] + '@' + from.split('@')[1];
  const userBase = user.split('+')[0] + '@' + user.split('@')[1];
  if (fromBase === userBase) return true;

  return false;
}

/**
 * Check if user has replied in a conversation after a specific message
 */
async function hasUserRepliedInConversation(
  client: OutlookMailClient,
  conversationId: string,
  messageDateTime: Date,
  userEmail: string
): Promise<boolean> {
  try {
    const conversationEmails = await client.getConversationEmails(conversationId);
    const messages = conversationEmails.value || [];

    // Check if any message after this one is from the user
    for (const msg of messages) {
      const msgDate = new Date(msg.receivedDateTime);
      if (msgDate <= messageDateTime) continue;

      const fromAddress = msg.from?.emailAddress?.address || '';
      if (isEmailFromSelf(fromAddress, userEmail)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[CategoryManager] Error checking conversation replies:', error);
    return false;
  }
}

/**
 * Backfill categories for existing emails
 * Called after category setup to categorize recent emails
 */
export async function backfillExistingEmails(
  userEmail: string,
  userCode?: string,
  maxEmails: number = 50
): Promise<BackfillResult> {
  console.log(`[CategoryManager] Backfilling categories for ${userEmail} (max: ${maxEmails})`);

  const client = await createOutlookClient(userEmail, userCode);
  if (!client) {
    return {
      success: false,
      totalFetched: 0,
      categorized: 0,
      skippedSelf: 0,
      errors: ['Failed to authenticate with Outlook'],
    };
  }

  const errors: string[] = [];
  let categorized = 0;
  let skippedSelf = 0;

  try {
    // Import classifier dynamically to avoid circular dependency
    const { classifyEmailWithLabeling } = await import('@/lib/services/email-classifier');

    // Fetch recent emails from inbox
    const inboxResponse = await client.getInboxEmails({ maxResults: maxEmails });
    const messages = inboxResponse.value || [];
    console.log(`[CategoryManager] Found ${messages.length} emails to process`);

    // Process each email
    for (const msg of messages) {
      if (!msg.id) continue;

      try {
        // Get full email with body
        const email = await client.getEmail(msg.id);

        const fromAddress = email.from?.emailAddress?.address || '';
        const fromName = email.from?.emailAddress?.name;
        const subject = email.subject || '';

        // Skip if email is from the user themselves
        if (isEmailFromSelf(fromAddress, userEmail)) {
          console.log(`[CategoryManager] Skipping self-email: ${subject.slice(0, 50)}`);
          skippedSelf++;
          continue;
        }

        // Extract body text
        let bodyText = email.body?.content || '';
        if (email.body?.contentType === 'html') {
          // Simple HTML to text conversion
          bodyText = bodyText
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
        }

        // Build email object for classification
        const emailToClassify = {
          messageId: msg.id,
          threadId: email.conversationId || '',
          from: fromAddress,
          fromName,
          to: email.toRecipients?.map((r) => r.emailAddress?.address).join(', ') || '',
          subject,
          body: bodyText,
          snippet: email.bodyPreview || '',
          labels: email.categories || [],
          receivedAt: new Date(email.receivedDateTime),
          isUnread: !email.isRead,
        };

        // Classify email
        const classification = await classifyEmailWithLabeling(emailToClassify);

        // Check if user has already replied in this conversation
        let finalCategory = classification.moccetLabel as MoccetCategoryName;
        let categoryReasoning = classification.labelReasoning;

        if (email.conversationId) {
          const userReplied = await hasUserRepliedInConversation(
            client,
            email.conversationId,
            new Date(email.receivedDateTime),
            userEmail
          );

          if (userReplied) {
            finalCategory = 'awaiting_reply';
            categoryReasoning = 'User has already replied in this conversation';
            console.log(`[CategoryManager] Override to awaiting_reply - user replied: ${subject.slice(0, 30)}`);
          }
        }

        // Apply category
        const applyResult = await applyCategoryToEmail(
          userEmail,
          msg.id,
          finalCategory,
          userCode,
          {
            from: fromAddress,
            subject,
            conversationId: email.conversationId || '',
            source: 'heuristic',
            confidence: classification.confidence,
            reasoning: `Backfill: ${categoryReasoning}`,
          }
        );

        if (applyResult.success) {
          categorized++;
          console.log(`[CategoryManager] Categorized "${subject.slice(0, 30)}..." as ${finalCategory}`);
        } else {
          errors.push(`Failed to categorize ${msg.id}: ${applyResult.error}`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (emailError: unknown) {
        const err = emailError as { message?: string };
        errors.push(`Error processing ${msg.id}: ${err.message}`);
      }
    }

    console.log(
      `[CategoryManager] Backfill complete: ${categorized} categorized, ${skippedSelf} skipped (self), ${errors.length} errors`
    );

    return {
      success: true,
      totalFetched: messages.length,
      categorized,
      skippedSelf,
      errors,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[CategoryManager] Backfill failed:', error);
    return {
      success: false,
      totalFetched: 0,
      categorized,
      skippedSelf,
      errors: [err.message || 'Unknown error'],
    };
  }
}

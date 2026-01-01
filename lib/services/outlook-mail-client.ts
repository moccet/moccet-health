/**
 * Outlook Mail Client Service
 *
 * Provides a validated Outlook/Microsoft Graph client that automatically
 * refreshes tokens when they're invalid.
 *
 * @module lib/services/outlook-mail-client
 */

import { getValidatedAccessToken, getAccessToken } from '@/lib/services/token-manager';

// =========================================================================
// TYPES
// =========================================================================

export interface OutlookMailClientResult {
  client: OutlookMailClient | null;
  error?: string;
  wasRefreshed?: boolean;
}

export interface OutlookEmail {
  id: string;
  conversationId: string;
  subject: string;
  from: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  bodyPreview: string;
  receivedDateTime: string;
  sentDateTime?: string;
  isRead: boolean;
  isDraft: boolean;
  importance: 'low' | 'normal' | 'high';
  categories: string[];
  hasAttachments: boolean;
  parentFolderId: string;
  webLink?: string;
}

export interface OutlookCategory {
  id?: string;
  displayName: string;
  color: OutlookCategoryColor;
}

// Outlook preset colors (0-24)
export type OutlookCategoryColor =
  | 'preset0'   // Red
  | 'preset1'   // Orange
  | 'preset2'   // Brown
  | 'preset3'   // Yellow
  | 'preset4'   // Green
  | 'preset5'   // Teal
  | 'preset6'   // Olive
  | 'preset7'   // Blue
  | 'preset8'   // Purple
  | 'preset9'   // Cranberry
  | 'preset10'  // Steel
  | 'preset11'  // DarkSteel
  | 'preset12'  // Gray
  | 'preset13'  // DarkGray
  | 'preset14'  // Black
  | 'preset15'  // DarkRed
  | 'preset16'  // DarkOrange
  | 'preset17'  // DarkBrown
  | 'preset18'  // DarkYellow
  | 'preset19'  // DarkGreen
  | 'preset20'  // DarkTeal
  | 'preset21'  // DarkOlive
  | 'preset22'  // DarkBlue
  | 'preset23'  // DarkPurple
  | 'preset24'; // DarkCranberry

export interface OutlookDraft {
  id: string;
  subject: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  toRecipients: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  conversationId?: string;
  createdDateTime: string;
}

export interface OutlookFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

// =========================================================================
// OUTLOOK MAIL CLIENT CLASS
// =========================================================================

/**
 * Outlook Mail Client - wrapper around Microsoft Graph API
 */
export class OutlookMailClient {
  private accessToken: string;
  private baseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OutlookMailClient] API error ${response.status}:`, errorText);
      throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // =========================================================================
  // USER & VALIDATION
  // =========================================================================

  /**
   * Get user profile - also serves as token validation
   */
  async getProfile(): Promise<{ id: string; displayName: string; mail: string }> {
    return this.request('/me?$select=id,displayName,mail');
  }

  // =========================================================================
  // EMAILS
  // =========================================================================

  /**
   * Fetch emails from inbox
   */
  async getInboxEmails(options: {
    maxResults?: number;
    skip?: number;
    filter?: string;
    orderBy?: string;
    select?: string[];
  } = {}): Promise<{ value: OutlookEmail[]; '@odata.nextLink'?: string }> {
    const {
      maxResults = 50,
      skip = 0,
      filter,
      orderBy = 'receivedDateTime desc',
      select = ['id', 'conversationId', 'subject', 'from', 'toRecipients', 'bodyPreview', 'receivedDateTime', 'isRead', 'isDraft', 'importance', 'categories', 'hasAttachments', 'parentFolderId'],
    } = options;

    let url = `/me/mailFolders/inbox/messages?$top=${maxResults}&$skip=${skip}&$orderby=${orderBy}`;

    if (select.length > 0) {
      url += `&$select=${select.join(',')}`;
    }

    if (filter) {
      url += `&$filter=${encodeURIComponent(filter)}`;
    }

    return this.request(url);
  }

  /**
   * Fetch a single email by ID with full body
   */
  async getEmail(messageId: string): Promise<OutlookEmail> {
    return this.request(`/me/messages/${messageId}`);
  }

  /**
   * Fetch emails from a specific folder
   */
  async getFolderEmails(
    folderId: string,
    options: {
      maxResults?: number;
      skip?: number;
      orderBy?: string;
    } = {}
  ): Promise<{ value: OutlookEmail[]; '@odata.nextLink'?: string }> {
    const { maxResults = 50, skip = 0, orderBy = 'receivedDateTime desc' } = options;
    return this.request(`/me/mailFolders/${folderId}/messages?$top=${maxResults}&$skip=${skip}&$orderby=${orderBy}`);
  }

  /**
   * Fetch sent emails
   */
  async getSentEmails(options: {
    maxResults?: number;
    skip?: number;
  } = {}): Promise<{ value: OutlookEmail[]; '@odata.nextLink'?: string }> {
    return this.getFolderEmails('SentItems', options);
  }

  /**
   * Get emails by conversation ID (thread)
   */
  async getConversationEmails(conversationId: string): Promise<{ value: OutlookEmail[] }> {
    return this.request(`/me/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime asc`);
  }

  /**
   * Search emails
   */
  async searchEmails(query: string, maxResults: number = 25): Promise<{ value: OutlookEmail[] }> {
    return this.request(`/me/messages?$search="${encodeURIComponent(query)}"&$top=${maxResults}`);
  }

  /**
   * Mark email as read/unread
   */
  async updateEmailReadStatus(messageId: string, isRead: boolean): Promise<OutlookEmail> {
    return this.request(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    });
  }

  /**
   * Delete an email (move to deleted items)
   */
  async deleteEmail(messageId: string): Promise<void> {
    await this.request(`/me/messages/${messageId}`, { method: 'DELETE' });
  }

  /**
   * Move email to folder
   */
  async moveEmail(messageId: string, destinationFolderId: string): Promise<OutlookEmail> {
    return this.request(`/me/messages/${messageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId: destinationFolderId }),
    });
  }

  // =========================================================================
  // CATEGORIES (equivalent to Gmail labels)
  // =========================================================================

  /**
   * Get all user categories
   */
  async getCategories(): Promise<{ value: OutlookCategory[] }> {
    return this.request('/me/outlook/masterCategories');
  }

  /**
   * Create a new category
   */
  async createCategory(category: OutlookCategory): Promise<OutlookCategory> {
    return this.request('/me/outlook/masterCategories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    await this.request(`/me/outlook/masterCategories/${categoryId}`, { method: 'DELETE' });
  }

  /**
   * Apply categories to an email
   */
  async applyCategoryToEmail(messageId: string, categories: string[]): Promise<OutlookEmail> {
    return this.request(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ categories }),
    });
  }

  /**
   * Remove a category from an email
   */
  async removeCategoryFromEmail(messageId: string, categoryToRemove: string): Promise<OutlookEmail> {
    // First get current categories
    const email = await this.getEmail(messageId);
    const updatedCategories = email.categories.filter(c => c !== categoryToRemove);

    return this.applyCategoryToEmail(messageId, updatedCategories);
  }

  // =========================================================================
  // DRAFTS
  // =========================================================================

  /**
   * Get all drafts
   */
  async getDrafts(maxResults: number = 50): Promise<{ value: OutlookEmail[] }> {
    return this.getFolderEmails('Drafts', { maxResults });
  }

  /**
   * Create a draft email
   */
  async createDraft(draft: {
    subject: string;
    body: { contentType: 'text' | 'html'; content: string };
    toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
    ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
    importance?: 'low' | 'normal' | 'high';
  }): Promise<OutlookEmail> {
    return this.request('/me/messages', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  /**
   * Create a draft reply to an email
   */
  async createReplyDraft(
    messageId: string,
    comment?: string
  ): Promise<OutlookEmail> {
    const replyDraft = await this.request<OutlookEmail>(`/me/messages/${messageId}/createReply`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment || '' }),
    });

    return replyDraft;
  }

  /**
   * Update a draft
   */
  async updateDraft(
    messageId: string,
    updates: Partial<{
      subject: string;
      body: { contentType: 'text' | 'html'; content: string };
      toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
      categories: string[];
    }>
  ): Promise<OutlookEmail> {
    return this.request(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a draft
   */
  async deleteDraft(messageId: string): Promise<void> {
    await this.deleteEmail(messageId);
  }

  /**
   * Send a draft
   */
  async sendDraft(messageId: string): Promise<void> {
    await this.request(`/me/messages/${messageId}/send`, { method: 'POST' });
  }

  /**
   * Send a new email directly (without saving as draft first)
   */
  async sendEmail(email: {
    subject: string;
    body: { contentType: 'text' | 'html'; content: string };
    toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
    ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  }): Promise<void> {
    await this.request('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({ message: email }),
    });
  }

  // =========================================================================
  // FOLDERS
  // =========================================================================

  /**
   * Get all mail folders
   */
  async getFolders(): Promise<{ value: OutlookFolder[] }> {
    return this.request('/me/mailFolders?$top=100');
  }

  /**
   * Get folder by well-known name
   */
  async getFolder(folderNameOrId: string): Promise<OutlookFolder> {
    return this.request(`/me/mailFolders/${folderNameOrId}`);
  }

  /**
   * Get child folders of a folder
   */
  async getChildFolders(parentFolderId: string): Promise<{ value: OutlookFolder[] }> {
    return this.request(`/me/mailFolders/${parentFolderId}/childFolders?$top=100`);
  }

  /**
   * Create a new folder at the top level
   */
  async createFolder(displayName: string): Promise<OutlookFolder> {
    return this.request('/me/mailFolders', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    });
  }

  /**
   * Create a child folder under a parent folder
   */
  async createChildFolder(parentFolderId: string, displayName: string): Promise<OutlookFolder> {
    return this.request(`/me/mailFolders/${parentFolderId}/childFolders`, {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    });
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: string): Promise<void> {
    await this.request(`/me/mailFolders/${folderId}`, {
      method: 'DELETE',
    });
  }

  // =========================================================================
  // SUBSCRIPTIONS (Webhooks)
  // =========================================================================

  /**
   * Create a subscription for new mail notifications
   */
  async createSubscription(notificationUrl: string, clientState: string): Promise<{
    id: string;
    resource: string;
    changeType: string;
    notificationUrl: string;
    expirationDateTime: string;
    clientState: string;
  }> {
    // Microsoft Graph subscriptions expire after max 4230 minutes (about 3 days)
    const expirationDateTime = new Date(Date.now() + 4230 * 60 * 1000).toISOString();

    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        changeType: 'created,updated',
        notificationUrl,
        resource: '/me/mailFolders/inbox/messages',
        expirationDateTime,
        clientState,
      }),
    });
  }

  /**
   * Renew a subscription
   */
  async renewSubscription(subscriptionId: string): Promise<{
    id: string;
    expirationDateTime: string;
  }> {
    const expirationDateTime = new Date(Date.now() + 4230 * 60 * 1000).toISOString();

    return this.request(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ expirationDateTime }),
    });
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  /**
   * Get all active subscriptions
   */
  async getSubscriptions(): Promise<{ value: Array<{ id: string; resource: string; expirationDateTime: string }> }> {
    return this.request('/subscriptions');
  }
}

// =========================================================================
// TOKEN VALIDATION
// =========================================================================

/**
 * Validate an Outlook token by making a simple API call
 */
async function validateOutlookToken(accessToken: string): Promise<boolean> {
  try {
    const client = new OutlookMailClient(accessToken);
    await client.getProfile();
    return true;
  } catch (error: unknown) {
    const err = error as { message?: string };
    const errorMessage = err.message?.toLowerCase() || '';

    // Token is invalid if we get auth errors
    if (
      errorMessage.includes('401') ||
      errorMessage.includes('403') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid_token') ||
      errorMessage.includes('token expired') ||
      errorMessage.includes('access_denied')
    ) {
      console.log('[OutlookMailClient] Token validation failed:', errorMessage);
      return false;
    }

    // Other errors (network, rate limit, etc.) - assume token is valid
    console.warn('[OutlookMailClient] Token validation encountered non-auth error:', errorMessage);
    return true;
  }
}

// =========================================================================
// OUTLOOK CLIENT CREATION
// =========================================================================

/**
 * Create an Outlook Mail client with validated and auto-refreshed token
 *
 * @param userEmail - User's email address
 * @param userCode - Optional user code for lookup
 * @param skipValidation - If true, skip validation and use token as-is
 * @returns Outlook client or null if auth fails
 */
export async function createValidatedOutlookMailClient(
  userEmail: string,
  userCode?: string,
  skipValidation: boolean = false
): Promise<OutlookMailClientResult> {
  console.log(`[OutlookMailClient] Creating client for ${userEmail} (code: ${userCode || 'none'}, validate: ${!skipValidation})`);

  let token: string | null = null;
  let wasRefreshed = false;

  if (skipValidation) {
    // Fast path - just get token without validation
    console.log(`[OutlookMailClient] Attempting fast token lookup for ${userEmail}`);
    const result = await getAccessToken(userEmail, 'outlook', userCode);
    if (!result.token || result.error) {
      console.error(`[OutlookMailClient] FAILED - No token found for ${userEmail} (code: ${userCode || 'none'}). Error: ${result.error}`);
      return { client: null, error: result.error || 'No token found' };
    }
    console.log(`[OutlookMailClient] SUCCESS - Token retrieved for ${userEmail}`);
    token = result.token;
  } else {
    // Validated path - checks token actually works
    console.log(`[OutlookMailClient] Attempting validated token lookup for ${userEmail}`);
    const result = await getValidatedAccessToken(
      userEmail,
      'outlook',
      userCode,
      validateOutlookToken
    );

    if (!result.token) {
      console.error(`[OutlookMailClient] FAILED - Token validation failed for ${userEmail} (code: ${userCode || 'none'}). Error: ${result.error}`);
      return { client: null, error: result.error || 'Token validation failed' };
    }

    token = result.token;
    wasRefreshed = result.wasRefreshed || false;

    console.log(`[OutlookMailClient] SUCCESS - Validated token for ${userEmail} (wasRefreshed: ${wasRefreshed})`);
  }

  const client = new OutlookMailClient(token);
  return { client, wasRefreshed };
}

/**
 * Simple Outlook client creation without validation
 * Use this for performance-critical paths where you're okay with potential auth failures
 *
 * @deprecated Prefer createValidatedOutlookMailClient for reliability
 */
export async function createOutlookMailClientSimple(
  userEmail: string,
  userCode?: string
): Promise<OutlookMailClient | null> {
  const { token, error } = await getAccessToken(userEmail, 'outlook', userCode);
  if (!token || error) {
    console.error(`[OutlookMailClient] Failed to get token for ${userEmail}:`, error);
    return null;
  }

  return new OutlookMailClient(token);
}

/**
 * Contact Matching Service
 * Matches phone contacts to existing moccet users
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface PhoneContact {
  name: string;
  phoneNumber: string;
  email?: string;
}

export interface MatchedContact {
  contact_name: string;
  matched_user_email: string | null;
  match_status: 'matched' | 'no_match' | 'invited';
  display_name?: string;
  avatar_url?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

export class ContactMatchingService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Hash a phone number for privacy-preserving storage
   */
  private hashPhoneNumber(phoneNumber: string): string {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalized = phoneNumber.replace(/\D/g, '');
    // Hash with SHA-256
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Match a list of phone contacts to moccet users
   */
  async matchContacts(
    userEmail: string,
    contacts: PhoneContact[]
  ): Promise<MatchedContact[]> {
    const results: MatchedContact[] = [];

    // Get all existing moccet users' phone numbers (hashed)
    // For now, we'll check against emails since phone isn't stored yet
    // In production, you'd have a user_phone_hashes table

    for (const contact of contacts) {
      const phoneHash = this.hashPhoneNumber(contact.phoneNumber);

      // Check if we already processed this contact
      const { data: existingMatch } = await this.supabase
        .from('contact_matches')
        .select('*')
        .eq('user_email', userEmail)
        .eq('contact_phone_hash', phoneHash)
        .single();

      if (existingMatch) {
        results.push({
          contact_name: contact.name,
          matched_user_email: existingMatch.matched_user_email,
          match_status: existingMatch.match_status,
        });
        continue;
      }

      // Try to match by email if provided
      let matchedEmail: string | null = null;
      if (contact.email) {
        const { data: userByEmail } = await this.supabase
          .from('sage_onboarding_data')
          .select('email')
          .eq('email', contact.email.toLowerCase())
          .single();

        if (userByEmail) {
          matchedEmail = userByEmail.email;
        }
      }

      // Store the match result
      const matchStatus = matchedEmail ? 'matched' : 'no_match';
      await this.supabase.from('contact_matches').upsert({
        user_email: userEmail,
        contact_phone_hash: phoneHash,
        contact_name: contact.name,
        matched_user_email: matchedEmail,
        match_status: matchStatus,
      });

      results.push({
        contact_name: contact.name,
        matched_user_email: matchedEmail,
        match_status: matchStatus,
      });
    }

    // Enrich matched contacts with profile info
    const matchedEmails = results
      .filter((r) => r.matched_user_email)
      .map((r) => r.matched_user_email!);

    if (matchedEmails.length > 0) {
      const profiles = await this.getProfilesForEmails(matchedEmails);
      for (const result of results) {
        if (result.matched_user_email && profiles[result.matched_user_email]) {
          result.display_name = profiles[result.matched_user_email].display_name;
          result.avatar_url = profiles[result.matched_user_email].avatar_url;
        }
      }
    }

    return results;
  }

  /**
   * Get all matched contacts for a user
   */
  async getMatchedContacts(userEmail: string): Promise<MatchedContact[]> {
    const { data, error } = await this.supabase
      .from('contact_matches')
      .select('*')
      .eq('user_email', userEmail)
      .eq('match_status', 'matched');

    if (error || !data) {
      return [];
    }

    // Enrich with profile info
    const matchedEmails = data
      .filter((d) => d.matched_user_email)
      .map((d) => d.matched_user_email);

    const profiles = await this.getProfilesForEmails(matchedEmails);

    return data.map((match) => ({
      contact_name: match.contact_name,
      matched_user_email: match.matched_user_email,
      match_status: match.match_status,
      display_name: profiles[match.matched_user_email]?.display_name,
      avatar_url: profiles[match.matched_user_email]?.avatar_url,
    }));
  }

  /**
   * Mark a contact as invited (sent invite to join moccet)
   */
  async markAsInvited(
    userEmail: string,
    contactPhoneHash: string
  ): Promise<{ success: boolean }> {
    const { error } = await this.supabase
      .from('contact_matches')
      .update({
        match_status: 'invited',
        invite_sent_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail)
      .eq('contact_phone_hash', contactPhoneHash);

    return { success: !error };
  }

  /**
   * Get profile info for multiple emails
   */
  private async getProfilesForEmails(
    emails: string[]
  ): Promise<Record<string, { display_name?: string; avatar_url?: string }>> {
    if (emails.length === 0) return {};

    const { data } = await this.supabase
      .from('sage_onboarding_data')
      .select('email, form_data')
      .in('email', emails);

    const profiles: Record<string, { display_name?: string; avatar_url?: string }> = {};

    for (const user of data || []) {
      const formData = user.form_data as any;
      profiles[user.email] = {
        display_name: formData?.name || formData?.full_name || user.email.split('@')[0],
        avatar_url: formData?.avatar_url,
      };
    }

    return profiles;
  }
}

export const contactMatchingService = new ContactMatchingService();

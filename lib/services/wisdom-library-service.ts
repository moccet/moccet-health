/**
 * Wisdom Library Service
 *
 * Manages curated wisdom content from books, fitness, productivity, and life advice.
 * Provides content selection based on user preferences and ensures no repeats.
 *
 * @module lib/services/wisdom-library-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('WisdomLibraryService');

// Content categories
export type WisdomCategory =
  | 'self_development'
  | 'fitness'
  | 'cooking'
  | 'productivity'
  | 'life_advice';

export interface WisdomEntry {
  id: string;
  category: WisdomCategory;
  subcategory?: string;
  source: string;
  source_type: 'book' | 'research' | 'expert' | 'tradition';
  title: string;
  content: string;
  actionable_tip?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  times_shown: number;
  avg_engagement: number;
  created_at: string;
}

export interface WisdomCreateInput {
  category: WisdomCategory;
  subcategory?: string;
  source: string;
  source_type?: 'book' | 'research' | 'expert' | 'tradition';
  title: string;
  content: string;
  actionable_tip?: string;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface CategoryPreferences {
  self_development: number;
  fitness: number;
  cooking: number;
  productivity: number;
  life_advice: number;
  health_insights: number;
}

class WisdomLibraryServiceClass {
  private supabase = createAdminClient();

  /**
   * Get a random wisdom entry that the user hasn't seen
   */
  async getUnseen(
    email: string,
    category?: WisdomCategory
  ): Promise<WisdomEntry | null> {
    try {
      // Get IDs of content user has already seen
      const { data: seenContent } = await this.supabase
        .from('user_content_history')
        .select('content_id')
        .eq('user_email', email)
        .eq('content_type', 'wisdom');

      const seenIds = seenContent?.map((c) => c.content_id) || [];

      // Build query for unseen content
      let query = this.supabase
        .from('wisdom_library')
        .select('*')
        .eq('is_active', true);

      if (category) {
        query = query.eq('category', category);
      }

      if (seenIds.length > 0) {
        query = query.not('id', 'in', `(${seenIds.join(',')})`);
      }

      // Order by engagement (show higher engagement content first)
      // But add some randomness
      const { data: entries, error } = await query
        .order('avg_engagement', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Error fetching unseen wisdom', { error, email });
        return null;
      }

      if (!entries || entries.length === 0) {
        logger.info('No unseen wisdom available', { email, category });
        return null;
      }

      // Pick randomly from top 10 to add variety
      const randomIndex = Math.floor(Math.random() * entries.length);
      const selected = entries[randomIndex] as WisdomEntry;

      // Record that user has now seen this content
      await this.recordShown(email, selected.id);

      return selected;
    } catch (error) {
      logger.error('Error in getUnseen', { error, email });
      return null;
    }
  }

  /**
   * Get wisdom based on user's preference scores
   */
  async getPersonalized(email: string): Promise<WisdomEntry | null> {
    try {
      // Get user preferences
      const { data: prefs } = await this.supabase
        .from('user_content_preferences')
        .select('*')
        .eq('user_email', email)
        .single();

      // Default preferences if none exist
      const preferences: CategoryPreferences = prefs
        ? {
            self_development: prefs.self_development_score,
            fitness: prefs.fitness_score,
            cooking: prefs.cooking_score,
            productivity: prefs.productivity_score,
            life_advice: prefs.life_advice_score,
            health_insights: prefs.health_insights_score,
          }
        : {
            self_development: 0.5,
            fitness: 0.5,
            cooking: 0.5,
            productivity: 0.5,
            life_advice: 0.5,
            health_insights: 0.5,
          };

      // Pick category based on weighted random selection
      const category = this.pickWeightedCategory(preferences);

      logger.info('Selected category based on preferences', {
        email,
        category,
        preferences,
      });

      return this.getUnseen(email, category);
    } catch (error) {
      logger.error('Error in getPersonalized', { error, email });
      return this.getUnseen(email); // Fallback to random
    }
  }

  /**
   * Pick a category based on weighted probabilities
   */
  private pickWeightedCategory(prefs: CategoryPreferences): WisdomCategory {
    const categories: { name: WisdomCategory; weight: number }[] = [
      { name: 'self_development', weight: prefs.self_development },
      { name: 'fitness', weight: prefs.fitness },
      { name: 'cooking', weight: prefs.cooking },
      { name: 'productivity', weight: prefs.productivity },
      { name: 'life_advice', weight: prefs.life_advice },
    ];

    // Add some randomness (20% chance of random discovery)
    if (Math.random() < 0.2) {
      const randomIndex = Math.floor(Math.random() * categories.length);
      return categories[randomIndex].name;
    }

    // Weighted random selection
    const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;

    for (const cat of categories) {
      random -= cat.weight;
      if (random <= 0) {
        return cat.name;
      }
    }

    return categories[0].name; // Fallback
  }

  /**
   * Record that content was shown to user (for no-repeat logic)
   */
  async recordShown(email: string, contentId: string): Promise<void> {
    try {
      await this.supabase.from('user_content_history').upsert(
        {
          user_email: email,
          content_id: contentId,
          content_type: 'wisdom',
          shown_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_email,content_id',
        }
      );

      // Update times_shown counter
      await this.supabase.rpc('increment_wisdom_shown', {
        wisdom_id: contentId,
      });
    } catch (error) {
      logger.error('Error recording shown content', { error, email, contentId });
    }
  }

  /**
   * Get wisdom by ID
   */
  async getById(id: string): Promise<WisdomEntry | null> {
    const { data, error } = await this.supabase
      .from('wisdom_library')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Error fetching wisdom by ID', { error, id });
      return null;
    }

    return data as WisdomEntry;
  }

  /**
   * Get multiple random wisdom entries for a digest
   */
  async getDigestContent(
    email: string,
    count: number = 2
  ): Promise<WisdomEntry[]> {
    const entries: WisdomEntry[] = [];
    const usedCategories = new Set<WisdomCategory>();

    for (let i = 0; i < count; i++) {
      // Try to get variety in categories
      let entry: WisdomEntry | null = null;

      if (i === 0) {
        // First entry: personalized based on preferences
        entry = await this.getPersonalized(email);
      } else {
        // Subsequent entries: try different category
        const categories: WisdomCategory[] = [
          'self_development',
          'fitness',
          'cooking',
          'productivity',
          'life_advice',
        ];
        const availableCategories = categories.filter(
          (c) => !usedCategories.has(c)
        );

        if (availableCategories.length > 0) {
          const randomCat =
            availableCategories[
              Math.floor(Math.random() * availableCategories.length)
            ];
          entry = await this.getUnseen(email, randomCat);
        }

        // Fallback to any unseen
        if (!entry) {
          entry = await this.getUnseen(email);
        }
      }

      if (entry) {
        entries.push(entry);
        usedCategories.add(entry.category);
      }
    }

    return entries;
  }

  /**
   * Add new wisdom entries to the library
   */
  async addEntries(entries: WisdomCreateInput[]): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('wisdom_library')
        .insert(
          entries.map((e) => ({
            category: e.category,
            subcategory: e.subcategory,
            source: e.source,
            source_type: e.source_type || 'book',
            title: e.title,
            content: e.content,
            actionable_tip: e.actionable_tip,
            tags: e.tags || [],
            difficulty: e.difficulty || 'beginner',
          }))
        )
        .select('id');

      if (error) {
        logger.error('Error adding wisdom entries', { error });
        return 0;
      }

      logger.info('Added wisdom entries', { count: data?.length || 0 });
      return data?.length || 0;
    } catch (error) {
      logger.error('Error in addEntries', { error });
      return 0;
    }
  }

  /**
   * Get library statistics
   */
  async getStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    avgEngagement: number;
  }> {
    const { data: entries } = await this.supabase
      .from('wisdom_library')
      .select('category, avg_engagement')
      .eq('is_active', true);

    if (!entries) {
      return { total: 0, byCategory: {}, avgEngagement: 0 };
    }

    const byCategory: Record<string, number> = {};
    let totalEngagement = 0;

    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      totalEngagement += entry.avg_engagement || 0;
    }

    return {
      total: entries.length,
      byCategory,
      avgEngagement: entries.length > 0 ? totalEngagement / entries.length : 0,
    };
  }

  /**
   * Search wisdom by keyword
   */
  async search(query: string, limit: number = 10): Promise<WisdomEntry[]> {
    const { data, error } = await this.supabase
      .from('wisdom_library')
      .select('*')
      .eq('is_active', true)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,source.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      logger.error('Error searching wisdom', { error, query });
      return [];
    }

    return (data || []) as WisdomEntry[];
  }

  /**
   * Get content by category
   */
  async getByCategory(
    category: WisdomCategory,
    limit: number = 20
  ): Promise<WisdomEntry[]> {
    const { data, error } = await this.supabase
      .from('wisdom_library')
      .select('*')
      .eq('is_active', true)
      .eq('category', category)
      .order('avg_engagement', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching by category', { error, category });
      return [];
    }

    return (data || []) as WisdomEntry[];
  }

  /**
   * Update engagement stats for a wisdom entry
   */
  async updateEngagementStats(
    id: string,
    signal: 'like' | 'share' | 'save' | 'dismiss'
  ): Promise<void> {
    try {
      const column =
        signal === 'like'
          ? 'total_likes'
          : signal === 'share'
          ? 'total_shares'
          : signal === 'save'
          ? 'total_saves'
          : null;

      if (column) {
        await this.supabase.rpc('increment_wisdom_engagement', {
          wisdom_id: id,
          engagement_column: column,
        });
      }

      // Recalculate average engagement
      await this.recalculateEngagement(id);
    } catch (error) {
      logger.error('Error updating engagement stats', { error, id, signal });
    }
  }

  /**
   * Recalculate average engagement for a wisdom entry
   */
  private async recalculateEngagement(id: string): Promise<void> {
    const { data } = await this.supabase
      .from('wisdom_library')
      .select('times_shown, total_likes, total_shares, total_saves')
      .eq('id', id)
      .single();

    if (!data || data.times_shown === 0) return;

    // Weighted engagement score
    const engagement =
      (data.total_likes * 3 +
        data.total_shares * 10 +
        data.total_saves * 5) /
      data.times_shown;

    await this.supabase
      .from('wisdom_library')
      .update({ avg_engagement: engagement })
      .eq('id', id);
  }
}

// Export singleton instance
export const WisdomLibraryService = new WisdomLibraryServiceClass();

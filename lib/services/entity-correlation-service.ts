/**
 * Entity Correlation Service
 *
 * Links the same entities (people, projects, tasks) across different platforms.
 * Uses email matching for people, fuzzy string matching for projects/tasks.
 */

import { createAdminClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface EntitySource {
  source: 'gmail' | 'slack' | 'outlook' | 'teams' | 'notion' | 'linear';
  id: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityReference {
  id?: string;
  userEmail: string;
  entityType: 'person' | 'project' | 'task';
  canonicalName: string;
  sources: EntitySource[];
  confidence: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonInput {
  source: EntitySource['source'];
  id: string;
  name?: string;
  email?: string;
}

export interface ProjectInput {
  source: EntitySource['source'];
  id: string;
  name: string;
}

// ============================================================================
// PERSON CORRELATION
// ============================================================================

/**
 * Normalize and link a person across platforms
 * Primary matching: email
 * Secondary matching: name similarity
 */
export async function correlatePersonAcrossPlatforms(
  userEmail: string,
  person: PersonInput
): Promise<EntityReference | null> {
  const supabase = createAdminClient();

  // First, try to find an existing reference by email
  if (person.email) {
    const { data: existingByEmail } = await supabase
      .from('entity_references')
      .select('*')
      .eq('user_email', userEmail)
      .eq('entity_type', 'person')
      .contains('sources', JSON.stringify([{ email: person.email }]))
      .single();

    if (existingByEmail) {
      // Update with new source if needed
      const sources = existingByEmail.sources as EntitySource[];
      const hasSource = sources.some(s => s.source === person.source && s.id === person.id);

      if (!hasSource) {
        sources.push({
          source: person.source,
          id: person.id,
          name: person.name,
          email: person.email,
        });

        await supabase
          .from('entity_references')
          .update({
            sources,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByEmail.id);
      }

      return {
        id: existingByEmail.id,
        userEmail: existingByEmail.user_email,
        entityType: 'person',
        canonicalName: existingByEmail.canonical_name,
        sources,
        confidence: existingByEmail.confidence,
      };
    }
  }

  // Try to find by name similarity
  if (person.name) {
    const normalizedName = normalizeName(person.name);

    const { data: existingRefs } = await supabase
      .from('entity_references')
      .select('*')
      .eq('user_email', userEmail)
      .eq('entity_type', 'person');

    if (existingRefs) {
      for (const ref of existingRefs) {
        const refNormalizedName = normalizeName(ref.canonical_name);
        const similarity = calculateNameSimilarity(normalizedName, refNormalizedName);

        if (similarity > 0.85) {
          // High confidence name match
          const sources = ref.sources as EntitySource[];
          const hasSource = sources.some(s => s.source === person.source && s.id === person.id);

          if (!hasSource) {
            sources.push({
              source: person.source,
              id: person.id,
              name: person.name,
              email: person.email,
            });

            // Update confidence based on email match
            const newConfidence = person.email ? 0.95 : Math.max(ref.confidence, similarity);

            await supabase
              .from('entity_references')
              .update({
                sources,
                confidence: newConfidence,
                updated_at: new Date().toISOString(),
              })
              .eq('id', ref.id);
          }

          return {
            id: ref.id,
            userEmail: ref.user_email,
            entityType: 'person',
            canonicalName: ref.canonical_name,
            sources,
            confidence: ref.confidence,
          };
        }
      }
    }
  }

  // Create new reference
  const canonicalName = person.name || person.email || person.id;
  const sources: EntitySource[] = [{
    source: person.source,
    id: person.id,
    name: person.name,
    email: person.email,
  }];

  const { data: newRef, error } = await supabase
    .from('entity_references')
    .insert({
      user_email: userEmail,
      entity_type: 'person',
      canonical_name: canonicalName,
      sources,
      confidence: person.email ? 1.0 : 0.8, // Higher confidence if we have email
    })
    .select()
    .single();

  if (error) {
    console.error('[Entity Correlation] Error creating person reference:', error);
    return null;
  }

  return {
    id: newRef.id,
    userEmail: newRef.user_email,
    entityType: 'person',
    canonicalName: newRef.canonical_name,
    sources,
    confidence: newRef.confidence,
  };
}

/**
 * Batch correlate people from multiple platforms
 */
export async function correlateAllPeople(
  userEmail: string,
  people: PersonInput[]
): Promise<Map<string, EntityReference>> {
  const correlations = new Map<string, EntityReference>();

  for (const person of people) {
    const ref = await correlatePersonAcrossPlatforms(userEmail, person);
    if (ref) {
      // Key by source:id for quick lookup
      correlations.set(`${person.source}:${person.id}`, ref);
    }
  }

  return correlations;
}

// ============================================================================
// PROJECT CORRELATION
// ============================================================================

/**
 * Normalize and link a project across platforms
 * Uses fuzzy string matching on project names
 */
export async function correlateProjectAcrossPlatforms(
  userEmail: string,
  project: ProjectInput
): Promise<EntityReference | null> {
  const supabase = createAdminClient();
  const normalizedName = normalizeProjectName(project.name);

  // Find existing project references
  const { data: existingRefs } = await supabase
    .from('entity_references')
    .select('*')
    .eq('user_email', userEmail)
    .eq('entity_type', 'project');

  if (existingRefs) {
    for (const ref of existingRefs) {
      const refNormalizedName = normalizeProjectName(ref.canonical_name);
      const similarity = calculateProjectSimilarity(normalizedName, refNormalizedName);

      if (similarity > 0.75) {
        // Good match
        const sources = ref.sources as EntitySource[];
        const hasSource = sources.some(s => s.source === project.source && s.id === project.id);

        if (!hasSource) {
          sources.push({
            source: project.source,
            id: project.id,
            name: project.name,
          });

          await supabase
            .from('entity_references')
            .update({
              sources,
              confidence: Math.max(ref.confidence, similarity),
              updated_at: new Date().toISOString(),
            })
            .eq('id', ref.id);
        }

        return {
          id: ref.id,
          userEmail: ref.user_email,
          entityType: 'project',
          canonicalName: ref.canonical_name,
          sources,
          confidence: ref.confidence,
        };
      }
    }
  }

  // Create new reference
  const sources: EntitySource[] = [{
    source: project.source,
    id: project.id,
    name: project.name,
  }];

  const { data: newRef, error } = await supabase
    .from('entity_references')
    .insert({
      user_email: userEmail,
      entity_type: 'project',
      canonical_name: project.name,
      sources,
      confidence: 0.9,
    })
    .select()
    .single();

  if (error) {
    console.error('[Entity Correlation] Error creating project reference:', error);
    return null;
  }

  return {
    id: newRef.id,
    userEmail: newRef.user_email,
    entityType: 'project',
    canonicalName: newRef.canonical_name,
    sources,
    confidence: newRef.confidence,
  };
}

// ============================================================================
// RETRIEVAL FUNCTIONS
// ============================================================================

/**
 * Get all entity references for a user
 */
export async function getEntityReferences(
  userEmail: string,
  entityType?: 'person' | 'project' | 'task'
): Promise<EntityReference[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('entity_references')
    .select('*')
    .eq('user_email', userEmail);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(row => ({
    id: row.id,
    userEmail: row.user_email,
    entityType: row.entity_type,
    canonicalName: row.canonical_name,
    sources: row.sources,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Find entity by platform-specific ID
 */
export async function findEntityBySourceId(
  userEmail: string,
  source: EntitySource['source'],
  sourceId: string
): Promise<EntityReference | null> {
  const supabase = createAdminClient();

  // Search in JSON sources array
  const { data, error } = await supabase
    .from('entity_references')
    .select('*')
    .eq('user_email', userEmail)
    .contains('sources', JSON.stringify([{ source, id: sourceId }]))
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userEmail: data.user_email,
    entityType: data.entity_type,
    canonicalName: data.canonical_name,
    sources: data.sources,
    confidence: data.confidence,
  };
}

/**
 * Get unified contact list with cross-platform presence
 */
export async function getUnifiedContacts(
  userEmail: string
): Promise<Array<{
  canonicalName: string;
  platforms: string[];
  emails: string[];
  communicationCount: number;
}>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('entity_references')
    .select('*')
    .eq('user_email', userEmail)
    .eq('entity_type', 'person')
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(row => {
    const sources = row.sources as EntitySource[];
    const platforms = [...new Set(sources.map(s => s.source))];
    const emails = sources
      .map(s => s.email)
      .filter((e): e is string => !!e);

    return {
      canonicalName: row.canonical_name,
      platforms,
      emails: [...new Set(emails)],
      communicationCount: sources.length,
    };
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateNameSimilarity(name1: string, name2: string): number {
  // Simple Jaccard similarity on words
  const words1 = new Set(name1.split(' '));
  const words2 = new Set(name2.split(' '));

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  if (union === 0) return 0;
  return intersection / union;
}

function calculateProjectSimilarity(name1: string, name2: string): number {
  // Use Levenshtein-based similarity for project names
  const words1 = name1.split(' ');
  const words2 = name2.split(' ');

  // Check for word containment
  const containedWords = words1.filter(w =>
    words2.some(w2 => w2.includes(w) || w.includes(w2))
  ).length;

  const wordSimilarity = containedWords / Math.max(words1.length, words2.length);

  // Also check character-level similarity
  const charSimilarity = 1 - levenshteinDistance(name1, name2) / Math.max(name1.length, name2.length);

  return (wordSimilarity + charSimilarity) / 2;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

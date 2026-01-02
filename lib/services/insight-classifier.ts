/**
 * Insight Classifier Service
 *
 * Assigns design categories to AI-generated insights AFTER generation.
 * Uses content analysis (keywords, patterns, sentiment) to classify.
 *
 * Design Categories:
 * - PREDICTION: Future-focused insights about upcoming opportunities
 * - OPTIMIZATION: Small changes that unlock better performance
 * - ANALYSIS: Patterns that empower better choices
 * - IKIGAI: Connection between health and meaning/purpose
 * - SOCIAL: Power of connection for health
 */

export type DesignCategory = 'PREDICTION' | 'OPTIMIZATION' | 'ANALYSIS' | 'IKIGAI' | 'SOCIAL';

export interface UnclassifiedInsight {
  title: string;
  finding: string;
  dataCited: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  actionableRecommendation: string;
  sources: string[];
  confidence?: number;
}

export interface ClassifiedInsight extends UnclassifiedInsight {
  designCategory: DesignCategory;
  classificationConfidence: number;
  classificationReason: string;
}

// Classification patterns for each category
const CLASSIFICATION_PATTERNS: Record<DesignCategory, {
  titlePatterns: RegExp[];
  findingPatterns: RegExp[];
  keywords: string[];
}> = {
  PREDICTION: {
    titlePatterns: [
      /tomorrow/i,
      /upcoming/i,
      /predicted/i,
      /will\s+(be|have|see|feel)/i,
      /expect/i,
      /forecast/i,
      /next\s+(day|week|morning|afternoon)/i,
      /opens?\s+at/i,
      /coming\s+(up|soon)/i,
      /trending\s+toward/i,
      /preparing\s+for/i,
      /anticipate/i,
    ],
    findingPatterns: [
      /based on.*pattern/i,
      /likely to/i,
      /probability/i,
      /historical data suggests/i,
      /trend indicates/i,
      /predicting/i,
      /expect.*to\s+(see|feel|experience)/i,
    ],
    keywords: ['predict', 'forecast', 'expect', 'tomorrow', 'upcoming', 'future', 'trend', 'anticipate', 'next'],
  },
  OPTIMIZATION: {
    titlePatterns: [
      /could\s+(be|transform|improve|boost)/i,
      /try\s+/i,
      /consider/i,
      /secret\s+to/i,
      /unlock/i,
      /optimize/i,
      /boost/i,
      /small\s+change/i,
      /quick\s+win/i,
      /simple\s+tweak/i,
      /adding\s+/i,
      /shifting\s+/i,
    ],
    findingPatterns: [
      /intervention/i,
      /could improve/i,
      /optimize/i,
      /increasing.*by/i,
      /reducing.*could/i,
      /try\s+(adding|shifting|moving)/i,
      /small\s+adjustment/i,
    ],
    keywords: ['optimize', 'improve', 'boost', 'transform', 'enhance', 'try', 'consider', 'tweak', 'adjust', 'change'],
  },
  ANALYSIS: {
    titlePatterns: [
      /your\s+(body|data|pattern|sleep|glucose)/i,
      /reveals?/i,
      /shows?/i,
      /asking\s+for/i,
      /key\s+to/i,
      /correlation/i,
      /linked?\s+to/i,
      /connected/i,
      /holds\s+the/i,
      /tells\s+us/i,
    ],
    findingPatterns: [
      /analysis\s+(shows|reveals)/i,
      /data\s+indicates/i,
      /correlation\s+between/i,
      /pattern\s+detected/i,
      /we\s+(see|observe|notice)/i,
      /looking at/i,
    ],
    keywords: ['analysis', 'pattern', 'correlation', 'reveals', 'shows', 'indicates', 'linked', 'connected', 'data'],
  },
  IKIGAI: {
    titlePatterns: [
      /purpose/i,
      /meaning/i,
      /why\s+you/i,
      /drives?\s+you/i,
      /best\s+(ideas|work|self|thinking)/i,
      /flow\s+state/i,
      /peak\s+performance/i,
      /within\s+reach/i,
      /potential/i,
      /creativity/i,
      /sharper/i,
      /clearer/i,
    ],
    findingPatterns: [
      /purpose|meaning|fulfillment/i,
      /peak\s+performance/i,
      /cognitive\s+enhancement/i,
      /creative/i,
      /mental\s+clarity/i,
      /optimal\s+(thinking|focus|state)/i,
    ],
    keywords: ['purpose', 'meaning', 'flow', 'peak', 'potential', 'creativity', 'fulfillment', 'clarity', 'thinking', 'ideas'],
  },
  SOCIAL: {
    titlePatterns: [
      /together/i,
      /social/i,
      /community/i,
      /friends?/i,
      /connection/i,
      /accountability/i,
      /partner/i,
      /workout\s+buddy/i,
      /shared/i,
      /group/i,
      /team/i,
    ],
    findingPatterns: [
      /social\s+(support|connection)/i,
      /accountability/i,
      /group\s+(exercise|activity)/i,
      /relationships?/i,
      /working\s+with\s+others/i,
      /community/i,
    ],
    keywords: ['together', 'social', 'community', 'friends', 'connection', 'partner', 'shared', 'group', 'team', 'accountability'],
  },
};

interface ClassificationScore {
  category: DesignCategory;
  score: number;
  matches: string[];
}

/**
 * Score an insight against classification patterns for a specific category
 */
function scoreInsightForCategory(
  insight: UnclassifiedInsight,
  category: DesignCategory
): ClassificationScore {
  const patterns = CLASSIFICATION_PATTERNS[category];
  const matches: string[] = [];
  let score = 0;

  // Check title patterns (weight: 3)
  for (const pattern of patterns.titlePatterns) {
    if (pattern.test(insight.title)) {
      score += 3;
      matches.push(`title: ${pattern.source.slice(0, 20)}`);
    }
  }

  // Check finding patterns (weight: 2)
  for (const pattern of patterns.findingPatterns) {
    if (pattern.test(insight.finding)) {
      score += 2;
      matches.push(`finding: ${pattern.source.slice(0, 20)}`);
    }
  }

  // Check keywords in combined text (weight: 1)
  const combinedText = `${insight.title} ${insight.finding} ${insight.actionableRecommendation}`.toLowerCase();
  for (const keyword of patterns.keywords) {
    if (combinedText.includes(keyword)) {
      score += 1;
      matches.push(`keyword: ${keyword}`);
    }
  }

  return { category, score, matches };
}

/**
 * Classify a single insight into a design category
 */
export function classifyInsight(insight: UnclassifiedInsight): ClassifiedInsight {
  const categories: DesignCategory[] = ['PREDICTION', 'OPTIMIZATION', 'ANALYSIS', 'IKIGAI', 'SOCIAL'];

  const scores = categories.map(category => scoreInsightForCategory(insight, category));
  scores.sort((a, b) => b.score - a.score);

  const topScore = scores[0];
  const secondScore = scores[1];

  // Calculate confidence based on score difference
  const confidence = topScore.score > 0
    ? Math.min(0.95, 0.5 + (topScore.score - secondScore.score) * 0.1)
    : 0.3;

  // Default to ANALYSIS if no strong signal (it's the most generic category)
  const selectedCategory = topScore.score >= 2 ? topScore.category : 'ANALYSIS';

  return {
    ...insight,
    designCategory: selectedCategory,
    classificationConfidence: Math.round(confidence * 100) / 100,
    classificationReason: topScore.matches.length > 0
      ? `Matched: ${topScore.matches.slice(0, 3).join(', ')}`
      : 'Default classification (no strong patterns)',
  };
}

/**
 * Classify multiple insights, ensuring variety in categories when possible
 */
export function classifyInsights(insights: UnclassifiedInsight[]): ClassifiedInsight[] {
  if (insights.length === 0) return [];

  // First pass: classify each independently
  const classified = insights.map(insight => classifyInsight(insight));

  // Second pass: ensure variety if there are duplicates and alternatives exist
  const categoryCount = new Map<DesignCategory, number>();
  const categories: DesignCategory[] = ['PREDICTION', 'OPTIMIZATION', 'ANALYSIS', 'IKIGAI', 'SOCIAL'];

  // Count initial distribution
  for (const insight of classified) {
    categoryCount.set(insight.designCategory, (categoryCount.get(insight.designCategory) || 0) + 1);
  }

  // If we have duplicates and enough insights, try to diversify
  if (classified.length >= 3) {
    for (let i = 0; i < classified.length; i++) {
      const current = classified[i];
      const count = categoryCount.get(current.designCategory) || 0;

      // Only reassign if: we have duplicates AND confidence is not super high
      if (count > 1 && current.classificationConfidence < 0.7) {
        // Score for all categories
        const scores = categories.map(cat => ({
          category: cat,
          ...scoreInsightForCategory(insights[i], cat),
          currentCount: categoryCount.get(cat) || 0,
        }));

        // Sort by score, but penalize already-used categories
        scores.sort((a, b) => {
          const aAdjusted = a.score - (a.currentCount * 2);
          const bAdjusted = b.score - (b.currentCount * 2);
          return bAdjusted - aAdjusted;
        });

        // Find an alternative that's not overused and has some signal
        const alternative = scores.find(s => s.category !== current.designCategory && s.score >= 1);
        if (alternative) {
          // Update counts
          categoryCount.set(current.designCategory, count - 1);
          categoryCount.set(alternative.category, (categoryCount.get(alternative.category) || 0) + 1);

          // Update the insight
          classified[i] = {
            ...current,
            designCategory: alternative.category,
            classificationConfidence: Math.min(current.classificationConfidence, 0.6),
            classificationReason: `Diversified from ${current.designCategory}: ${alternative.matches.slice(0, 2).join(', ')}`,
          };
        }
      }
    }
  }

  console.log(`[INSIGHT-CLASSIFIER] Classified ${classified.length} insights:`,
    classified.map(i => `${i.designCategory} (${i.classificationConfidence})`).join(', '));

  return classified;
}

/**
 * Get classification statistics for debugging
 */
export function getClassificationStats(insights: ClassifiedInsight[]): Record<string, number> {
  const stats: Record<string, number> = {
    PREDICTION: 0,
    OPTIMIZATION: 0,
    ANALYSIS: 0,
    IKIGAI: 0,
    SOCIAL: 0,
    avgConfidence: 0,
  };

  if (insights.length === 0) return stats;

  let totalConfidence = 0;
  for (const insight of insights) {
    stats[insight.designCategory]++;
    totalConfidence += insight.classificationConfidence;
  }
  stats.avgConfidence = Math.round((totalConfidence / insights.length) * 100) / 100;

  return stats;
}

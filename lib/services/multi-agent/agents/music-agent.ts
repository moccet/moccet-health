/**
 * MusicAgent - Analyzes Spotify listening patterns, mood indicators, and music habits
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'music_agent',
  agentName: 'MusicAgent',
  domain: 'MUSIC',
  requiredDataSources: ['spotify'],
  optionalDataSources: [],
  insightCategory: 'LIFESTYLE',
};

export class MusicAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.spotify) {
      data.spotify = {
        topGenres: context.spotify.topGenres,
        listeningPatterns: context.spotify.listeningPatterns,
        moodIndicators: context.spotify.moodIndicators,
        recentTracks: context.spotify.recentTracks?.slice(0, 10), // Last 10 tracks
      };
    }

    data.sources = {
      spotify: context.availableDataSources.includes('spotify'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a MUSIC & MOOD SPECIALIST analyzing listening patterns and their connection to wellbeing.

YOUR EXPERTISE:
- Music listening patterns and circadian alignment
- Mood indicators from music choices (energy, valence)
- Late-night listening and sleep impact
- Music for focus, exercise, and relaxation
- Emotional state indicators from genre choices
- Music as a tool for mood regulation

AVAILABLE DATA:
${JSON.stringify(relevantData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Analyze listening time patterns (morning vs evening vs late night)
2. Evaluate mood indicators (energy and valence scores)
3. Identify potential sleep impacts from late-night listening
4. Look for patterns that correlate with stress or relaxation
5. Consider genre diversity and emotional range
6. Recommend music-based interventions for mood and focus

KEY INSIGHTS TO PROVIDE:
- High-energy music late at night may delay sleep onset
- Low valence (sad) music patterns may indicate mood concerns
- Music can be strategically used for focus (lo-fi, classical) or energy (uptempo)
- Consistent listening times suggest routine; erratic patterns may indicate stress

Generate 1-2 high-quality insights connecting music patterns to wellbeing and actionable recommendations.`;
  }
}

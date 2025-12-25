/**
 * Agent Prompts
 * System prompts for the Health Agent
 */

export const HEALTH_AGENT_SYSTEM_PROMPT = `You are an autonomous Health Agent helping users optimize their health and wellness. You have access to various tools to analyze health data, manage calendars, create playlists, recommend supplements, and book appointments.

## CRITICAL: Voice-First Conversational Style

You are speaking to the user through voice. Your responses will be read aloud by text-to-speech. This means:

1. **BE CONCISE** - Keep responses to 1-2 short sentences unless the user explicitly asks for details or an explanation
2. **Be natural** - Speak like a helpful friend, not a formal assistant
3. **No walls of text** - Never output long paragraphs. If you need to explain something complex, break it into a back-and-forth conversation
4. **Ask follow-ups** - Instead of dumping all info at once, give a brief answer and offer to elaborate

**Examples of good conversational responses:**
- User: "How's my sleep?" → "Your sleep's been solid - averaging 7.5 hours with good deep sleep. Want me to break down the trends?"
- User: "What should I do about my low vitamin D?" → "I'd suggest a D3 supplement, around 2000 IU daily. Want me to find some good options?"
- User: "Schedule a checkup" → "Got it. What day works best for you?"

**BAD responses (too long):**
- "Based on your comprehensive health data analysis, I've identified several key areas for improvement including your sleep patterns which show..."

## Your Capabilities
You can:
1. **Analyze health data** - Blood biomarkers, sleep (Oura), glucose (Dexcom), activity
2. **Manage calendars** - Find slots, create/update/delete Google Calendar events
3. **Create playlists** - Spotify for focus, relaxation, workouts
4. **Recommend supplements** - Based on deficiencies
5. **Shop for products** - Search and purchase health products
6. **Book appointments** - Find providers, check insurance, book

## How to Think and Act

Use the ReAct pattern internally, but keep your spoken responses brief:

1. **REASON** internally about what the user needs
2. **ACT** by calling the appropriate tool
3. **OBSERVE** the result
4. **RESPOND** with a concise, natural answer

## Risk Awareness

- **LOW RISK** (auto-execute): Reading data, searching, creating playlists
- **MEDIUM RISK** (needs approval): Creating calendar events, adding to cart
- **HIGH RISK** (needs explicit approval): Purchases, booking appointments

## Important Guidelines

1. **Short responses** - 1-2 sentences is ideal. Only go longer if explicitly asked
2. **Natural speech** - Use contractions, casual tone
3. **One thing at a time** - Don't overwhelm with information
4. **Offer to elaborate** - "Want more details?" instead of giving them upfront
5. **Be efficient** - Get to the point quickly

Remember: You're speaking through voice. Keep it conversational and concise.`;

export const TASK_COMPLETION_CHECK_PROMPT = `Based on the conversation so far, determine if the task has been completed.

A task is COMPLETE when:
- The user's original goal has been achieved
- All necessary actions have been taken
- The user has been informed of the results

A task is NOT COMPLETE when:
- More information is needed
- Actions are pending user approval
- There are follow-up steps to take

Respond with either:
- "COMPLETE" if the task is done
- "CONTINUE" if more actions are needed
- "WAITING" if waiting for user input/approval`;

export const ERROR_RECOVERY_PROMPT = `The previous tool call failed. Analyze the error and determine the best course of action:

1. **Retry** - If it was a transient error, try again
2. **Alternative** - If there's another way to achieve the goal, try that
3. **Inform User** - If the error can't be recovered, explain the situation clearly

Always maintain a helpful tone and suggest what the user can do to resolve the issue.`;

export function buildUserPrompt(
  task: string,
  context: any,
  previousSteps: any[],
  toolResults: any[]
): string {
  let prompt = `## Current Task
${task}

## User Context
${JSON.stringify(context, null, 2)}
`;

  if (previousSteps.length > 0) {
    prompt += `
## Previous Reasoning Steps
${previousSteps.map((step, i) => `${i + 1}. ${step.thought}`).join('\n')}
`;
  }

  if (toolResults.length > 0) {
    prompt += `
## Tool Results So Far
${toolResults.map((result) => `- ${result.tool}: ${result.success ? 'Success' : 'Failed'} - ${JSON.stringify(result.data || result.error).substring(0, 500)}`).join('\n')}
`;
  }

  prompt += `
## Your Turn
Think about what to do next. If you need to use a tool, specify which one and with what parameters. If the task is complete, summarize what was accomplished.`;

  return prompt;
}

// =============================================================================
// MEMORY-AWARE PROMPTS
// =============================================================================

export interface MemoryContext {
  facts: Array<{
    category: string;
    fact_key: string;
    fact_value: string;
    confidence: number;
  }>;
  style: {
    verbosity: string;
    tone: string;
    prefers_lists: boolean;
    prefers_explanations: boolean;
  } | null;
  outcomes: Array<{
    advice_type: string;
    advice_given: string;
    outcome: string;
    metric_name: string;
    baseline_value: number | null;
    current_value: number | null;
  }>;
  preferences: Array<{
    action_type: string;
    approval_rate: number;
    learned_preference: string | null;
  }>;
  recentSummary: string | null;
  recentConversations: Array<{
    topic: string;
    summary: string;
    date: string;
  }>;
}

/**
 * Build a memory-aware system prompt that personalizes the agent's responses
 */
export function buildMemoryAwarePrompt(memory: MemoryContext): string {
  const sections: string[] = [];

  sections.push('## User Memory & Personalization\n');

  // Add learned facts
  if (memory.facts && memory.facts.length > 0) {
    sections.push('### Learned Facts About This User');
    const factsByCategory: Record<string, string[]> = {};

    for (const fact of memory.facts) {
      if (!factsByCategory[fact.category]) {
        factsByCategory[fact.category] = [];
      }
      factsByCategory[fact.category].push(
        `${fact.fact_key}: ${fact.fact_value} (${Math.round(fact.confidence * 100)}% confident)`
      );
    }

    for (const [category, facts] of Object.entries(factsByCategory)) {
      sections.push(`\n**${category.charAt(0).toUpperCase() + category.slice(1)}**:`);
      facts.forEach((f) => sections.push(`- ${f}`));
    }
    sections.push('');
  }

  // Add communication style preferences
  if (memory.style) {
    sections.push('### Communication Preferences');
    sections.push(`- **Verbosity**: ${memory.style.verbosity} (adjust your response length accordingly)`);
    sections.push(`- **Tone**: ${memory.style.tone}`);
    sections.push(`- **Prefers lists**: ${memory.style.prefers_lists ? 'Yes - use bullet points when possible' : 'No - use prose'}`);
    sections.push(`- **Prefers explanations**: ${memory.style.prefers_explanations ? 'Yes - include reasoning' : 'No - be concise'}`);
    sections.push('');
  }

  // Add past advice outcomes
  if (memory.outcomes && memory.outcomes.length > 0) {
    sections.push('### Past Advice Outcomes');
    sections.push('Use this to inform recommendations - repeat what worked, avoid what didn\'t:');

    for (const outcome of memory.outcomes.slice(0, 5)) {
      const icon = outcome.outcome === 'improved' ? '✓' : outcome.outcome === 'worsened' ? '✗' : '~';
      const change = outcome.baseline_value && outcome.current_value
        ? ` (${outcome.metric_name}: ${outcome.baseline_value} → ${outcome.current_value})`
        : '';
      sections.push(`- ${icon} "${outcome.advice_given?.substring(0, 100)}..." → ${outcome.outcome}${change}`);
    }
    sections.push('');
  }

  // Add action preferences
  if (memory.preferences && memory.preferences.length > 0) {
    sections.push('### Action Preferences');
    sections.push('Based on past approvals/rejections:');

    for (const pref of memory.preferences) {
      const tendency = pref.approval_rate > 70 ? 'Usually approves' : pref.approval_rate < 30 ? 'Usually rejects' : 'Mixed';
      sections.push(`- **${pref.action_type}**: ${tendency} (${Math.round(pref.approval_rate)}%)`);
      if (pref.learned_preference) {
        sections.push(`  → Learned: "${pref.learned_preference}"`);
      }
    }
    sections.push('');
  }

  // Add recent conversation context
  if (memory.recentConversations && memory.recentConversations.length > 0) {
    sections.push('### Recent Conversation Context');
    sections.push('Previous topics discussed:');

    for (const conv of memory.recentConversations.slice(0, 3)) {
      sections.push(`- **${conv.topic}** (${conv.date}): ${conv.summary?.substring(0, 100)}...`);
    }
    sections.push('');
  }

  // Add recent summary if available
  if (memory.recentSummary) {
    sections.push('### Weekly Summary');
    sections.push(memory.recentSummary);
    sections.push('');
  }

  // Add instructions for using memory
  sections.push('### How to Use This Memory');
  sections.push(`
- **Match their style**: If they prefer brief responses, be concise. If detailed, explain more.
- **Reference past success**: If similar advice worked before, mention it.
- **Avoid past failures**: If something didn't work, acknowledge it and try something different.
- **Respect preferences**: Don't suggest actions they typically reject.
- **Build on context**: Reference previous conversations when relevant.
- **Learn continuously**: Notice new preferences or facts and mention them naturally.
`);

  return sections.join('\n');
}

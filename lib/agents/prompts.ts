/**
 * Agent Prompts
 * System prompts for the Health Agent
 */

export const HEALTH_AGENT_SYSTEM_PROMPT = `You are an autonomous Health Agent helping users optimize their health and wellness. You have access to various tools to analyze health data, manage calendars, create playlists, recommend supplements, and book appointments.

## Your Capabilities
You can:
1. **Analyze health data** - Access blood biomarkers, sleep data (Oura), glucose data (Dexcom), activity metrics
2. **Manage calendars** - Find available slots, create/update/delete events in Google Calendar
3. **Create music experiences** - Create Spotify playlists for focus, relaxation, workouts
4. **Recommend supplements** - Analyze deficiencies and suggest appropriate supplements
5. **Shop for products** - Search health products, add to cart, complete purchases
6. **Book appointments** - Find healthcare providers, check insurance, book/cancel appointments

## How to Think and Act

Use the ReAct (Reason, Act, Observe) pattern:

1. **REASON**: Think step-by-step about what the user needs
   - What is the user's goal?
   - What information do I need?
   - What's the best approach?

2. **ACT**: Call a tool to gather information or take action
   - Choose the most appropriate tool
   - Provide accurate parameters

3. **OBSERVE**: Evaluate the tool result
   - Did it succeed?
   - What did I learn?
   - What should I do next?

4. **REPEAT** until the task is complete or you need user input

## Risk Awareness

Tools have different risk levels:
- **LOW RISK** (auto-execute): Reading data, searching, creating playlists
- **MEDIUM RISK** (needs approval): Creating calendar events, adding to cart
- **HIGH RISK** (needs explicit approval): Purchases, booking medical appointments

When calling medium/high risk tools, the system will pause for user approval. Structure your reasoning to explain why you're recommending the action.

## Response Format

Always structure your thinking clearly:

**Thinking**: [Your reasoning about the current situation]
**Action**: [The tool you're calling and why]
**Observation**: [What you learned from the tool result]

When you've completed the task or need user input:
**Summary**: [Clear summary of what was accomplished]
**Next Steps**: [What the user might want to do next, if applicable]

## Important Guidelines

1. **Be proactive but respectful** - Suggest helpful actions but don't overreach
2. **Explain your reasoning** - Users should understand why you're taking actions
3. **Handle errors gracefully** - If a tool fails, try alternatives or explain the issue
4. **Respect privacy** - Only access data relevant to the current task
5. **Be efficient** - Don't call unnecessary tools or repeat actions
6. **Stay focused** - Complete the current task before moving to new ones

## Examples of Good Behavior

**Good**: "Based on your blood work showing low Vitamin D (15 ng/mL), I recommend supplementation. Let me search for quality D3 supplements..."

**Good**: "I found a great time slot for your checkup. Before I create the calendar event, here's what I'm planning: [details]. Shall I proceed?"

**Bad**: Creating calendar events without explaining what they're for
**Bad**: Purchasing items without explicit user confirmation
**Bad**: Accessing unrelated health data

Remember: You're here to help users take control of their health. Be helpful, be transparent, and always prioritize the user's wellbeing and autonomy.`;

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

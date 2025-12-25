/**
 * Moccet Chef Agent
 *
 * A conversational chef agent specialized in personalized nutrition and recipes.
 * Uses MCP context (labs, biomarkers, dietary preferences) to provide tailored
 * food recommendations and recipes.
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// STATE DEFINITION
// =============================================================================

const ChefStateAnnotation = Annotation.Root({
  // Input
  userEmail: Annotation<string>(),
  message: Annotation<string>(),
  userContext: Annotation<Record<string, any>>(),

  // Conversation
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // Step tracking
  currentStep: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  maxSteps: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 5,
  }),

  // Status
  status: Annotation<'running' | 'completed' | 'failed'>({
    reducer: (_, y) => y,
    default: () => 'running' as const,
  }),
  finalResult: Annotation<{
    success: boolean;
    response: string;
    recipe?: {
      name: string;
      description: string;
      prepTime: string;
      cookTime: string;
      servings: number;
      ingredients: string[];
      instructions: string[];
      nutritionNotes: string;
      healthBenefits: string[];
    };
  } | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
});

type ChefState = typeof ChefStateAnnotation.State;

// =============================================================================
// LLM SETUP
// =============================================================================

const llm = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0.7, // Slightly higher for creative recipes
});

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const CHEF_SYSTEM_PROMPT = `You are Moccet Chef, a personalized nutrition and culinary AI assistant.

## CRITICAL: Voice-First Conversational Style

You are speaking through voice (text-to-speech). Your responses must be natural and conversational.

**For casual food questions** - Keep it SHORT (1-2 sentences):
- "What should I eat?" → "How about a salmon bowl? It's great for your iron levels. Want the recipe?"
- "Any snack ideas?" → "Greek yogurt with berries would be perfect - good protein and antioxidants."
- "Is this meal healthy?" → "Yeah, that looks solid. Good balance of protein and veggies."

**For recipe requests** - You can be more detailed since they asked for it:
- When they say "give me a recipe" or "how do I make...", provide the full recipe
- But still keep it conversational, like you're telling a friend how to cook
- Read it in a way that sounds natural spoken aloud

## Your Expertise
- Creating healthy recipes optimized for their health goals
- Understanding how nutrients affect biomarkers
- Suggesting ingredient substitutions
- Timing meals for energy and recovery

## User Context Available
- Blood biomarkers (iron, vitamin D, B12, etc.)
- Dietary restrictions and allergies
- Health goals
- Activity level

## Recipe Format (ONLY when they ask for a recipe)

Keep it speakable - avoid complex formatting. Something like:

"Alright, here's a quick salmon bowl. You'll need salmon fillet, some rice, avocado, and edamame.

First, cook your rice. While that's going, season the salmon with salt and pepper, then pan-sear it about 4 minutes each side.

Slice up the avocado, warm up some edamame, and build your bowl - rice on the bottom, salmon on top, avocado and edamame on the sides.

This is great for you because the salmon helps with your omega-3s and the edamame adds iron. Takes about 20 minutes total."

## Important Guidelines

1. **Conversational first** - Sound like a friend giving cooking advice
2. **Short for questions** - 1-2 sentences unless they ask for a recipe
3. **Never suggest allergens** - Check their restrictions
4. **Encouraging tone** - Make cooking feel achievable
5. **Offer to elaborate** - "Want the full recipe?" instead of giving it unprompted`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getUserNutritionContext(userEmail: string): Promise<Record<string, any>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user's dietary preferences
  const { data: dietaryPrefs } = await supabase
    .from('user_dietary_preferences')
    .select('*')
    .eq('user_email', userEmail)
    .single();

  // Get latest blood biomarkers
  const { data: biomarkers } = await supabase
    .from('blood_biomarker_analyses')
    .select('analysis_result')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get user profile for health goals
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('health_goals, activity_level')
    .eq('email', userEmail)
    .single();

  return {
    dietaryPreferences: dietaryPrefs || {},
    biomarkers: biomarkers?.analysis_result || {},
    healthGoals: profile?.health_goals || [],
    activityLevel: profile?.activity_level || 'moderate',
  };
}

function buildContextPrompt(context: Record<string, any>): string {
  const parts: string[] = [];

  // Dietary restrictions
  if (context.dietaryPreferences) {
    const prefs = context.dietaryPreferences;
    if (prefs.allergies?.length > 0) {
      parts.push(`**Allergies/Intolerances:** ${prefs.allergies.join(', ')}`);
    }
    if (prefs.diet_type) {
      parts.push(`**Diet Type:** ${prefs.diet_type}`);
    }
    if (prefs.dislikes?.length > 0) {
      parts.push(`**Food Dislikes:** ${prefs.dislikes.join(', ')}`);
    }
  }

  // Biomarkers of nutritional relevance
  if (context.biomarkers) {
    const relevantMarkers: string[] = [];
    const markers = context.biomarkers;

    if (markers.iron && markers.iron.status !== 'normal') {
      relevantMarkers.push(`Iron: ${markers.iron.value} (${markers.iron.status})`);
    }
    if (markers.vitaminD && markers.vitaminD.status !== 'normal') {
      relevantMarkers.push(`Vitamin D: ${markers.vitaminD.value} (${markers.vitaminD.status})`);
    }
    if (markers.b12 && markers.b12.status !== 'normal') {
      relevantMarkers.push(`B12: ${markers.b12.value} (${markers.b12.status})`);
    }
    if (markers.cholesterol && markers.cholesterol.status === 'high') {
      relevantMarkers.push(`Cholesterol: ${markers.cholesterol.value} (elevated)`);
    }
    if (markers.glucose && markers.glucose.status !== 'normal') {
      relevantMarkers.push(`Glucose: ${markers.glucose.value} (${markers.glucose.status})`);
    }

    if (relevantMarkers.length > 0) {
      parts.push(`**Key Biomarkers to Consider:**\n${relevantMarkers.join('\n')}`);
    }
  }

  // Health goals
  if (context.healthGoals?.length > 0) {
    parts.push(`**Health Goals:** ${context.healthGoals.join(', ')}`);
  }

  // Activity level
  if (context.activityLevel) {
    parts.push(`**Activity Level:** ${context.activityLevel}`);
  }

  return parts.length > 0
    ? `\n\n## User's Health Profile\n${parts.join('\n\n')}`
    : '';
}

// =============================================================================
// GRAPH NODES
// =============================================================================

async function chefNode(state: ChefState): Promise<Partial<ChefState>> {
  console.log('[MOCCET-CHEF] Processing message:', state.message.substring(0, 50));

  const contextPrompt = buildContextPrompt(state.userContext);

  const systemMessage = new SystemMessage(CHEF_SYSTEM_PROMPT + contextPrompt);

  const userMessage = new HumanMessage(state.message);

  const messages = [systemMessage, ...state.messages, userMessage];

  try {
    const response = await llm.invoke(messages);
    const responseText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    console.log('[MOCCET-CHEF] Generated response, length:', responseText.length);

    // Check if response contains a recipe (simple heuristic)
    const hasRecipe = responseText.includes('**Ingredients:**') ||
                      responseText.includes('Instructions:');

    return {
      messages: [userMessage, new AIMessage(responseText)],
      currentStep: state.currentStep + 1,
      status: 'completed',
      finalResult: {
        success: true,
        response: responseText,
        recipe: hasRecipe ? {
          name: extractRecipeName(responseText),
          description: 'Personalized recipe based on your health profile',
          prepTime: extractTime(responseText, 'Prep'),
          cookTime: extractTime(responseText, 'Cook'),
          servings: extractServings(responseText),
          ingredients: extractIngredients(responseText),
          instructions: extractInstructions(responseText),
          nutritionNotes: extractNutritionNotes(responseText),
          healthBenefits: extractHealthBenefits(responseText),
        } : undefined,
      },
    };
  } catch (error) {
    console.error('[MOCCET-CHEF] Error:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Simple extraction helpers (can be enhanced with more robust parsing)
function extractRecipeName(text: string): string {
  const match = text.match(/\*\*([^*]+)\*\*/);
  return match ? match[1].trim() : 'Recipe';
}

function extractTime(text: string, type: string): string {
  const pattern = new RegExp(`${type}:\\s*([^|\\n]+)`, 'i');
  const match = text.match(pattern);
  return match ? match[1].trim() : 'Unknown';
}

function extractServings(text: string): number {
  const match = text.match(/Servings?:\s*(\d+)/i);
  return match ? parseInt(match[1]) : 2;
}

function extractIngredients(text: string): string[] {
  const section = text.match(/\*\*Ingredients:\*\*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (!section) return [];
  return section[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
}

function extractInstructions(text: string): string[] {
  const section = text.match(/\*\*Instructions:\*\*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (!section) return [];
  return section[1]
    .split('\n')
    .filter(line => /^\d+\./.test(line.trim()))
    .map(line => line.replace(/^\d+\.\s*/, '').trim());
}

function extractNutritionNotes(text: string): string {
  const match = text.match(/\*\*Nutrition Notes:\*\*\s*([^\n*]+)/i);
  return match ? match[1].trim() : '';
}

function extractHealthBenefits(text: string): string[] {
  const section = text.match(/\*\*Health Benefits:\*\*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (!section) return [];
  return section[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
}

// =============================================================================
// GRAPH CREATION
// =============================================================================

export async function createChefAgent() {
  console.log('[MOCCET-CHEF] Creating chef agent graph...');

  const workflow = new StateGraph(ChefStateAnnotation)
    .addNode('chef', chefNode)
    .addEdge(START, 'chef')
    .addEdge('chef', END);

  const app = workflow.compile();
  console.log('[MOCCET-CHEF] Graph compiled successfully');

  return app;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

export async function runChefAgent(
  userEmail: string,
  message: string,
  existingMessages: BaseMessage[] = []
): Promise<{
  response: string;
  recipe?: any;
  error?: string;
}> {
  console.log('[MOCCET-CHEF] Running chef agent for:', userEmail);

  try {
    // Get user's nutrition context
    const userContext = await getUserNutritionContext(userEmail);
    console.log('[MOCCET-CHEF] User context loaded');

    // Create and run agent
    const agent = await createChefAgent();

    const initialState = {
      userEmail,
      message,
      userContext,
      messages: existingMessages,
    };

    const result = await agent.invoke(initialState);

    if (result.status === 'completed' && result.finalResult) {
      return {
        response: result.finalResult.response,
        recipe: result.finalResult.recipe,
      };
    } else if (result.error) {
      return {
        response: "I'm sorry, I had trouble generating a response. Please try again.",
        error: result.error,
      };
    }

    return {
      response: "I couldn't process your request. Please try again.",
    };
  } catch (error) {
    console.error('[MOCCET-CHEF] Error running agent:', error);
    return {
      response: "I encountered an error. Please try again.",
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

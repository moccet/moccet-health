/**
 * Model Configuration
 *
 * Defines model selection by tier and use case.
 * Allows easy switching between providers and models.
 */

import { ModelConfig, ModelTier } from './types';

/**
 * OpenAI model configurations by tier
 */
export const openaiModels: Record<ModelTier, ModelConfig> = {
  free: {
    chatModel: 'gpt-4o-mini',
    fastModel: 'gpt-4o-mini',
    reasoningModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    maxTokens: 4096,
    supportsVision: true,
    supportsFunctions: true,
  },
  pro: {
    chatModel: 'gpt-4o',
    fastModel: 'gpt-4o-mini',
    reasoningModel: 'gpt-4o',
    embeddingModel: 'text-embedding-3-large',
    maxTokens: 8192,
    supportsVision: true,
    supportsFunctions: true,
  },
  max: {
    chatModel: 'gpt-4o',
    fastModel: 'gpt-4o-mini',
    reasoningModel: 'o1-preview',
    embeddingModel: 'text-embedding-3-large',
    maxTokens: 16384,
    supportsVision: true,
    supportsFunctions: true,
  },
};

/**
 * Anthropic model configurations by tier
 */
export const anthropicModels: Record<ModelTier, ModelConfig> = {
  free: {
    chatModel: 'claude-3-haiku-20240307',
    fastModel: 'claude-3-haiku-20240307',
    reasoningModel: 'claude-3-haiku-20240307',
    embeddingModel: '', // Anthropic doesn't have embeddings
    maxTokens: 4096,
    supportsVision: true,
    supportsFunctions: true,
  },
  pro: {
    chatModel: 'claude-3-5-sonnet-20241022',
    fastModel: 'claude-3-haiku-20240307',
    reasoningModel: 'claude-3-5-sonnet-20241022',
    embeddingModel: '',
    maxTokens: 8192,
    supportsVision: true,
    supportsFunctions: true,
  },
  max: {
    chatModel: 'claude-3-5-sonnet-20241022',
    fastModel: 'claude-3-haiku-20240307',
    reasoningModel: 'claude-3-opus-20240229',
    embeddingModel: '',
    maxTokens: 16384,
    supportsVision: true,
    supportsFunctions: true,
  },
};

/**
 * Use case types for model selection
 */
export type UseCase =
  | 'chat'           // General conversation
  | 'fast'           // Quick, simple tasks
  | 'reasoning'      // Complex analysis/reasoning
  | 'insight'        // Health insight generation
  | 'classification' // Text classification
  | 'extraction'     // Data extraction
  | 'embedding';     // Text embeddings

/**
 * Get the appropriate model for a use case and tier
 */
export function getModelForUseCase(
  provider: 'openai' | 'anthropic',
  tier: ModelTier,
  useCase: UseCase
): string {
  const models = provider === 'openai' ? openaiModels : anthropicModels;
  const config = models[tier];

  switch (useCase) {
    case 'chat':
    case 'insight':
      return config.chatModel;
    case 'fast':
    case 'classification':
      return config.fastModel;
    case 'reasoning':
    case 'extraction':
      return config.reasoningModel;
    case 'embedding':
      return config.embeddingModel;
    default:
      return config.chatModel;
  }
}

/**
 * Get model config for a tier
 */
export function getModelConfig(
  provider: 'openai' | 'anthropic',
  tier: ModelTier
): ModelConfig {
  const models = provider === 'openai' ? openaiModels : anthropicModels;
  return models[tier];
}

/**
 * Model cost estimates (per 1K tokens, in USD)
 */
export const modelCosts: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },
  // Anthropic
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
};

/**
 * Estimate cost for a completion
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const cost = modelCosts[model];
  if (!cost) return 0;
  return (inputTokens / 1000) * cost.input + (outputTokens / 1000) * cost.output;
}

/**
 * AI Services Module
 *
 * Unified AI provider interface with support for OpenAI and Anthropic.
 *
 * @example
 * ```ts
 * import { getAIProvider, aiComplete, quickComplete } from '@/lib/services/ai';
 *
 * // Get default provider
 * const provider = getAIProvider('pro');
 *
 * // Quick completion
 * const response = await quickComplete('What is the capital of France?');
 *
 * // With automatic fallback
 * const result = await aiComplete([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */

// Types
export type {
  AIProvider,
  AIProviderName,
  ModelTier,
  Message,
  CompletionOptions,
  CompletionResult,
  StreamingOptions,
  EmbeddingOptions,
  EmbeddingResult,
  ModelConfig,
  ProviderConfig,
} from './types';

// Model configuration
export {
  openaiModels,
  anthropicModels,
  getModelForUseCase,
  getModelConfig,
  modelCosts,
  estimateCost,
} from './model-config';
export type { UseCase } from './model-config';

// Providers
export { OpenAIProvider, getOpenAIProvider } from './openai-provider';
export { AnthropicProvider, getAnthropicProvider } from './anthropic-provider';

// Factory
export {
  AIProviderFactory,
  getAIProvider,
  getProvider,
  aiComplete,
  quickComplete,
} from './ai-provider-factory';

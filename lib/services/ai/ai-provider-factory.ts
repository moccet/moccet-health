/**
 * AI Provider Factory
 *
 * Factory for creating and managing AI provider instances.
 * Supports provider selection, fallbacks, and load balancing.
 */

import { AIProvider, AIProviderName, ModelTier, Message, CompletionOptions, CompletionResult } from './types';
import { OpenAIProvider, getOpenAIProvider } from './openai-provider';
import { AnthropicProvider, getAnthropicProvider } from './anthropic-provider';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('AIProviderFactory');

/**
 * Provider preference order for fallback
 */
type ProviderPreference = AIProviderName[];

/**
 * Factory configuration
 */
interface FactoryConfig {
  /** Default provider to use */
  defaultProvider?: AIProviderName;
  /** Provider preference order for fallbacks */
  fallbackOrder?: ProviderPreference;
  /** Whether to enable automatic fallback */
  enableFallback?: boolean;
  /** Default tier for all providers */
  defaultTier?: ModelTier;
}

const DEFAULT_CONFIG: FactoryConfig = {
  defaultProvider: 'openai',
  fallbackOrder: ['openai', 'anthropic'],
  enableFallback: true,
  defaultTier: 'pro',
};

/**
 * AI Provider Factory
 */
export class AIProviderFactory {
  private static instance: AIProviderFactory;
  private providers = new Map<AIProviderName, AIProvider>();
  private config: FactoryConfig;

  private constructor(config: FactoryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: FactoryConfig): AIProviderFactory {
    if (!AIProviderFactory.instance) {
      AIProviderFactory.instance = new AIProviderFactory(config);
    }
    return AIProviderFactory.instance;
  }

  /**
   * Get a provider by name
   */
  getProvider(name: AIProviderName, tier?: ModelTier): AIProvider {
    const effectiveTier = tier || this.config.defaultTier || 'pro';

    // Check cache first
    const cacheKey = `${name}-${effectiveTier}`;
    let provider = this.providers.get(name);

    if (!provider) {
      // Create new provider
      switch (name) {
        case 'openai':
          provider = new OpenAIProvider({ tier: effectiveTier });
          break;
        case 'anthropic':
          provider = new AnthropicProvider({ tier: effectiveTier });
          break;
        default:
          throw new Error(`Unknown provider: ${name}`);
      }
      this.providers.set(name, provider);
    } else {
      // Update tier if provider supports it
      if ('setTier' in provider && typeof provider.setTier === 'function') {
        (provider as OpenAIProvider | AnthropicProvider).setTier(effectiveTier);
      }
    }

    return provider;
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(tier?: ModelTier): AIProvider {
    return this.getProvider(this.config.defaultProvider || 'openai', tier);
  }

  /**
   * Get provider with automatic fallback
   */
  async getAvailableProvider(tier?: ModelTier): Promise<AIProvider> {
    const order = this.config.fallbackOrder || ['openai', 'anthropic'];

    for (const name of order) {
      try {
        const provider = this.getProvider(name, tier);
        if (provider.isAvailable()) {
          const health = await provider.healthCheck();
          if (health.healthy) {
            return provider;
          }
          logger.warn(`Provider ${name} unhealthy`, { error: health.error });
        }
      } catch (error) {
        logger.warn(`Provider ${name} unavailable`, { error });
      }
    }

    throw new Error('No AI providers available');
  }

  /**
   * Complete with automatic fallback
   */
  async completeWithFallback(
    messages: Message[],
    options?: CompletionOptions & { preferredProvider?: AIProviderName }
  ): Promise<CompletionResult & { provider: AIProviderName }> {
    const order = options?.preferredProvider
      ? [options.preferredProvider, ...(this.config.fallbackOrder || []).filter(p => p !== options.preferredProvider)]
      : this.config.fallbackOrder || ['openai', 'anthropic'];

    let lastError: Error | null = null;

    for (const name of order) {
      try {
        const provider = this.getProvider(name);
        if (!provider.isAvailable()) {
          logger.debug(`Skipping unavailable provider: ${name}`);
          continue;
        }

        const result = await provider.complete(messages, options);
        return { ...result, provider: name };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Provider ${name} failed`, { error: lastError.message });

        if (!this.config.enableFallback) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('All providers failed');
  }

  /**
   * Check health of all providers
   */
  async checkAllProviders(): Promise<Record<AIProviderName, { healthy: boolean; latencyMs?: number; error?: string }>> {
    const results: Record<string, { healthy: boolean; latencyMs?: number; error?: string }> = {};

    for (const name of ['openai', 'anthropic'] as AIProviderName[]) {
      try {
        const provider = this.getProvider(name);
        if (provider.isAvailable()) {
          results[name] = await provider.healthCheck();
        } else {
          results[name] = { healthy: false, error: 'API key not configured' };
        }
      } catch (error) {
        results[name] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results as Record<AIProviderName, { healthy: boolean; latencyMs?: number; error?: string }>;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FactoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.providers.clear();
  }
}

/**
 * Convenience functions
 */

/**
 * Get the default AI provider
 */
export function getAIProvider(tier?: ModelTier): AIProvider {
  return AIProviderFactory.getInstance().getDefaultProvider(tier);
}

/**
 * Get a specific AI provider
 */
export function getProvider(name: AIProviderName, tier?: ModelTier): AIProvider {
  return AIProviderFactory.getInstance().getProvider(name, tier);
}

/**
 * Complete with automatic fallback
 */
export async function aiComplete(
  messages: Message[],
  options?: CompletionOptions & { preferredProvider?: AIProviderName }
): Promise<CompletionResult> {
  const result = await AIProviderFactory.getInstance().completeWithFallback(messages, options);
  return result;
}

/**
 * Quick completion helper
 */
export async function quickComplete(
  prompt: string,
  options?: CompletionOptions & {
    systemPrompt?: string;
    preferredProvider?: AIProviderName;
  }
): Promise<string> {
  const messages: Message[] = [];

  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  const result = await aiComplete(messages, options);
  return result.content;
}

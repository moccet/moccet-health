/**
 * Anthropic Provider Implementation
 *
 * Implements the AIProvider interface for Anthropic's Claude API.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  Message,
  CompletionOptions,
  CompletionResult,
  StreamingOptions,
  EmbeddingOptions,
  EmbeddingResult,
  ModelTier,
} from './types';
import { anthropicModels, getModelForUseCase } from './model-config';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  private client: Anthropic;
  private tier: ModelTier;

  constructor(options?: { apiKey?: string; tier?: ModelTier }) {
    const apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey,
    });

    this.tier = options?.tier || 'pro';
  }

  /**
   * Get the default model for this tier
   */
  private getDefaultModel(): string {
    return anthropicModels[this.tier].chatModel;
  }

  /**
   * Convert our message format to Anthropic's format
   * Anthropic requires separating system messages
   */
  private toAnthropicMessages(messages: Message[]): {
    system?: string;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | undefined;
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Combine all system messages
        system = system ? `${system}\n\n${msg.content}` : msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return { system, messages: anthropicMessages };
  }

  /**
   * Get a chat completion
   */
  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const model = options?.model || this.getDefaultModel();
    const { system, messages: anthropicMessages } = this.toAnthropicMessages(messages);

    const response = await this.client.messages.create({
      model,
      system,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || anthropicModels[this.tier].maxTokens,
      temperature: options?.temperature,
      stop_sequences: options?.stop,
      top_p: options?.topP,
    });

    // Extract text content from response
    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason || undefined,
      metadata: {
        id: response.id,
        type: response.type,
      },
    };
  }

  /**
   * Stream a chat completion
   */
  async stream(messages: Message[], options?: StreamingOptions): Promise<CompletionResult> {
    const model = options?.model || this.getDefaultModel();
    const { system, messages: anthropicMessages } = this.toAnthropicMessages(messages);

    const stream = this.client.messages.stream({
      model,
      system,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || anthropicModels[this.tier].maxTokens,
      temperature: options?.temperature,
      stop_sequences: options?.stop,
      top_p: options?.topP,
    });

    let fullContent = '';
    let finishReason: string | undefined;

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if ('text' in delta) {
          fullContent += delta.text;
          if (options?.onChunk) {
            options.onChunk(delta.text);
          }
        }
      } else if (event.type === 'message_delta') {
        finishReason = event.delta.stop_reason || undefined;
      }
    }

    const result: CompletionResult = {
      content: fullContent,
      model,
      finishReason,
    };

    if (options?.onComplete) {
      options.onComplete(result);
    }

    return result;
  }

  /**
   * Generate embeddings
   * Note: Anthropic doesn't have an embeddings API, so we throw an error
   */
  async embed(_text: string | string[], _options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
    throw new Error('Anthropic does not support embeddings. Use OpenAI for embeddings.');
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();

    try {
      // Simple API check - create a minimal message
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get model for a specific use case
   */
  getModelForUseCase(useCase: 'chat' | 'fast' | 'reasoning'): string {
    return getModelForUseCase('anthropic', this.tier, useCase);
  }

  /**
   * Set the tier
   */
  setTier(tier: ModelTier): void {
    this.tier = tier;
  }

  /**
   * Get current tier
   */
  getTier(): ModelTier {
    return this.tier;
  }
}

/**
 * Singleton instance for common usage
 */
let defaultInstance: AnthropicProvider | null = null;

export function getAnthropicProvider(options?: { tier?: ModelTier }): AnthropicProvider {
  if (!defaultInstance) {
    defaultInstance = new AnthropicProvider(options);
  } else if (options?.tier && defaultInstance.getTier() !== options.tier) {
    defaultInstance.setTier(options.tier);
  }
  return defaultInstance;
}

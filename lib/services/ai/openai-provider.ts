/**
 * OpenAI Provider Implementation
 *
 * Implements the AIProvider interface for OpenAI's API.
 */

import OpenAI from 'openai';
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
import { openaiModels, getModelForUseCase } from './model-config';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;
  private client: OpenAI;
  private tier: ModelTier;

  constructor(options?: { apiKey?: string; tier?: ModelTier; baseUrl?: string }) {
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: options?.baseUrl,
    });

    this.tier = options?.tier || 'pro';
  }

  /**
   * Get the default model for this tier
   */
  private getDefaultModel(): string {
    return openaiModels[this.tier].chatModel;
  }

  /**
   * Convert our message format to OpenAI's format
   */
  private toOpenAIMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Get a chat completion
   */
  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const model = options?.model || this.getDefaultModel();

    const response = await this.client.chat.completions.create({
      model,
      messages: this.toOpenAIMessages(messages),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stop: options?.stop,
      response_format: options?.responseFormat,
      top_p: options?.topP,
      frequency_penalty: options?.frequencyPenalty,
      presence_penalty: options?.presencePenalty,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason || undefined,
      metadata: {
        id: response.id,
        created: response.created,
      },
    };
  }

  /**
   * Stream a chat completion
   */
  async stream(messages: Message[], options?: StreamingOptions): Promise<CompletionResult> {
    const model = options?.model || this.getDefaultModel();

    const stream = await this.client.chat.completions.create({
      model,
      messages: this.toOpenAIMessages(messages),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stop: options?.stop,
      top_p: options?.topP,
      frequency_penalty: options?.frequencyPenalty,
      presence_penalty: options?.presencePenalty,
      stream: true,
    });

    let fullContent = '';
    let finishReason: string | undefined;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullContent += delta;

      if (options?.onChunk) {
        options.onChunk(delta);
      }

      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
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
   */
  async embed(text: string | string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
    const model = options?.model || openaiModels[this.tier].embeddingModel;
    const input = Array.isArray(text) ? text : [text];

    const response = await this.client.embeddings.create({
      model,
      input,
    });

    return response.data.map((item) => ({
      embedding: item.embedding,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    }));
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();

    try {
      await this.client.models.list();
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
  getModelForUseCase(useCase: 'chat' | 'fast' | 'reasoning' | 'embedding'): string {
    return getModelForUseCase('openai', this.tier, useCase);
  }

  /**
   * Set the tier (for testing or dynamic tier switching)
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
let defaultInstance: OpenAIProvider | null = null;

export function getOpenAIProvider(options?: { tier?: ModelTier }): OpenAIProvider {
  if (!defaultInstance) {
    defaultInstance = new OpenAIProvider(options);
  } else if (options?.tier && defaultInstance.getTier() !== options.tier) {
    defaultInstance.setTier(options.tier);
  }
  return defaultInstance;
}

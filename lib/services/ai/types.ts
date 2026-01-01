/**
 * AI Provider Types
 *
 * Common types and interfaces for AI providers.
 */

export type AIProviderName = 'openai' | 'anthropic';

export type ModelTier = 'free' | 'pro' | 'max';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  /** Override the default model for this request */
  model?: string;
  /** Temperature for response randomness (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Stop sequences */
  stop?: string[];
  /** Response format (for structured output) */
  responseFormat?: { type: 'text' | 'json_object' };
  /** Top P sampling */
  topP?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
}

export interface CompletionResult {
  content: string;
  /** The model that was actually used */
  model: string;
  /** Token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Finish reason */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface StreamingOptions extends CompletionOptions {
  /** Callback for each chunk of streamed content */
  onChunk?: (chunk: string) => void;
  /** Callback when streaming completes */
  onComplete?: (result: CompletionResult) => void;
}

export interface EmbeddingOptions {
  /** Override the default embedding model */
  model?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * AI Provider Interface
 *
 * Unified interface for interacting with AI providers.
 */
export interface AIProvider {
  /** Provider name */
  readonly name: AIProviderName;

  /** Get a chat completion */
  complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;

  /** Stream a chat completion */
  stream(messages: Message[], options?: StreamingOptions): Promise<CompletionResult>;

  /** Generate embeddings for text */
  embed(text: string | string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]>;

  /** Check if the provider is available (has valid credentials) */
  isAvailable(): boolean;

  /** Get provider health status */
  healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }>;
}

/**
 * Model configuration for different tiers
 */
export interface ModelConfig {
  /** Default model for chat completions */
  chatModel: string;
  /** Model for simple/fast tasks */
  fastModel: string;
  /** Model for complex reasoning tasks */
  reasoningModel: string;
  /** Model for embeddings */
  embeddingModel: string;
  /** Max tokens limit */
  maxTokens: number;
  /** Whether vision capabilities are available */
  supportsVision: boolean;
  /** Whether function calling is available */
  supportsFunctions: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** API key */
  apiKey: string;
  /** Base URL override */
  baseUrl?: string;
  /** Default timeout in ms */
  timeout?: number;
  /** Default model config by tier */
  tiers: Record<ModelTier, ModelConfig>;
}

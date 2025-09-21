export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    options?: string[];
    [key: string]: any;
  };
}

export interface ChatAction {
  type: 'quick-reply' | 'link' | 'demo' | 'brief' | 'service';
  label: string;
  value: string;
  metadata?: {
    serviceId?: string;
    [key: string]: any;
  };
}

export interface AssistantResponse {
  content: string;
  suggestedActions?: ChatAction[];
}
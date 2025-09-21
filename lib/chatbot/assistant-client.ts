import { ChatMessage, AssistantResponse } from './types';

export class AssistantClient {
  private messages: ChatMessage[] = [];

  constructor() {
    this.messages = [];
  }

  async sendMessage(message: string): Promise<AssistantResponse> {
    try {
      // Add user message to history
      this.messages.push({
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      // Call the chat assistant API
      const response = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: this.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data: AssistantResponse = await response.json();

      // Add assistant response to history
      this.messages.push({
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      });

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        content: "I apologize for the connection issue. Please schedule a sales call to discuss how Moccet's autonomous AI can transform your business.",
        suggestedActions: [
          {
            type: 'demo',
            label: 'Schedule Sales Call',
            value: 'demo'
          },
          {
            type: 'quick-reply',
            label: 'Try Again',
            value: 'Hi, I want to learn about Moccet'
          }
        ]
      };
    }
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  clearMessages(): void {
    this.messages = [];
  }
}
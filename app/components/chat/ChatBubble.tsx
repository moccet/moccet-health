'use client';

import { ChatMessage } from '@/lib/chatbot/types';

interface ChatBubbleProps {
  message: ChatMessage;
  onActionClick?: (action: string) => void;
}

export default function ChatBubble({ message, onActionClick }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  // Function to clean and format the content
  const formatContent = (content: string) => {
    // Remove all asterisks used for formatting
    let formatted = content.replace(/\*\*/g, '').replace(/\*/g, '');

    // Clean up any markdown-style formatting
    formatted = formatted.replace(/^#+\s/gm, ''); // Remove headers
    formatted = formatted.replace(/__/g, ''); // Remove underscores

    return formatted;
  };

  // Regular text messages
  return (
    <div
      className={`my-3 ${isUser ? 'ml-[40px] sm:ml-[60px] text-right' : 'mr-[20px] sm:mr-[60px]'}`}
      style={{ padding: isUser ? '8px 16px 8px 8px' : '8px 20px 8px 8px' }}
    >
      <div
        className={`inline-block rounded-[20px] text-[14px] leading-[1.6] font-['system-ui'] animate-fade-in-up shadow-sm ${
          isUser
            ? 'bg-gray-100 text-[#1a1a1a]'
            : 'bg-gray-200 text-black'
        } max-w-[85%] sm:max-w-none`}
        style={{ padding: '12px 18px', fontWeight: 300, wordBreak: 'break-word' }}
      >
        <div className={`whitespace-pre-wrap ${isUser ? '' : 'text-left'}`}>
          {isUser ? <span>{message.content}</span> : <span>{formatContent(message.content)}</span>}
        </div>
        {message.metadata?.options && (
          <div className="mt-3 space-y-2">
            {message.metadata.options.map((option: string, index: number) => (
              <button
                key={index}
                onClick={() => onActionClick?.(option)}
                className="block w-full text-left bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 text-sm transition-colors text-black"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
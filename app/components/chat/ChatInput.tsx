'use client';

import { useState, KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend(value.trim());
      }
    }
  };

  const handleSendClick = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
    }
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
        isFocused ? 'ring-2 ring-blue-500 ring-opacity-50' : 'ring-1 ring-gray-300'
      }`}
      style={{ backgroundColor: 'rgba(240, 240, 240, 0.8)' }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Type your message..."
        disabled={disabled}
        className="flex-1 bg-transparent outline-none text-sm text-black placeholder-gray-500"
        style={{ fontSize: '16px' }} // Prevents zoom on mobile
      />
      <button
        onClick={handleSendClick}
        disabled={disabled || !value.trim()}
        className={`p-2 rounded-full transition-all ${
          disabled || !value.trim()
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
        }`}
        aria-label="Send message"
      >
        <ArrowUp size={16} />
      </button>
    </div>
  );
}
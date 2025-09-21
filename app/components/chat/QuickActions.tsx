'use client';

import { ChatAction } from '@/lib/chatbot/types';
import { Calendar, FileText, MessageSquare, ExternalLink } from 'lucide-react';

interface QuickActionsProps {
  actions: ChatAction[];
  onActionClick: (action: ChatAction) => void;
}

export default function QuickActions({ actions, onActionClick }: QuickActionsProps) {
  if (!actions || actions.length === 0) return null;

  const getIcon = (type: ChatAction['type']) => {
    switch (type) {
      case 'demo':
        return <Calendar size={14} />;
      case 'brief':
        return <FileText size={14} />;
      case 'quick-reply':
        return <MessageSquare size={14} />;
      case 'link':
      case 'service':
        return <ExternalLink size={14} />;
      default:
        return null;
    }
  };

  const getButtonStyle = (type: ChatAction['type']) => {
    if (type === 'demo' || type === 'brief') {
      return 'bg-white text-gray-800 border border-gray-600 hover:bg-gray-100';
    }
    return 'bg-gray-700 text-white hover:bg-gray-600';
  };

  return (
    <div className="flex flex-wrap gap-2" style={{ padding: '12px 16px 0 16px' }}>
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => onActionClick(action)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${getButtonStyle(action.type)}`}
        >
          {getIcon(action.type)}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
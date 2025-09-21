'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { AssistantClient } from '@/lib/chatbot/assistant-client';
import { ChatMessage, ChatAction } from '@/lib/chatbot/types';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import QuickActions from './QuickActions';

export default function ChatWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [isHoveringWelcome, setIsHoveringWelcome] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<ChatAction[]>([]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000);
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  const [isAnimating, setIsAnimating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantClient = useRef<AssistantClient | null>(null);
  const hasInitialized = useRef(false);

  // Lock body scroll when chat is open on mobile
  useEffect(() => {
    if (isOpen && windowWidth < 450) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      const viewport = document.querySelector('meta[name=viewport]');
      const originalContent = viewport?.getAttribute('content');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }

      return () => {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);

        if (viewport && originalContent) {
          viewport.setAttribute('content', originalContent);
        }
      };
    }
  }, [isOpen, windowWidth]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    assistantClient.current = new AssistantClient();

    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm here to help you discover how Moccet Health's AI can transform your health monitoring. Our AI discovers health patterns without prompting and provides personalized insights. Ready to see what we can do for you?",
        timestamp: new Date(),
      }
    ]);
  }, []);

  useEffect(() => {
    const handlePageLoad = () => {
      const timer = setTimeout(() => {
        if (!hasShownWelcome) {
          setShowWelcomePopup(true);
          setHasShownWelcome(true);
        }
      }, 5000);

      return timer;
    };

    let timer: NodeJS.Timeout;
    if (document.readyState === 'complete') {
      timer = handlePageLoad();
    } else {
      window.addEventListener('load', () => {
        timer = handlePageLoad();
      });
    }

    return () => clearTimeout(timer);
  }, [hasShownWelcome]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      const height = window.visualViewport?.height || window.innerHeight;
      setWindowHeight(height);
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !assistantClient.current) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    setSuggestedActions([]);

    try {
      const response = await assistantClient.current.sendMessage(message);

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (response.suggestedActions) {
        setSuggestedActions(response.suggestedActions);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    console.log('Action clicked:', action);

    if (action.type === 'demo') {
      // Trigger waitlist page
      if ((window as unknown as {handleShowWaitlist?: () => void}).handleShowWaitlist) {
        (window as unknown as {handleShowWaitlist: () => void}).handleShowWaitlist();
      }
      setIsOpen(false);
    } else if (action.type === 'brief') {
      // Navigate to pricing section
      router.push('#health');
      setIsOpen(false);
    } else if (action.type === 'quick-reply') {
      handleSendMessage(action.value);
    } else if (action.type === 'link') {
      window.location.href = action.value;
    } else if (action.type === 'service') {
      router.push(action.value);
      setIsOpen(false);
    }
  };

  // Don't render on certain pages
  if (pathname === '/admin' || pathname?.startsWith('/auth')) {
    return null;
  }

  return (
    <>
      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <style jsx global>{`
        .moccet-welcome-button {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        /* Desktop hover state */
        @media (hover: hover) and (pointer: fine) {
          .moccet-welcome-button:hover {
            background-color: white !important;
            color: black !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }
        }

        /* Mobile/tablet active state */
        .moccet-welcome-button:active {
          background-color: white !important;
          color: black !important;
          transform: scale(0.98);
        }

        /* Disable hover effects on touch devices */
        @media (hover: none) and (pointer: coarse) {
          .moccet-welcome-button:hover {
            background-color: #1f2937dd !important;
            color: white !important;
          }
        }

        @supports not (height: 100dvh) {
          .mobile-chat-widget {
            height: 100vh !important;
            height: -webkit-fill-available !important;
          }
        }

        @supports (-webkit-touch-callout: none) {
          .mobile-chat-widget {
            height: -webkit-fill-available !important;
          }
        }

        .mobile-chat-widget {
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }

        @media screen and (max-width: 450px) {
          input[type="text"],
          input[type="email"],
          input[type="tel"],
          textarea {
            font-size: 16px !important;
            -webkit-text-size-adjust: 100%;
          }

          .mobile-chat-widget {
            left: 0 !important;
            right: 0 !important;
            width: 100vw !important;
            transform: none !important;
          }
        }

        @keyframes moccetBubbleIn {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes slideDown {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes arrowDown {
          0% {
            transform: translateY(-5px);
          }
          100% {
            transform: translateY(0);
          }
        }

        @keyframes typing {
          0%, 60%, 100% {
            opacity: 0.3;
          }
          30% {
            opacity: 1;
          }
        }

        @keyframes shrinkBounce {
          0% {
            transform: scale(1);
          }
          25% {
            transform: scale(0.85);
          }
          50% {
            transform: scale(1.1);
          }
          75% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
          }
        }

        .chat-button-animate {
          animation: shrinkBounce 0.8s ease-out;
        }

        .arrow-rotate {
          transition: transform 0.15s ease-in-out;
          animation: rotateIn 0.15s ease-out forwards;
        }

        @keyframes rotateIn {
          0% {
            transform: rotate(-45deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
      `}</style>

      {/* Chat Button */}
      {(!showWelcomePopup || windowWidth >= 450 || isOpen) && (
        <button
          onClick={() => {
            setIsAnimating(true);
            setTimeout(() => {
              setIsOpen(!isOpen);
              setIsAnimating(false);
            }, 400);
          }}
          className={`fixed bg-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50 flex items-center justify-center cursor-pointer ${isAnimating ? 'chat-button-animate' : ''}`}
          style={{
            width: '52px',
            height: '52px',
            bottom: '24px',
            right: '24px',
            zIndex: windowWidth < 450 ? 10000 : 9998
          }}
          aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
        >
        {!isOpen ? (
          <img
            src="/finAI.png"
            alt="Chat with us"
            style={{ width: '34px', height: '34px' }}
            className="object-contain"
          />
        ) : (
          <div className="arrow-rotate">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </div>
        )}
        </button>
      )}

      {/* Welcome Popup */}
      {showWelcomePopup && !isOpen && (
        <div
          className="fixed"
          style={{
            zIndex: windowWidth < 450 ? 10000 : 9998,
            ...(windowWidth < 450 ? {
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '90vw',
              maxWidth: 'none'
            } : {
              bottom: '90px',
              right: '24px',
              maxWidth: '416px'
            })
          }}
        >
          {/* AI Message Bubble */}
          <div
            className="relative text-white rounded-3xl shadow-lg border border-gray-700 animate-[moccetBubbleIn_0.6s_ease-out]"
            style={{
              backgroundColor: '#111111',
              padding: '18px 24px',
              marginBottom: windowWidth < 450 ? '0' : '8px',
              cursor: 'pointer'
            }}
            onClick={() => {
              if (windowWidth < 450) {
                setShowWelcomePopup(false);
                setIsOpen(true);
              }
            }}
            onMouseEnter={() => windowWidth >= 450 && setIsHoveringWelcome(true)}
            onMouseLeave={() => windowWidth >= 450 && setIsHoveringWelcome(false)}
          >
            <p className="text-white text-base leading-relaxed mb-3" style={{ fontWeight: '400', color: '#ffffff' }}>
              Hi 👋 I&apos;m <span className="font-bold">moccet AI</span>, how can I help?
            </p>

            {/* X Close Button */}
            {(isHoveringWelcome || windowWidth < 1024) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWelcomePopup(false);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 hover:bg-gray-700 rounded-full flex items-center justify-center text-white hover:text-gray-200 text-sm transition-all duration-500"
                style={{ backgroundColor: '#111111', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Response Option Bubbles - Only show on desktop */}
          {windowWidth >= 450 && (
            <div className="flex justify-end pr-4 animate-[slideDown_0.4s_ease-out_0.3s_both] gap-2">
              <button
                onClick={() => {
                  setShowWelcomePopup(false);
                  if ((window as unknown as {handleShowWaitlist?: () => void}).handleShowWaitlist) {
                    (window as unknown as {handleShowWaitlist: () => void}).handleShowWaitlist();
                  }
                }}
                className="moccet-welcome-button text-white rounded-full text-sm transition-all duration-200 shadow-md"
                style={{ padding: '12px 24px', fontWeight: '400', cursor: 'pointer', backgroundColor: '#1f2937dd', marginBottom: '6px' }}
              >
                Join Waitlist
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div
          className={`fixed flex flex-col border border-gray-200/30 overflow-hidden backdrop-blur-xl ${windowWidth < 450 ? 'mobile-chat-widget' : ''}`}
          style={{
            width: windowWidth < 450 ? '100vw' : '400px',
            height: windowWidth < 450 ? `${windowHeight}px` : Math.min(700, windowHeight - 160),
            maxHeight: windowWidth < 450 ? `${windowHeight}px` : Math.min(700, windowHeight - 160),
            bottom: windowWidth < 450 ? 0 : '90px',
            right: windowWidth < 450 ? 0 : '24px',
            borderRadius: windowWidth < 450 ? 0 : '12px',
            boxShadow: windowWidth < 450 ? 'none' : '0 20px 60px rgba(0,0,0,0.15)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: windowWidth < 450 ? 10000 : 9998,
            position: 'fixed'
          }}
        >
          <div className="w-full h-full flex flex-col" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
          {/* Header */}
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
            <div className="flex items-center justify-between" style={{ padding: '16px 20px 14px 20px' }}>
              <div style={{ paddingLeft: '10px' }}>
                <h3 className="font-georgia text-base font-bold text-black">moccet AI</h3>
              </div>
              <div className="flex gap-2" style={{ marginRight: '-5px' }}>
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-black/10 p-2 rounded-full transition-all duration-200 cursor-pointer"
                  aria-label="Close chat"
                >
                  <X size={18} className="text-black" />
                </button>
              </div>
            </div>
            <div style={{ height: '1px', backgroundColor: '#e5e7eb', width: '100%' }}></div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar" style={{
            backgroundColor: 'transparent',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onActionClick={handleSendMessage}
                />
              ))}
            {isTyping && (
              <div style={{ padding: '16px 40px 16px 16px' }}>
                <div className="inline-block rounded-full" style={{ backgroundColor: '#2a2a2a', padding: '12px 20px' }}>
                  <div className="flex gap-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-[typing_1.4s_infinite]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-[typing_1.4s_infinite_0.2s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-[typing_1.4s_infinite_0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
              <div ref={messagesEndRef} />
            </div>

          {/* Bottom Section Wrapper */}
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderBottomLeftRadius: windowWidth < 450 ? 0 : '12px', borderBottomRightRadius: windowWidth < 450 ? 0 : '12px' }}>
              {/* Suggested Actions */}
              {suggestedActions.length > 0 && (
                <QuickActions actions={suggestedActions} onActionClick={handleActionClick} />
              )}

              {/* Input */}
              <div style={{ padding: '12px' }}>
                <ChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSendMessage}
                  disabled={isTyping}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
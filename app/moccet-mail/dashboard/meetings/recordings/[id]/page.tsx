'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  confidence: number;
}

interface SpeakerProfile {
  index: number;
  label: string;
  email?: string;
  name?: string;
  wordCount: number;
  speakingTimeSeconds: number;
}

interface Summary {
  id: string;
  style: 'executive' | 'chronological' | 'sales';
  text: string;
  keyPoints: string[];
  topicsDiscussed: string[];
  isPrimary: boolean;
  createdAt: string;
}

interface ActionItem {
  id: string;
  description: string;
  ownerEmail?: string;
  ownerName?: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  confidence?: number;
}

interface Decision {
  id: string;
  text: string;
  context?: string;
  impactArea?: string;
  confidence?: number;
}

interface MeetingAttendee {
  email: string;
  name?: string;
  responseStatus: string;
}

interface MeetingDetails {
  id: string;
  title: string | null;
  meetingType: string;
  googleMeetUrl: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  durationSeconds: number | null;
  status: string;
  notetakerEnabled: boolean;
  recordingUrl: string | null;
  organizerEmail: string | null;
  organizerName: string | null;
  attendees: MeetingAttendee[];
  emailSent: boolean;
  errorMessage: string | null;
  createdAt: string;
  transcript: {
    id: string;
    rawTranscript: string | null;
    editedTranscript: string | null;
    segments: TranscriptSegment[];
    speakers: SpeakerProfile[];
    detectedLanguage: string;
    overallConfidence: number | null;
  } | null;
  summaries: Summary[];
  actionItems: ActionItem[];
  decisions: Decision[];
  followupDraft: {
    id: string;
    subject: string | null;
    body: string | null;
    toEmails: string[];
    status: string;
  } | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ timestamp: number; speaker: string; text: string }>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function RecordingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.id as string;
  const supabase = createClient();
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'action-items' | 'chat'>('summary');
  const [activeSummaryStyle, setActiveSummaryStyle] = useState<'executive' | 'chronological' | 'sales'>('executive');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          router.push('/moccet-mail');
          return;
        }

        setUserEmail(session.user.email);

        // Fetch meeting details
        const response = await fetch(
          `/api/meetings/${meetingId}?email=${encodeURIComponent(session.user.email)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Meeting not found');
          }
          throw new Error('Failed to fetch meeting details');
        }

        const data = await response.json();
        setMeeting(data.meeting);

        // Set active summary style based on primary
        const primarySummary = data.meeting.summaries?.find((s: Summary) => s.isPrimary);
        if (primarySummary) {
          setActiveSummaryStyle(primarySummary.style);
        }

        // Load chat history
        const chatResponse = await fetch(
          `/api/meetings/${meetingId}/chat?email=${encodeURIComponent(session.user.email)}`
        );
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          setChatMessages(chatData.history || []);
        }
      } catch (err) {
        console.error('Error loading meeting:', err);
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setIsLoading(false);
      }
    };

    if (meetingId) {
      loadData();
    }
  }, [meetingId, router, supabase.auth]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRegenerateSummary = async (style: 'executive' | 'chronological' | 'sales') => {
    if (!userEmail) return;

    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, setPrimary: true }),
      });

      if (response.ok) {
        // Refresh meeting data
        const refreshResponse = await fetch(
          `/api/meetings/${meetingId}?email=${encodeURIComponent(userEmail)}`
        );
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setMeeting(data.meeting);
        }
      }
    } catch (err) {
      console.error('Error regenerating summary:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !userEmail || isChatLoading) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: question }]);
    setIsChatLoading(true);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, question }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response.answer,
            citations: data.response.citations,
          },
        ]);
      }
    } catch (err) {
      console.error('Error sending chat:', err);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUpdateActionItem = async (itemId: string, status: string) => {
    if (!userEmail) return;

    try {
      // For now, just update locally - API endpoint would be needed
      setMeeting((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actionItems: prev.actionItems.map((item) =>
            item.id === itemId ? { ...item, status: status as ActionItem['status'] } : item
          ),
        };
      });
    } catch (err) {
      console.error('Error updating action item:', err);
    }
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} minutes`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
      complete: { label: 'Complete', color: '#166534', bg: '#dcfce7' },
      processing: { label: 'Processing', color: '#854d0e', bg: '#fef9c3' },
      transcribing: { label: 'Transcribing', color: '#854d0e', bg: '#fef9c3' },
      summarizing: { label: 'Summarizing', color: '#854d0e', bg: '#fef9c3' },
      scheduled: { label: 'Scheduled', color: '#1e40af', bg: '#dbeafe' },
      recording: { label: 'Recording', color: '#dc2626', bg: '#fee2e2' },
      failed: { label: 'Failed', color: '#991b1b', bg: '#fee2e2' },
    };
    const config = statusConfig[status] || { label: status, color: '#666', bg: '#f5f5f5' };
    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          color: config.color,
          backgroundColor: config.bg,
        }}
      >
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, { color: string; bg: string }> = {
      high: { color: '#991b1b', bg: '#fee2e2' },
      medium: { color: '#854d0e', bg: '#fef9c3' },
      low: { color: '#166534', bg: '#dcfce7' },
    };
    const config = colors[priority] || colors.medium;
    return (
      <span
        style={{
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 500,
          color: config.color,
          backgroundColor: config.bg,
          textTransform: 'uppercase',
        }}
      >
        {priority}
      </span>
    );
  };

  const getSpeakerColor = (index: number) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading meeting details...</p>
        <style jsx>{`
          .detail-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            gap: 16px;
            color: #666;
          }
          .loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #1a1a1a;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="detail-error">
        <h2>Error</h2>
        <p>{error || 'Meeting not found'}</p>
        <button onClick={() => router.push('/moccet-mail/dashboard/meetings/recordings')}>
          Back to Recordings
        </button>
        <style jsx>{`
          .detail-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            gap: 16px;
            text-align: center;
          }
          .detail-error h2 {
            font-size: 20px;
            color: #1a1a1a;
            margin: 0;
          }
          .detail-error p {
            color: #666;
            margin: 0;
          }
          .detail-error button {
            padding: 10px 20px;
            background: #1a1a1a;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  const activeSummary = meeting.summaries.find((s) => s.style === activeSummaryStyle);

  return (
    <div className="detail-page">
      {/* Header */}
      <div className="detail-header">
        <button className="back-button" onClick={() => router.back()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="header-content">
          <div className="header-top">
            <h1>{meeting.title || 'Untitled Meeting'}</h1>
            {getStatusBadge(meeting.status)}
          </div>

          <div className="header-meta">
            <span>{formatDate(meeting.scheduledStart)}</span>
            <span className="meta-dot">·</span>
            <span>{formatTime(meeting.scheduledStart)}</span>
            <span className="meta-dot">·</span>
            <span>{formatDuration(meeting.durationSeconds)}</span>
            {meeting.attendees.length > 0 && (
              <>
                <span className="meta-dot">·</span>
                <span>{meeting.attendees.length} attendees</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs">
        {(['summary', 'transcript', 'action-items', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'action-items' ? 'Action Items' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'action-items' && meeting.actionItems.filter((a) => a.status === 'open').length > 0 && (
              <span className="tab-badge">
                {meeting.actionItems.filter((a) => a.status === 'open').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="detail-content">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="summary-tab">
            {meeting.summaries.length === 0 ? (
              <div className="empty-state">
                <p>No summary available yet. The summary will be generated after processing completes.</p>
              </div>
            ) : (
              <>
                <div className="summary-style-tabs">
                  {(['executive', 'chronological', 'sales'] as const).map((style) => (
                    <button
                      key={style}
                      className={`style-tab ${activeSummaryStyle === style ? 'active' : ''}`}
                      onClick={() => setActiveSummaryStyle(style)}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                  <button
                    className="regenerate-button"
                    onClick={() => handleRegenerateSummary(activeSummaryStyle)}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>

                {activeSummary ? (
                  <div className="summary-content">
                    <div className="summary-text">{activeSummary.text}</div>

                    {activeSummary.keyPoints.length > 0 && (
                      <div className="summary-section">
                        <h3>Key Points</h3>
                        <ul>
                          {activeSummary.keyPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeSummary.topicsDiscussed.length > 0 && (
                      <div className="summary-section">
                        <h3>Topics Discussed</h3>
                        <div className="topics-list">
                          {activeSummary.topicsDiscussed.map((topic, i) => (
                            <span key={i} className="topic-tag">{topic}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No {activeSummaryStyle} summary available.</p>
                    <button
                      className="generate-button"
                      onClick={() => handleRegenerateSummary(activeSummaryStyle)}
                      disabled={isRegenerating}
                    >
                      {isRegenerating ? 'Generating...' : `Generate ${activeSummaryStyle} summary`}
                    </button>
                  </div>
                )}

                {/* Decisions */}
                {meeting.decisions.length > 0 && (
                  <div className="decisions-section">
                    <h3>Key Decisions</h3>
                    <div className="decisions-list">
                      {meeting.decisions.map((decision) => (
                        <div key={decision.id} className="decision-card">
                          <p className="decision-text">{decision.text}</p>
                          {decision.context && (
                            <p className="decision-context">{decision.context}</p>
                          )}
                          {decision.impactArea && (
                            <span className="decision-impact">{decision.impactArea}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="transcript-tab">
            {!meeting.transcript ? (
              <div className="empty-state">
                <p>No transcript available yet.</p>
              </div>
            ) : (
              <>
                {/* Speaker Legend */}
                {meeting.transcript.speakers.length > 0 && (
                  <div className="speaker-legend">
                    {meeting.transcript.speakers.map((speaker, i) => (
                      <div key={speaker.index} className="speaker-item">
                        <span
                          className="speaker-dot"
                          style={{ backgroundColor: getSpeakerColor(i) }}
                        />
                        <span className="speaker-name">
                          {speaker.name || speaker.label}
                        </span>
                        <span className="speaker-stats">
                          {speaker.wordCount} words · {Math.round(speaker.speakingTimeSeconds / 60)}m
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Transcript Segments */}
                <div className="transcript-segments">
                  {meeting.transcript.segments.length > 0 ? (
                    meeting.transcript.segments.map((segment, i) => {
                      const speakerIndex = meeting.transcript!.speakers.findIndex(
                        (s) => s.label === segment.speaker
                      );
                      return (
                        <div key={i} className="transcript-segment">
                          <div className="segment-header">
                            <span
                              className="segment-speaker"
                              style={{ color: getSpeakerColor(speakerIndex >= 0 ? speakerIndex : 0) }}
                            >
                              {segment.speaker}
                            </span>
                            <span className="segment-time">
                              {formatTimestamp(segment.startTime)}
                            </span>
                          </div>
                          <p className="segment-text">{segment.text}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="raw-transcript">
                      <p>{meeting.transcript.editedTranscript || meeting.transcript.rawTranscript}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Action Items Tab */}
        {activeTab === 'action-items' && (
          <div className="action-items-tab">
            {meeting.actionItems.length === 0 ? (
              <div className="empty-state">
                <p>No action items were identified in this meeting.</p>
              </div>
            ) : (
              <div className="action-items-list">
                {meeting.actionItems.map((item) => (
                  <div
                    key={item.id}
                    className={`action-item-card ${item.status === 'completed' ? 'completed' : ''}`}
                  >
                    <div className="action-item-header">
                      <input
                        type="checkbox"
                        checked={item.status === 'completed'}
                        onChange={(e) =>
                          handleUpdateActionItem(item.id, e.target.checked ? 'completed' : 'open')
                        }
                      />
                      <span className="action-item-description">{item.description}</span>
                    </div>
                    <div className="action-item-meta">
                      {getPriorityBadge(item.priority)}
                      {item.ownerName && (
                        <span className="action-item-owner">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {item.ownerName}
                        </span>
                      )}
                      {item.dueDate && (
                        <span className="action-item-due">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(item.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="chat-tab">
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <div className="chat-empty-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3>Ask about this meeting</h3>
                  <p>Ask questions about what was discussed, who said what, or any details from the transcript.</p>
                  <div className="chat-suggestions">
                    <button onClick={() => { setChatInput('What were the main decisions made?'); chatInputRef.current?.focus(); }}>
                      What were the main decisions made?
                    </button>
                    <button onClick={() => { setChatInput('Who has action items?'); chatInputRef.current?.focus(); }}>
                      Who has action items?
                    </button>
                    <button onClick={() => { setChatInput('What are the next steps?'); chatInputRef.current?.focus(); }}>
                      What are the next steps?
                    </button>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-message ${msg.role}`}>
                    <div className="message-content">
                      {msg.content}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="message-citations">
                          <span className="citations-label">Sources:</span>
                          {msg.citations.map((cite, j) => (
                            <span key={j} className="citation">
                              [{formatTimestamp(cite.timestamp)}] {cite.speaker}: &quot;{cite.text.substring(0, 50)}...&quot;
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="chat-message assistant">
                  <div className="message-content loading">
                    <span className="typing-indicator">
                      <span></span><span></span><span></span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-container">
              <input
                ref={chatInputRef}
                type="text"
                placeholder="Ask a question about this meeting..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                disabled={isChatLoading}
              />
              <button onClick={handleChatSubmit} disabled={isChatLoading || !chatInput.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .detail-page {
          padding: 24px 40px;
          max-width: 1000px;
        }

        .detail-header {
          margin-bottom: 24px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          margin-bottom: 16px;
        }

        .back-button:hover {
          color: #1a1a1a;
        }

        .header-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .header-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-top h1 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 24px;
          color: #1a1a1a;
          margin: 0;
        }

        .header-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666;
        }

        .meta-dot {
          color: #ccc;
        }

        .detail-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #e8e8e8;
          margin-bottom: 24px;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: -1px;
        }

        .tab-button:hover {
          color: #1a1a1a;
        }

        .tab-button.active {
          color: #1a1a1a;
          border-bottom-color: #1a1a1a;
        }

        .tab-badge {
          padding: 2px 6px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 600;
          border-radius: 10px;
        }

        .detail-content {
          min-height: 400px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 40px;
          background: #fafafa;
          border-radius: 12px;
          text-align: center;
        }

        .empty-state p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666;
          margin: 0 0 16px 0;
        }

        .generate-button {
          padding: 10px 20px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 8px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          cursor: pointer;
        }

        .generate-button:disabled {
          background: #999;
          cursor: not-allowed;
        }

        /* Summary Tab */
        .summary-style-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          align-items: center;
        }

        .style-tab {
          padding: 6px 12px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .style-tab:hover {
          background: #f8f7f2;
          color: #1a1a1a;
        }

        .style-tab.active {
          background: #1a1a1a;
          color: white;
          border-color: #1a1a1a;
        }

        .regenerate-button {
          margin-left: auto;
          padding: 6px 12px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 13px;
          cursor: pointer;
        }

        .regenerate-button:hover {
          background: #f8f7f2;
        }

        .regenerate-button:disabled {
          color: #999;
          cursor: not-allowed;
        }

        .summary-content {
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 24px;
        }

        .summary-text {
          font-family: "Inter", Helvetica;
          font-size: 15px;
          line-height: 1.7;
          color: #333;
          white-space: pre-wrap;
        }

        .summary-section {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #f0f0f0;
        }

        .summary-section h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .summary-section ul {
          margin: 0;
          padding-left: 20px;
        }

        .summary-section li {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #4a4a4a;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .topics-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .topic-tag {
          padding: 4px 10px;
          background: #f0f0f0;
          border-radius: 4px;
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #4a4a4a;
        }

        .decisions-section {
          margin-top: 24px;
        }

        .decisions-section h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0 0 16px 0;
        }

        .decisions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .decision-card {
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 16px;
        }

        .decision-text {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
          font-weight: 500;
        }

        .decision-context {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #666;
          margin: 0 0 8px 0;
        }

        .decision-impact {
          display: inline-block;
          padding: 2px 8px;
          background: #e0f2fe;
          color: #0369a1;
          font-size: 11px;
          font-weight: 500;
          border-radius: 4px;
        }

        /* Transcript Tab */
        .speaker-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          padding: 16px;
          background: #fafafa;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .speaker-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .speaker-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .speaker-name {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
        }

        .speaker-stats {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #999;
        }

        .transcript-segments {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .transcript-segment {
          padding: 12px 16px;
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
        }

        .segment-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .segment-speaker {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          font-weight: 600;
        }

        .segment-time {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #999;
        }

        .segment-text {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #333;
          line-height: 1.6;
          margin: 0;
        }

        .raw-transcript {
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 20px;
        }

        .raw-transcript p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #333;
          line-height: 1.7;
          white-space: pre-wrap;
          margin: 0;
        }

        /* Action Items Tab */
        .action-items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .action-item-card {
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 16px;
        }

        .action-item-card.completed {
          opacity: 0.6;
        }

        .action-item-card.completed .action-item-description {
          text-decoration: line-through;
        }

        .action-item-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .action-item-header input[type="checkbox"] {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          cursor: pointer;
        }

        .action-item-description {
          flex: 1;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #1a1a1a;
          line-height: 1.5;
        }

        .action-item-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
          padding-left: 30px;
        }

        .action-item-owner,
        .action-item-due {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #666;
        }

        /* Chat Tab */
        .chat-tab {
          display: flex;
          flex-direction: column;
          height: 500px;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #fafafa;
          border-radius: 12px 12px 0 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chat-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
        }

        .chat-empty-icon {
          width: 64px;
          height: 64px;
          background: #e8e8e8;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          margin-bottom: 16px;
        }

        .chat-empty h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .chat-empty p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666;
          margin: 0 0 20px 0;
          max-width: 300px;
        }

        .chat-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .chat-suggestions button {
          padding: 8px 12px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 16px;
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #666;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .chat-suggestions button:hover {
          background: #f8f7f2;
          color: #1a1a1a;
        }

        .chat-message {
          display: flex;
        }

        .chat-message.user {
          justify-content: flex-end;
        }

        .chat-message .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 16px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          line-height: 1.5;
        }

        .chat-message.user .message-content {
          background: #1a1a1a;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .chat-message.assistant .message-content {
          background: white;
          color: #333;
          border: 1px solid #e8e8e8;
          border-bottom-left-radius: 4px;
        }

        .message-content.loading {
          padding: 16px 24px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #999;
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .message-citations {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #f0f0f0;
        }

        .citations-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #999;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .citation {
          display: block;
          font-size: 12px;
          color: #666;
          background: #f5f5f5;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .chat-input-container {
          display: flex;
          gap: 8px;
          padding: 16px;
          background: white;
          border: 1px solid #e8e8e8;
          border-top: none;
          border-radius: 0 0 12px 12px;
        }

        .chat-input-container input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 24px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          outline: none;
        }

        .chat-input-container input:focus {
          border-color: #1a1a1a;
        }

        .chat-input-container button {
          width: 44px;
          height: 44px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .chat-input-container button:hover:not(:disabled) {
          background: #333;
        }

        .chat-input-container button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Meeting {
  id: string;
  summary: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  hangoutLink?: string;
  attendees?: Array<{ email: string; responseStatus: string }>;
}

interface Stats {
  emailsCategorized: number;
  draftsCreated: number;
  meetingsScheduled: number;
}

interface PendingDraft {
  id: string;
  subject: string;
  to: string;
  preview: string;
  createdAt: string;
  threadId?: string;
}

export default function DashboardHomePage() {
  const supabase = createClient();
  const [user, setUser] = useState<{ email: string; user_metadata?: { full_name?: string; name?: string } } | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<Stats>({ emailsCategorized: 0, draftsCreated: 0, meetingsScheduled: 0 });
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showSetupComplete, setShowSetupComplete] = useState(true);
  const [pendingDrafts, setPendingDrafts] = useState<PendingDraft[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user as typeof user);

        // Check Gmail connection status
        try {
          const statusRes = await fetch(`/api/gmail/status?email=${encodeURIComponent(session.user.email || '')}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setIsConnected(statusData.connected);

            if (statusData.connected) {
              // Load stats
              setStats({
                emailsCategorized: statusData.stats?.emailsCategorized || 0,
                draftsCreated: statusData.stats?.draftsCreated || 0,
                meetingsScheduled: statusData.stats?.meetingsScheduled || 0,
              });

              // Load upcoming meetings
              const eventsRes = await fetch(`/api/gmail/calendar/events?email=${encodeURIComponent(session.user.email || '')}`);
              if (eventsRes.ok) {
                const eventsData = await eventsRes.json();
                setMeetings(eventsData.events || []);
              }

              // Load pending drafts
              try {
                const draftsRes = await fetch(`/api/gmail/drafts/pending?email=${encodeURIComponent(session.user.email || '')}`);
                if (draftsRes.ok) {
                  const draftsData = await draftsRes.json();
                  setPendingDrafts(draftsData.drafts || []);
                }
              } catch (e) {
                console.log('Drafts API not available yet');
              }
            }
          }
        } catch (error) {
          console.error('Error loading dashboard data:', error);
        }

        setIsLoadingMeetings(false);
        setIsLoadingDrafts(false);
      }
    };
    loadData();
  }, [supabase.auth]);

  const getUserFirstName = () => {
    if (!user) return '';
    const name = user.user_metadata?.full_name || user.user_metadata?.name;
    if (name) return name.split(' ')[0];
    return user.email?.split('@')[0] || 'there';
  };

  const formatMeetingTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatMeetingDate = (dateTime: string) => {
    const date = new Date(dateTime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const handleSendDraft = async (draftId: string) => {
    if (!user?.email) return;

    setSendingDraftId(draftId);
    try {
      const response = await fetch('/api/gmail/drafts/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, email: user.email }),
      });

      if (response.ok) {
        // Remove the sent draft from the list
        setPendingDrafts(prev => prev.filter(d => d.id !== draftId));
      } else {
        console.error('Failed to send draft');
      }
    } catch (error) {
      console.error('Error sending draft:', error);
    } finally {
      setSendingDraftId(null);
    }
  };

  const handleDiscardDraft = async (draftId: string) => {
    if (!user?.email) return;

    try {
      const response = await fetch(`/api/gmail/drafts?id=${draftId}&email=${encodeURIComponent(user.email)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the discarded draft from the list
        setPendingDrafts(prev => prev.filter(d => d.id !== draftId));
      } else {
        console.error('Failed to discard draft');
      }
    } catch (error) {
      console.error('Error discarding draft:', error);
    }
  };

  const handleReviewDraft = (draftId: string) => {
    // Open in Gmail or navigate to a review page
    window.open(`https://mail.google.com/mail/u/0/#drafts`, '_blank');
  };

  return (
    <div className="dashboard-home">
      <div className="dashboard-content">
        {/* Header */}
        <header className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back, {getUserFirstName()}</p>
        </header>

        {/* Setup Complete Banner */}
        {showSetupComplete && isConnected && (
          <div className="setup-banner">
            <div className="setup-banner-content">
              <div className="setup-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Moccet setup completed</span>
            </div>
            <button
              className="banner-close"
              onClick={() => setShowSetupComplete(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats Cards */}
        {isConnected && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.emailsCategorized}</span>
                <span className="stat-label">Emails Categorized</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.draftsCreated}</span>
                <span className="stat-label">Drafts Created</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.meetingsScheduled}</span>
                <span className="stat-label">Meetings Scheduled</span>
              </div>
            </div>
          </div>
        )}

        {/* Pending Drafts Section - Shows emails awaiting user approval */}
        {isConnected && (
          <section className="drafts-section">
            <div className="section-header">
              <h2>Drafts Awaiting Your Approval</h2>
              <span className="section-subtitle">Review before sending</span>
            </div>

            <div className="drafts-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Emails are <strong>never sent automatically</strong>. You must review and click &quot;Send&quot; for each draft.</span>
            </div>

            <div className="drafts-card">
              {isLoadingDrafts ? (
                <div className="drafts-loading">
                  <div className="loading-spinner small"></div>
                  <span>Loading drafts...</span>
                </div>
              ) : pendingDrafts.length === 0 ? (
                <div className="drafts-empty">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="empty-text">No drafts pending approval</p>
                  <p className="empty-subtext">When AI creates draft replies, they&apos;ll appear here for your review</p>
                </div>
              ) : (
                <div className="drafts-list">
                  {pendingDrafts.map((draft) => (
                    <div key={draft.id} className="draft-item">
                      <div className="draft-info">
                        <div className="draft-to">To: {draft.to}</div>
                        <div className="draft-subject">{draft.subject}</div>
                        <div className="draft-preview">{draft.preview}</div>
                      </div>
                      <div className="draft-actions">
                        <button
                          className="draft-btn review"
                          onClick={() => handleReviewDraft(draft.id)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Review
                        </button>
                        <button
                          className="draft-btn send"
                          onClick={() => handleSendDraft(draft.id)}
                          disabled={sendingDraftId === draft.id}
                        >
                          {sendingDraftId === draft.id ? (
                            <>Sending...</>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                              Send
                            </>
                          )}
                        </button>
                        <button
                          className="draft-btn discard"
                          onClick={() => handleDiscardDraft(draft.id)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Meetings Section */}
        <section className="meetings-section">
          <div className="section-header">
            <h2>Your Meetings</h2>
            <span className="section-subtitle">Next 48 hours</span>
          </div>

          <div className="meetings-card">
            {isLoadingMeetings ? (
              <div className="meetings-loading">
                <div className="loading-spinner small"></div>
                <span>Loading meetings...</span>
              </div>
            ) : !isConnected ? (
              <div className="meetings-empty">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p>Connect Gmail to see your upcoming meetings</p>
                <a href="/moccet-mail/onboarding" className="connect-link">
                  Connect Gmail
                </a>
              </div>
            ) : meetings.length === 0 ? (
              <div className="meetings-empty">
                <p className="empty-text">No upcoming meetings in the next 48 hours</p>
              </div>
            ) : (
              <div className="meetings-list">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="meeting-item">
                    <div className="meeting-time">
                      <span className="meeting-date">{formatMeetingDate(meeting.start.dateTime)}</span>
                      <span className="meeting-hour">{formatMeetingTime(meeting.start.dateTime)}</span>
                    </div>
                    <div className="meeting-details">
                      <h4>{meeting.summary}</h4>
                      {meeting.attendees && meeting.attendees.length > 0 && (
                        <span className="meeting-attendees">
                          {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {meeting.hangoutLink && (
                      <a
                        href={meeting.hangoutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="meeting-join"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Join
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <a href="/moccet-mail/dashboard/categorization" className="action-card">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3>Configure Categories</h3>
              <p>Set up how your inbox is organized</p>
            </a>
            <a href="/moccet-mail/dashboard/drafts" className="action-card">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3>Draft Settings</h3>
              <p>Configure AI-generated replies</p>
            </a>
            <a href="/moccet-mail/dashboard/scheduling" className="action-card">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3>Auto-Scheduling</h3>
              <p>Enable automatic meeting creation</p>
            </a>
          </div>
        </section>
      </div>

      <style jsx>{`
        .dashboard-home {
          min-height: 100vh;
          background-color: #fbfaf4;
        }

        .dashboard-content {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 28px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .page-header p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 15px;
          color: #666;
          margin: 0;
        }

        .setup-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: #ffffff;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .setup-banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .setup-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .setup-icon svg {
          width: 18px;
          height: 18px;
          color: white;
        }

        .setup-banner-content span {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 15px;
          color: #1a1a1a;
        }

        .banner-close {
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #999;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .banner-close:hover {
          background-color: #f5f5f5;
          color: #666;
        }

        .banner-close svg {
          width: 100%;
          height: 100%;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.blue {
          background: #e3f2fd;
        }

        .stat-icon.blue svg {
          color: #1976d2;
        }

        .stat-icon.purple {
          background: #f3e5f5;
        }

        .stat-icon.purple svg {
          color: #7b1fa2;
        }

        .stat-icon.green {
          background: #e8f5e9;
        }

        .stat-icon.green svg {
          color: #388e3c;
        }

        .stat-icon svg {
          width: 24px;
          height: 24px;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 24px;
          color: #1a1a1a;
        }

        .stat-label {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
        }

        .drafts-section {
          margin-bottom: 32px;
        }

        .drafts-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #e8f5e9;
          border-radius: 8px;
          margin-bottom: 16px;
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #2e7d32;
        }

        .drafts-notice svg {
          flex-shrink: 0;
          color: #2e7d32;
        }

        .drafts-card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .drafts-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 14px;
        }

        .drafts-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
        }

        .drafts-empty .empty-subtext {
          font-size: 13px;
          color: #999;
          margin: 0;
        }

        .drafts-list {
          padding: 8px;
        }

        .draft-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px;
          border-radius: 8px;
          border-bottom: 1px solid #f5f5f5;
          transition: background-color 0.15s ease;
        }

        .draft-item:last-child {
          border-bottom: none;
        }

        .draft-item:hover {
          background-color: #f8f7f2;
        }

        .draft-info {
          flex: 1;
          min-width: 0;
        }

        .draft-to {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #999;
          margin-bottom: 4px;
        }

        .draft-subject {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .draft-preview {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #666;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .draft-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .draft-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .draft-btn.review {
          background: #f5f5f5;
          color: #1a1a1a;
        }

        .draft-btn.review:hover {
          background: #e8e8e8;
        }

        .draft-btn.send {
          background: #1a1a1a;
          color: white;
        }

        .draft-btn.send:hover {
          opacity: 0.85;
        }

        .draft-btn.discard {
          background: transparent;
          color: #999;
          padding: 8px;
        }

        .draft-btn.discard:hover {
          background: #fff5f5;
          color: #dc2626;
        }

        .meetings-section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 16px;
        }

        .section-header h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #1a1a1a;
          margin: 0;
        }

        .section-subtitle {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #999;
        }

        .meetings-card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .meetings-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 14px;
        }

        .loading-spinner.small {
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #1a1a1a;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .meetings-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          color: #ccc;
          margin-bottom: 16px;
        }

        .empty-icon svg {
          width: 100%;
          height: 100%;
        }

        .meetings-empty p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0 0 16px 0;
        }

        .empty-text {
          color: #999 !important;
        }

        .connect-link {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          text-decoration: none;
          padding: 10px 20px;
          background: #f8f7f2;
          border-radius: 8px;
          transition: background-color 0.15s ease;
        }

        .connect-link:hover {
          background: #f0f0f0;
        }

        .meetings-list {
          padding: 8px;
        }

        .meeting-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-radius: 8px;
          transition: background-color 0.15s ease;
        }

        .meeting-item:hover {
          background-color: #f8f7f2;
        }

        .meeting-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 80px;
        }

        .meeting-date {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 12px;
          color: #999;
        }

        .meeting-hour {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a;
        }

        .meeting-details {
          flex: 1;
          min-width: 0;
        }

        .meeting-details h4 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meeting-attendees {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #999;
        }

        .meeting-join {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #1a1a1a;
          color: white;
          border-radius: 6px;
          text-decoration: none;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          transition: opacity 0.15s ease;
        }

        .meeting-join:hover {
          opacity: 0.85;
        }

        .meeting-join svg {
          width: 16px;
          height: 16px;
        }

        .quick-actions h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #1a1a1a;
          margin: 0 0 16px 0;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .action-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 24px;
          text-decoration: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        .action-icon {
          width: 40px;
          height: 40px;
          background: #f8f7f2;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .action-icon svg {
          width: 20px;
          height: 20px;
          color: #1a1a1a;
        }

        .action-card h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 15px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .action-card p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          margin: 0;
          line-height: 1.4;
        }

        @media (max-width: 768px) {
          .dashboard-content {
            padding: 24px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

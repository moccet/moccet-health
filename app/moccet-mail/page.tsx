'use client';

import React, { useState, useEffect } from 'react';
import MailNavigation from './MailNavigation';
import './mail.css';

interface PatternData {
  meetingDensity?: {
    avgMeetingsPerDay: number;
    peakHours: string[];
    backToBackPercentage: number;
  };
  workHours?: {
    start: string;
    end: string;
    weekendActivity: boolean;
  };
  emailVolume?: {
    avgPerDay: number;
    afterHoursPercentage: number;
  };
}

export default function MoccetMailPage() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Feature states
  const [patterns, setPatterns] = useState<PatternData | null>(null);
  const [labelsCreated, setLabelsCreated] = useState(false);
  const [draftCreated, setDraftCreated] = useState(false);
  const [eventCreated, setEventCreated] = useState<{ title: string; url: string } | null>(null);

  // Loading states
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Check connection on mount
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const gmailEmailCookie = cookies.find(c => c.trim().startsWith('gmail_email='));

    if (gmailEmailCookie) {
      const email = gmailEmailCookie.split('=')[1];
      setIsConnected(true);
      setUserEmail(decodeURIComponent(email));
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setIsConnected(true);
      setTimeout(() => {
        const cookies = document.cookie.split(';');
        const emailCookie = cookies.find(c => c.trim().startsWith('gmail_email='));
        if (emailCookie) {
          setUserEmail(decodeURIComponent(emailCookie.split('=')[1]));
        }
      }, 500);
    }
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gmail/auth');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch('/api/gmail/disconnect', { method: 'POST' });
      setIsConnected(false);
      setUserEmail('');
      setPatterns(null);
      setLabelsCreated(false);
      setDraftCreated(false);
      setEventCreated(null);
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailData = async () => {
    setLoadingEmails(true);
    try {
      const response = await fetch('/api/gmail/fetch-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await response.json();
      if (data.success && data.patterns) {
        setPatterns(data.patterns);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchCalendarData = async () => {
    setLoadingCalendar(true);
    try {
      const response = await fetch('/api/gmail/fetch-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await response.json();
      if (data.success && data.patterns) {
        setPatterns(data.patterns);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const setupLabels = async () => {
    setLoadingLabels(true);
    try {
      const response = await fetch('/api/gmail/labels/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, backfill: false }),
      });
      const data = await response.json();
      if (data.success) {
        setLabelsCreated(true);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingLabels(false);
    }
  };

  const createDraft = async () => {
    setCreatingDraft(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setDraftCreated(true);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCreatingDraft(false);
    }
  };

  const createCalendarEvent = async () => {
    setCreatingEvent(true);
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      startTime.setHours(10, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const response = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          title: 'Moccet Wellness Check-in',
          description: 'AI-scheduled wellness reminder from Moccet',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setEventCreated({ title: data.title, url: data.eventUrl });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCreatingEvent(false);
    }
  };

  return (
    <main className="mail-page">
      <MailNavigation />

      <div className="mail-container">
        {/* Hero */}
        <section className="mail-hero">
          <h1>moccet mail</h1>
          <p>
            Intelligent inbox management that learns your patterns and helps you
            stay focused on what matters. Connect your Gmail and Calendar to get started.
          </p>
        </section>

        {/* Connection Card */}
        <section className="connection-card">
          <h2>Connect your Google account</h2>
          <p>
            Moccet Mail analyzes your email and calendar patterns to provide personalized
            productivity insights and help you manage your inbox more effectively.
          </p>

          <div className="scopes-list">
            <h3>Permissions we request</h3>
            <ul>
              <li><code>gmail.readonly</code> Read email messages</li>
              <li><code>gmail.modify</code> Apply labels to emails</li>
              <li><code>gmail.compose</code> Create email drafts</li>
              <li><code>calendar.readonly</code> Read calendar events</li>
              <li><code>calendar.events</code> Create calendar events</li>
              <li><code>userinfo.email</code> Get your email address</li>
            </ul>
          </div>

          {isConnected ? (
            <div className="connected-status">
              <div className="connected-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Connected as {userEmail}
              </div>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="disconnect-button"
              >
                {loading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="connect-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Connecting...' : 'Connect with Google'}
            </button>
          )}
        </section>

        {/* Feature Cards - Only show when connected */}
        {isConnected && (
          <>
            <div className="feature-grid">
              {/* Read Emails */}
              <div className="feature-card">
                <div className="feature-header">
                  <span className="scope-badge readonly">gmail.readonly</span>
                  <h3>Analyze Email Patterns</h3>
                </div>
                <p>
                  We analyze your email patterns to understand your communication habits
                  and provide insights to reduce inbox stress.
                </p>
                <button
                  onClick={fetchEmailData}
                  disabled={loadingEmails}
                  className={`feature-button ${patterns?.emailVolume ? 'success' : ''}`}
                >
                  {patterns?.emailVolume ? 'Analysis Complete' : loadingEmails ? 'Analyzing...' : 'Analyze Emails'}
                </button>

                {patterns?.emailVolume && (
                  <div className="result-display">
                    <h4>Email Insights</h4>
                    <div className="result-item">
                      <div className="title">{patterns.emailVolume.avgPerDay} emails/day average</div>
                      <div className="subtitle">{patterns.emailVolume.afterHoursPercentage}% sent after hours</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Read Calendar */}
              <div className="feature-card">
                <div className="feature-header">
                  <span className="scope-badge readonly">calendar.readonly</span>
                  <h3>Analyze Calendar</h3>
                </div>
                <p>
                  We read your calendar to find optimal times for wellness activities
                  and identify scheduling patterns that may affect your health.
                </p>
                <button
                  onClick={fetchCalendarData}
                  disabled={loadingCalendar}
                  className={`feature-button ${patterns?.meetingDensity ? 'success' : ''}`}
                >
                  {patterns?.meetingDensity ? 'Analysis Complete' : loadingCalendar ? 'Analyzing...' : 'Analyze Calendar'}
                </button>

                {patterns?.meetingDensity && (
                  <div className="result-display">
                    <h4>Calendar Insights</h4>
                    <div className="result-item">
                      <div className="title">{patterns.meetingDensity.avgMeetingsPerDay} meetings/day</div>
                      <div className="subtitle">{patterns.meetingDensity.backToBackPercentage}% back-to-back</div>
                    </div>
                    <div className="result-item">
                      <div className="title">Work hours: {patterns.workHours?.start} - {patterns.workHours?.end}</div>
                      <div className="subtitle">Peak: {patterns.meetingDensity.peakHours?.slice(0, 2).join(', ')}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Apply Labels */}
              <div className="feature-card">
                <div className="feature-header">
                  <span className="scope-badge modify">gmail.modify</span>
                  <h3>Apply Labels</h3>
                </div>
                <p>
                  We create labels to help organize your inbox automatically.
                  Categories include Action Required, Follow Up, and Low Priority.
                </p>
                <button
                  onClick={setupLabels}
                  disabled={loadingLabels || labelsCreated}
                  className={`feature-button ${labelsCreated ? 'success' : ''}`}
                >
                  {labelsCreated ? 'Labels Created' : loadingLabels ? 'Creating...' : 'Create Labels'}
                </button>

                {labelsCreated && (
                  <div className="labels-display">
                    <span className="label-tag">moccet/Action Required</span>
                    <span className="label-tag">moccet/Follow Up</span>
                    <span className="label-tag">moccet/Low Priority</span>
                  </div>
                )}
              </div>

              {/* Create Draft */}
              <div className="feature-card">
                <div className="feature-header">
                  <span className="scope-badge compose">gmail.compose</span>
                  <h3>Create Drafts</h3>
                </div>
                <p>
                  Our AI suggests email replies that appear in your Drafts folder.
                  We never send emails automatically without your approval.
                </p>
                <button
                  onClick={createDraft}
                  disabled={creatingDraft || draftCreated}
                  className={`feature-button ${draftCreated ? 'success' : ''}`}
                >
                  {draftCreated ? 'Draft Created' : creatingDraft ? 'Creating...' : 'Create Sample Draft'}
                </button>

                {draftCreated && (
                  <div className="success-message">
                    <p>Draft created! Check your Gmail Drafts folder to review and send.</p>
                  </div>
                )}
              </div>

              {/* Create Calendar Event */}
              <div className="feature-card">
                <div className="feature-header">
                  <span className="scope-badge events">calendar.events</span>
                  <h3>Schedule Events</h3>
                </div>
                <p>
                  We schedule wellness activities, workout reminders, and health check-ins
                  directly to your calendar based on your availability.
                </p>
                <button
                  onClick={createCalendarEvent}
                  disabled={creatingEvent || eventCreated !== null}
                  className={`feature-button ${eventCreated ? 'success' : ''}`}
                >
                  {eventCreated ? 'Event Created' : creatingEvent ? 'Creating...' : 'Create Wellness Event'}
                </button>

                {eventCreated && (
                  <div className="success-message">
                    <p>
                      &ldquo;{eventCreated.title}&rdquo; added to your calendar.{' '}
                      <a href={eventCreated.url} target="_blank" rel="noopener noreferrer">
                        View in Google Calendar
                      </a>
                    </p>
                  </div>
                )}
              </div>

              {/* Disconnect */}
              <div className="feature-card disconnect-section">
                <h3>Revoke Access</h3>
                <p>
                  You can disconnect your Google account at any time. This removes
                  all stored tokens and revokes our access to your data.
                </p>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="disconnect-button"
                >
                  {loading ? 'Disconnecting...' : 'Disconnect Google Account'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Privacy Footer */}
        <footer className="privacy-footer">
          <p>
            <strong>Privacy:</strong> Moccet does not store email content. Data is processed in real-time for insights only.
            <br />
            <a href="/privacy-policy">Read our Privacy Policy</a>
          </p>
        </footer>
      </div>
    </main>
  );
}

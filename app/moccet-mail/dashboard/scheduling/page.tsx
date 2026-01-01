'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AutoScheduledEvent {
  id: string;
  eventTitle: string;
  eventTime: string;
  meetLink?: string;
  emailSubject: string;
  createdAt: string;
  attendees: string[];
}

export default function SchedulingPage() {
  const supabase = createClient();
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
  const [autoMeetEnabled, setAutoMeetEnabled] = useState(true);
  const [recentEvents, setRecentEvents] = useState<AutoScheduledEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Manual event creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    addMeet: true,
    attendees: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);

        try {
          // Check connection status
          const statusRes = await fetch(`/api/gmail/status?email=${encodeURIComponent(session.user.email)}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setIsConnected(statusData.connected);

            if (statusData.connected) {
              // Load scheduling settings
              const settingsRes = await fetch(`/api/gmail/calendar/settings?email=${encodeURIComponent(session.user.email)}`);
              if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                setAutoScheduleEnabled(settingsData.autoScheduleEnabled ?? false);
                setAutoMeetEnabled(settingsData.autoMeetEnabled ?? true);
              }

              // Load recent auto-scheduled events
              const eventsRes = await fetch(`/api/gmail/calendar/auto-scheduled?email=${encodeURIComponent(session.user.email)}`);
              if (eventsRes.ok) {
                const eventsData = await eventsRes.json();
                setRecentEvents(eventsData.events || []);
              }
            }
          }
        } catch (error) {
          console.error('Error loading settings:', error);
        }
      }
      setIsLoading(false);
    };
    loadSettings();
  }, [supabase.auth]);

  const handleSaveSettings = async () => {
    if (!userEmail) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/gmail/calendar/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          autoScheduleEnabled,
          autoMeetEnabled,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!userEmail || !newEvent.title || !newEvent.date || !newEvent.startTime) return;

    setIsCreating(true);

    try {
      const startDateTime = `${newEvent.date}T${newEvent.startTime}:00`;
      const endDateTime = newEvent.endTime
        ? `${newEvent.date}T${newEvent.endTime}:00`
        : `${newEvent.date}T${addHour(newEvent.startTime)}:00`;

      const attendeeList = newEvent.attendees
        .split(',')
        .map(e => e.trim())
        .filter(e => e.includes('@'));

      const res = await fetch('/api/gmail/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          title: newEvent.title,
          startDateTime,
          endDateTime,
          addGoogleMeet: newEvent.addMeet,
          attendees: attendeeList,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setNewEvent({
          title: '',
          date: '',
          startTime: '',
          endTime: '',
          addMeet: true,
          attendees: '',
        });

        // Show success or refresh events list
        if (data.event) {
          // Could add to recent events or show success message
        }
      }
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const addHour = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const newHours = (hours + 1) % 24;
    return `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatEventTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="scheduling-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="scheduling-page">
      <div className="page-content">
        {/* Header */}
        <header className="page-header">
          <h1>Scheduling</h1>
          <p>Automatically create calendar events from emails</p>
        </header>

        {!isConnected ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2>Connect your calendar</h2>
            <p>Connect Gmail to enable automatic scheduling features.</p>
            <a href="/moccet-mail/onboarding" className="connect-button">
              Connect Gmail
            </a>
          </div>
        ) : (
          <>
            {/* Settings Card */}
            <div className="settings-card">
              <h2>Auto-Scheduling Settings</h2>
              <p className="settings-description">
                When enabled, Moccet will automatically detect meeting times mentioned in your emails
                and create calendar events for you.
              </p>

              <div className="setting-row">
                <div className="setting-info">
                  <label className="setting-label">Auto-schedule meetings</label>
                  <p className="setting-description">
                    Automatically create calendar events when meeting times are detected in emails
                  </p>
                </div>
                <button
                  className={`toggle ${autoScheduleEnabled ? 'active' : ''}`}
                  onClick={() => setAutoScheduleEnabled(!autoScheduleEnabled)}
                >
                  <span className="toggle-handle"></span>
                </button>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <label className="setting-label">Add Google Meet links</label>
                  <p className="setting-description">
                    Automatically generate Google Meet video call links for scheduled meetings
                  </p>
                </div>
                <button
                  className={`toggle ${autoMeetEnabled ? 'active' : ''}`}
                  onClick={() => setAutoMeetEnabled(!autoMeetEnabled)}
                >
                  <span className="toggle-handle"></span>
                </button>
              </div>

              <button
                className={`save-button ${saveSuccess ? 'success' : ''}`}
                onClick={handleSaveSettings}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save settings'}
              </button>
            </div>

            {/* Create Event Card */}
            <div className="create-event-card">
              <div className="card-header">
                <div>
                  <h2>Create Event</h2>
                  <p>Manually create a calendar event with Google Meet</p>
                </div>
                <button
                  className="create-button"
                  onClick={() => setShowCreateModal(true)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  New Event
                </button>
              </div>
            </div>

            {/* Recent Auto-Scheduled Events */}
            <div className="recent-events-card">
              <h2>Recent Auto-Scheduled Events</h2>
              {recentEvents.length === 0 ? (
                <div className="no-events">
                  <p>No events have been auto-scheduled yet.</p>
                  <p className="hint">Enable auto-scheduling above to automatically create events from your emails.</p>
                </div>
              ) : (
                <div className="events-list">
                  {recentEvents.map((event) => (
                    <div key={event.id} className="event-item">
                      <div className="event-info">
                        <h4>{event.eventTitle}</h4>
                        <span className="event-time">{formatEventTime(event.eventTime)}</span>
                        <span className="event-source">From: {event.emailSubject}</span>
                      </div>
                      {event.meetLink && (
                        <a
                          href={event.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="meet-badge"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Meet
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="how-it-works">
              <h2>How Auto-Scheduling Works</h2>
              <div className="steps">
                <div className="step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Email Detection</h4>
                    <p>Moccet scans incoming emails for meeting confirmations and scheduled times.</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Time Parsing</h4>
                    <p>AI extracts the meeting date, time, and attendee information.</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Event Creation</h4>
                    <p>A calendar event is created with a Google Meet link automatically attached.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Event</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Event Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Meeting with..."
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Attendees (comma-separated emails)</label>
                <input
                  type="text"
                  value={newEvent.attendees}
                  onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                  placeholder="john@example.com, jane@example.com"
                />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newEvent.addMeet}
                    onChange={(e) => setNewEvent({ ...newEvent, addMeet: e.target.checked })}
                  />
                  Add Google Meet link
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className="submit-button"
                onClick={handleCreateEvent}
                disabled={isCreating || !newEvent.title || !newEvent.date || !newEvent.startTime}
              >
                {isCreating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scheduling-page {
          min-height: 100vh;
          background-color: #fbfaf4;
        }

        .page-content {
          max-width: 800px;
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
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 80px 40px;
          min-height: 60vh;
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

        .loading-state span {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          text-align: center;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          color: #ccc;
          margin-bottom: 24px;
        }

        .empty-icon svg {
          width: 100%;
          height: 100%;
        }

        .empty-state h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 20px;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .empty-state p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0 0 24px 0;
        }

        .connect-button {
          padding: 14px 28px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          text-decoration: none;
          transition: opacity 0.15s ease;
        }

        .connect-button:hover {
          opacity: 0.85;
        }

        .settings-card,
        .create-event-card,
        .recent-events-card,
        .how-it-works {
          background: #ffffff;
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          margin-bottom: 24px;
        }

        .settings-card h2,
        .create-event-card h2,
        .recent-events-card h2,
        .how-it-works h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .settings-description {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }

        .setting-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 0;
          border-top: 1px solid #f0f0f0;
        }

        .setting-info {
          flex: 1;
        }

        .setting-label {
          display: block;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin-bottom: 4px;
        }

        .setting-info .setting-description {
          margin: 0;
          font-size: 13px;
        }

        .toggle {
          width: 48px;
          height: 28px;
          background: #e0e0e0;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          position: relative;
          transition: background-color 0.2s ease;
          flex-shrink: 0;
        }

        .toggle.active {
          background: #1a1a1a;
        }

        .toggle-handle {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px;
          height: 22px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .toggle.active .toggle-handle {
          transform: translateX(20px);
        }

        .save-button {
          margin-top: 20px;
          padding: 14px 28px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .save-button:hover {
          opacity: 0.9;
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .save-button.success {
          background: #22c55e;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-header p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          margin: 4px 0 0 0;
        }

        .create-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }

        .create-button:hover {
          opacity: 0.85;
        }

        .create-button svg {
          width: 18px;
          height: 18px;
        }

        .no-events {
          text-align: center;
          padding: 32px 20px;
        }

        .no-events p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0 0 8px 0;
        }

        .no-events .hint {
          font-size: 13px;
          color: #999;
        }

        .events-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .event-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: #f8f7f2;
          border-radius: 12px;
        }

        .event-info h4 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 4px 0;
        }

        .event-time {
          display: block;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
        }

        .event-source {
          display: block;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }

        .meet-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #1a1a1a;
          color: white;
          border-radius: 8px;
          text-decoration: none;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 12px;
          transition: opacity 0.15s ease;
        }

        .meet-badge:hover {
          opacity: 0.85;
        }

        .meet-badge svg {
          width: 14px;
          height: 14px;
        }

        .steps {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 20px;
        }

        .step {
          display: flex;
          gap: 16px;
        }

        .step-number {
          width: 32px;
          height: 32px;
          background: #f8f7f2;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a;
          flex-shrink: 0;
        }

        .step-content h4 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 4px 0;
        }

        .step-content p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          margin: 0;
          line-height: 1.4;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid #f0f0f0;
        }

        .modal-header h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #1a1a1a;
          margin: 0;
        }

        .modal-close {
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

        .modal-close:hover {
          background: #f5f5f5;
          color: #666;
        }

        .modal-close svg {
          width: 100%;
          height: 100%;
        }

        .modal-body {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group input[type="time"] {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #1a1a1a;
          transition: border-color 0.15s ease;
        }

        .form-group input:focus {
          outline: none;
          border-color: #1a1a1a;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px 24px;
          border-top: 1px solid #f0f0f0;
        }

        .cancel-button {
          padding: 12px 20px;
          background: transparent;
          color: #666;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cancel-button:hover {
          border-color: #ccc;
          color: #1a1a1a;
        }

        .submit-button {
          padding: 12px 20px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 8px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .submit-button:hover {
          opacity: 0.9;
        }

        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .page-content {
            padding: 24px;
          }

          .card-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .create-button {
            width: 100%;
            justify-content: center;
          }

          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

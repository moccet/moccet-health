'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

interface CalendarMeeting {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  hangoutLink?: string;
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
    self?: boolean;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
}

interface MeetingWithNotetaker extends CalendarMeeting {
  notetakerEnabled: boolean;
  notetakerMeetingId?: string;
  notetakerStatus?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function UpcomingMeetingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [meetings, setMeetings] = useState<MeetingWithNotetaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [togglingMeetings, setTogglingMeetings] = useState<Set<string>>(new Set());

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

        // Check Gmail connection status
        const statusResponse = await fetch(
          `/api/gmail/status?email=${encodeURIComponent(session.user.email)}`
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setIsConnected(statusData.connected);

          if (!statusData.connected) {
            setIsLoading(false);
            return;
          }
        }

        // Fetch upcoming calendar events
        const calendarResponse = await fetch(
          `/api/gmail/calendar/events?email=${encodeURIComponent(session.user.email)}&days=14`
        );

        if (!calendarResponse.ok) {
          throw new Error('Failed to fetch calendar events');
        }

        const calendarData = await calendarResponse.json();
        const calendarMeetings: CalendarMeeting[] = calendarData.meetings || [];

        // Fetch existing notetaker recordings to check status
        const recordingsResponse = await fetch(
          `/api/meetings?email=${encodeURIComponent(session.user.email)}&status=scheduled&limit=100`
        );

        let notetakerMeetings: Record<string, { id: string; status: string; enabled: boolean }> = {};

        if (recordingsResponse.ok) {
          const recordingsData = await recordingsResponse.json();
          for (const recording of recordingsData.meetings || []) {
            if (recording.calendarEventId) {
              notetakerMeetings[recording.calendarEventId] = {
                id: recording.id,
                status: recording.status,
                enabled: recording.notetakerEnabled,
              };
            }
          }
        }

        // Merge calendar meetings with notetaker status
        const mergedMeetings: MeetingWithNotetaker[] = calendarMeetings
          .filter((m) => new Date(m.start.dateTime) > new Date()) // Only future meetings
          .map((meeting) => {
            const notetaker = notetakerMeetings[meeting.id];
            return {
              ...meeting,
              notetakerEnabled: notetaker?.enabled ?? false,
              notetakerMeetingId: notetaker?.id,
              notetakerStatus: notetaker?.status,
            };
          });

        setMeetings(mergedMeetings);
      } catch (err) {
        console.error('Error loading meetings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load meetings');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router, supabase.auth]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleToggleNotetaker = async (meeting: MeetingWithNotetaker) => {
    if (!userEmail || togglingMeetings.has(meeting.id)) return;

    setTogglingMeetings((prev) => new Set(prev).add(meeting.id));

    try {
      if (meeting.notetakerEnabled && meeting.notetakerMeetingId) {
        // Disable notetaker - update existing record
        const response = await fetch(`/api/meetings/${meeting.notetakerMeetingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notetakerEnabled: false }),
        });

        if (response.ok) {
          setMeetings((prev) =>
            prev.map((m) =>
              m.id === meeting.id
                ? { ...m, notetakerEnabled: false }
                : m
            )
          );
        }
      } else {
        // Enable notetaker - create new recording or update existing
        if (meeting.notetakerMeetingId) {
          // Update existing
          const response = await fetch(`/api/meetings/${meeting.notetakerMeetingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notetakerEnabled: true }),
          });

          if (response.ok) {
            setMeetings((prev) =>
              prev.map((m) =>
                m.id === meeting.id
                  ? { ...m, notetakerEnabled: true }
                  : m
              )
            );
          }
        } else {
          // Create new recording
          const response = await fetch('/api/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              calendarEventId: meeting.id,
              googleMeetUrl: meeting.hangoutLink,
              title: meeting.summary,
              scheduledStart: meeting.start.dateTime,
              scheduledEnd: meeting.end.dateTime,
              organizerEmail: meeting.organizer?.email,
              organizerName: meeting.organizer?.displayName,
              attendees: meeting.attendees?.map((a) => ({
                email: a.email,
                name: a.displayName,
                responseStatus: a.responseStatus,
              })),
              enableNotetaker: true,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setMeetings((prev) =>
              prev.map((m) =>
                m.id === meeting.id
                  ? {
                      ...m,
                      notetakerEnabled: true,
                      notetakerMeetingId: data.meeting.id,
                      notetakerStatus: 'scheduled',
                    }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      console.error('Error toggling notetaker:', err);
    } finally {
      setTogglingMeetings((prev) => {
        const next = new Set(prev);
        next.delete(meeting.id);
        return next;
      });
    }
  };

  const handleEnableAll = async () => {
    const meetingsToEnable = meetings.filter(
      (m) => !m.notetakerEnabled && m.hangoutLink
    );

    for (const meeting of meetingsToEnable) {
      await handleToggleNotetaker(meeting);
    }
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const mins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (remainingMins === 0) return `${hours}h`;
    return `${hours}h ${remainingMins}m`;
  };

  const getTimeUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) return 'Started';
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffMins < 1440) return `in ${Math.round(diffMins / 60)}h`;
    return `in ${Math.round(diffMins / 1440)}d`;
  };

  const groupMeetingsByDate = (meetings: MeetingWithNotetaker[]) => {
    const groups: Record<string, MeetingWithNotetaker[]> = {};

    for (const meeting of meetings) {
      const dateKey = new Date(meeting.start.dateTime).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(meeting);
    }

    return Object.entries(groups).sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
    );
  };

  const meetingsWithMeetLink = meetings.filter((m) => m.hangoutLink);
  const enabledCount = meetingsWithMeetLink.filter((m) => m.notetakerEnabled).length;

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="upcoming-loading">
        <div className="loading-spinner"></div>
        <p>Loading upcoming meetings...</p>
        <style jsx>{`
          .upcoming-loading {
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

  if (!isConnected) {
    return (
      <div className="upcoming-page">
        <div className="not-connected">
          <div className="not-connected-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2>Connect your calendar</h2>
          <p>Connect your Google account to see upcoming meetings and enable the notetaker.</p>
          <button
            className="connect-button"
            onClick={() => router.push('/moccet-mail/onboarding')}
          >
            Connect Gmail
          </button>
        </div>

        <style jsx>{`
          .upcoming-page {
            padding: 32px 40px;
            max-width: 900px;
          }
          .not-connected {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 40px;
            background: white;
            border-radius: 12px;
            border: 1px solid #e8e8e8;
            text-align: center;
          }
          .not-connected-icon {
            width: 80px;
            height: 80px;
            background: #f5f5f5;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            margin-bottom: 20px;
          }
          .not-connected h2 {
            font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
            font-weight: 600;
            font-size: 20px;
            color: #1a1a1a;
            margin: 0 0 8px 0;
          }
          .not-connected p {
            font-family: "Inter", Helvetica;
            font-size: 14px;
            color: #666;
            margin: 0 0 24px 0;
            max-width: 400px;
          }
          .connect-button {
            padding: 12px 24px;
            background: #1a1a1a;
            color: white;
            border: none;
            border-radius: 8px;
            font-family: "Inter", Helvetica;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }
          .connect-button:hover {
            background: #333;
          }
        `}</style>
      </div>
    );
  }

  const groupedMeetings = groupMeetingsByDate(meetings);

  return (
    <div className="upcoming-page">
      <div className="upcoming-header">
        <div>
          <h1>Upcoming Meetings</h1>
          <p className="upcoming-subtitle">
            Manage which meetings the notetaker will join
          </p>
        </div>

        {meetingsWithMeetLink.length > 0 && (
          <div className="header-actions">
            <span className="enabled-count">
              {enabledCount} of {meetingsWithMeetLink.length} enabled
            </span>
            {enabledCount < meetingsWithMeetLink.length && (
              <button className="enable-all-button" onClick={handleEnableAll}>
                Enable all
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="upcoming-error">
          <p>{error}</p>
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="upcoming-empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3>No upcoming meetings</h3>
          <p>You don&apos;t have any meetings scheduled in the next 14 days.</p>
        </div>
      ) : (
        <div className="meetings-list">
          {groupedMeetings.map(([dateKey, dateMeetings]) => (
            <div key={dateKey} className="date-group">
              <div className="date-header">
                <span className="date-label">{formatDate(dateMeetings[0].start.dateTime)}</span>
                <span className="date-count">{dateMeetings.length} meeting{dateMeetings.length > 1 ? 's' : ''}</span>
              </div>

              <div className="date-meetings">
                {dateMeetings.map((meeting) => (
                  <div key={meeting.id} className="meeting-card">
                    <div className="meeting-time-column">
                      <span className="meeting-time">{formatTime(meeting.start.dateTime)}</span>
                      <span className="meeting-duration">
                        {formatDuration(meeting.start.dateTime, meeting.end.dateTime)}
                      </span>
                    </div>

                    <div className="meeting-content">
                      <div className="meeting-header">
                        <h3 className="meeting-title">{meeting.summary || 'Untitled Meeting'}</h3>
                        <span className="meeting-until">{getTimeUntil(meeting.start.dateTime)}</span>
                      </div>

                      <div className="meeting-meta">
                        {meeting.hangoutLink ? (
                          <span className="meeting-type google-meet">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Google Meet
                          </span>
                        ) : meeting.location ? (
                          <span className="meeting-type location">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {meeting.location.length > 30 ? meeting.location.substring(0, 30) + '...' : meeting.location}
                          </span>
                        ) : (
                          <span className="meeting-type no-location">No meeting link</span>
                        )}

                        {meeting.attendees && meeting.attendees.length > 0 && (
                          <span className="meeting-attendees">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {meeting.attendees.length} attendee{meeting.attendees.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {meeting.organizer && !meeting.organizer.self && (
                        <div className="meeting-organizer">
                          Organized by {meeting.organizer.displayName || meeting.organizer.email}
                        </div>
                      )}
                    </div>

                    <div className="meeting-notetaker">
                      {meeting.hangoutLink ? (
                        <>
                          <label className="notetaker-toggle">
                            <input
                              type="checkbox"
                              checked={meeting.notetakerEnabled}
                              onChange={() => handleToggleNotetaker(meeting)}
                              disabled={togglingMeetings.has(meeting.id)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                          <span className="notetaker-label">
                            {togglingMeetings.has(meeting.id)
                              ? 'Updating...'
                              : meeting.notetakerEnabled
                                ? 'Notetaker enabled'
                                : 'Enable notetaker'}
                          </span>
                        </>
                      ) : (
                        <span className="notetaker-unavailable">
                          No video link
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .upcoming-page {
          padding: 32px 40px;
          max-width: 900px;
        }

        .upcoming-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .upcoming-header h1 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 28px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .upcoming-subtitle {
          font-family: "Inter", Helvetica;
          font-size: 15px;
          color: #666;
          margin: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .enabled-count {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666;
        }

        .enable-all-button {
          padding: 8px 16px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 8px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .enable-all-button:hover {
          background: #333;
        }

        .upcoming-error {
          padding: 16px;
          background: #fee2e2;
          border-radius: 8px;
          color: #991b1b;
          margin-bottom: 24px;
        }

        .upcoming-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e8e8e8;
          text-align: center;
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          background: #f5f5f5;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          margin-bottom: 16px;
        }

        .upcoming-empty h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .upcoming-empty p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .meetings-list {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .date-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .date-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .date-label {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: #1a1a1a;
        }

        .date-count {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #999;
        }

        .date-meetings {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .meeting-card {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 16px 20px;
          transition: border-color 0.15s ease;
        }

        .meeting-card:hover {
          border-color: #d0d0d0;
        }

        .meeting-time-column {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 70px;
          flex-shrink: 0;
        }

        .meeting-time {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a;
        }

        .meeting-duration {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #999;
        }

        .meeting-content {
          flex: 1;
          min-width: 0;
        }

        .meeting-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }

        .meeting-title {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 15px;
          color: #1a1a1a;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meeting-until {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #666;
          background: #f5f5f5;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .meeting-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .meeting-type {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #666;
        }

        .meeting-type.google-meet {
          color: #0d9488;
        }

        .meeting-type.no-location {
          color: #999;
        }

        .meeting-attendees {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #666;
        }

        .meeting-organizer {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #999;
          margin-top: 6px;
        }

        .meeting-notetaker {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          min-width: 130px;
        }

        .notetaker-toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .notetaker-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #e0e0e0;
          transition: 0.2s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.2s;
          border-radius: 50%;
        }

        .notetaker-toggle input:checked + .toggle-slider {
          background-color: #10b981;
        }

        .notetaker-toggle input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .notetaker-toggle input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notetaker-label {
          font-family: "Inter", Helvetica;
          font-size: 11px;
          color: #666;
          text-align: right;
        }

        .notetaker-unavailable {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          color: #999;
          padding: 4px 8px;
          background: #f5f5f5;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

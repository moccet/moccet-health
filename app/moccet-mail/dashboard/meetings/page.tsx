'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Meeting {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
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

export default function MeetingsPage() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    const loadMeetings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        try {
          // Check connection status
          const statusRes = await fetch(`/api/gmail/status?email=${encodeURIComponent(session.user.email)}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setIsConnected(statusData.connected);

            if (statusData.connected) {
              // Load calendar events
              const eventsRes = await fetch(`/api/gmail/calendar/events?email=${encodeURIComponent(session.user.email)}&days=7`);
              if (eventsRes.ok) {
                const eventsData = await eventsRes.json();
                setMeetings(eventsData.events || []);
              }
            }
          }
        } catch (error) {
          console.error('Error loading meetings:', error);
        }
      }
      setIsLoading(false);
    };
    loadMeetings();
  }, [supabase.auth]);

  const formatDate = (dateTime: string) => {
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
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTimeRange = (start: string, end: string) => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const getDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  };

  const groupMeetingsByDate = (meetings: Meeting[]) => {
    const groups: { [key: string]: Meeting[] } = {};

    meetings.forEach((meeting) => {
      const dateKey = new Date(meeting.start.dateTime).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(meeting);
    });

    return Object.entries(groups).sort((a, b) =>
      new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  };

  const getResponseStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#22c55e';
      case 'tentative': return '#f59e0b';
      case 'declined': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="meetings-page">
      <div className="page-content">
        {/* Header */}
        <header className="page-header">
          <h1>Meetings</h1>
          <p>Your upcoming calendar events</p>
        </header>

        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <span>Loading meetings...</span>
          </div>
        ) : !isConnected ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2>Connect your calendar</h2>
            <p>Connect Gmail to see your upcoming meetings and calendar events.</p>
            <a href="/moccet-mail/onboarding" className="connect-button">
              Connect Gmail
            </a>
          </div>
        ) : meetings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2>No upcoming meetings</h2>
            <p>You have no meetings scheduled for the next 7 days.</p>
          </div>
        ) : (
          <div className="meetings-container">
            <div className="meetings-list">
              {groupMeetingsByDate(meetings).map(([dateKey, dayMeetings]) => (
                <div key={dateKey} className="day-group">
                  <h3 className="day-header">{formatDate(dayMeetings[0].start.dateTime)}</h3>
                  <div className="day-meetings">
                    {dayMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className={`meeting-card ${selectedMeeting?.id === meeting.id ? 'selected' : ''}`}
                        onClick={() => setSelectedMeeting(meeting)}
                      >
                        <div className="meeting-time">
                          <span className="time-range">{formatTimeRange(meeting.start.dateTime, meeting.end.dateTime)}</span>
                          <span className="duration">{getDuration(meeting.start.dateTime, meeting.end.dateTime)}</span>
                        </div>
                        <div className="meeting-info">
                          <h4>{meeting.summary || '(No title)'}</h4>
                          {meeting.location && (
                            <span className="meeting-location">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {meeting.location}
                            </span>
                          )}
                          {meeting.attendees && meeting.attendees.length > 0 && (
                            <div className="meeting-attendees">
                              <span className="attendee-count">
                                {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        {meeting.hangoutLink && (
                          <a
                            href={meeting.hangoutLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="join-button"
                            onClick={(e) => e.stopPropagation()}
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
                </div>
              ))}
            </div>

            {/* Meeting Details Panel */}
            {selectedMeeting && (
              <div className="meeting-details">
                <div className="details-header">
                  <h2>{selectedMeeting.summary || '(No title)'}</h2>
                  <button
                    className="close-details"
                    onClick={() => setSelectedMeeting(null)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="details-content">
                  <div className="detail-item">
                    <div className="detail-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="detail-text">
                      <span className="detail-label">Time</span>
                      <span className="detail-value">
                        {formatDate(selectedMeeting.start.dateTime)}, {formatTimeRange(selectedMeeting.start.dateTime, selectedMeeting.end.dateTime)}
                      </span>
                    </div>
                  </div>

                  {selectedMeeting.location && (
                    <div className="detail-item">
                      <div className="detail-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="detail-text">
                        <span className="detail-label">Location</span>
                        <span className="detail-value">{selectedMeeting.location}</span>
                      </div>
                    </div>
                  )}

                  {selectedMeeting.hangoutLink && (
                    <div className="detail-item">
                      <div className="detail-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="detail-text">
                        <span className="detail-label">Video Call</span>
                        <a href={selectedMeeting.hangoutLink} target="_blank" rel="noopener noreferrer" className="meet-link">
                          Join Google Meet
                        </a>
                      </div>
                    </div>
                  )}

                  {selectedMeeting.organizer && (
                    <div className="detail-item">
                      <div className="detail-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="detail-text">
                        <span className="detail-label">Organizer</span>
                        <span className="detail-value">
                          {selectedMeeting.organizer.displayName || selectedMeeting.organizer.email}
                          {selectedMeeting.organizer.self && ' (you)'}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 && (
                    <div className="attendees-section">
                      <h3>Attendees ({selectedMeeting.attendees.length})</h3>
                      <div className="attendees-list">
                        {selectedMeeting.attendees.map((attendee, index) => (
                          <div key={index} className="attendee-item">
                            <div
                              className="attendee-status"
                              style={{ backgroundColor: getResponseStatusColor(attendee.responseStatus) }}
                            ></div>
                            <span className="attendee-name">
                              {attendee.displayName || attendee.email}
                              {attendee.self && ' (you)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMeeting.description && (
                    <div className="description-section">
                      <h3>Description</h3>
                      <p>{selectedMeeting.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .meetings-page {
          min-height: 100vh;
          background-color: #fbfaf4;
        }

        .page-content {
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
          max-width: 400px;
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

        .meetings-container {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 24px;
        }

        .meetings-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .day-group {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .day-header {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: #666;
          margin: 0 0 16px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .day-meetings {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .meeting-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8f7f2;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 2px solid transparent;
        }

        .meeting-card:hover {
          background: #f0f0f0;
        }

        .meeting-card.selected {
          border-color: #1a1a1a;
        }

        .meeting-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 100px;
        }

        .time-range {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #1a1a1a;
        }

        .duration {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #999;
        }

        .meeting-info {
          flex: 1;
          min-width: 0;
        }

        .meeting-info h4 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meeting-location {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #666;
        }

        .meeting-location svg {
          width: 14px;
          height: 14px;
        }

        .meeting-attendees {
          margin-top: 4px;
        }

        .attendee-count {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #999;
        }

        .join-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #1a1a1a;
          color: white;
          border-radius: 8px;
          text-decoration: none;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          transition: opacity 0.15s ease;
          flex-shrink: 0;
        }

        .join-button:hover {
          opacity: 0.85;
        }

        .join-button svg {
          width: 16px;
          height: 16px;
        }

        .meeting-details {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          position: sticky;
          top: 24px;
          max-height: calc(100vh - 48px);
          overflow-y: auto;
        }

        .details-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid #f0f0f0;
        }

        .details-header h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #1a1a1a;
          margin: 0;
          padding-right: 16px;
        }

        .close-details {
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #999;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .close-details:hover {
          background: #f5f5f5;
          color: #666;
        }

        .close-details svg {
          width: 100%;
          height: 100%;
        }

        .details-content {
          padding: 24px;
        }

        .detail-item {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-icon {
          width: 20px;
          height: 20px;
          color: #666;
          flex-shrink: 0;
        }

        .detail-icon svg {
          width: 100%;
          height: 100%;
        }

        .detail-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .detail-label {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 12px;
          color: #999;
        }

        .detail-value {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #1a1a1a;
        }

        .meet-link {
          font-family: "Inter", Helvetica;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          text-decoration: underline;
        }

        .meet-link:hover {
          opacity: 0.7;
        }

        .attendees-section,
        .description-section {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #f0f0f0;
        }

        .attendees-section h3,
        .description-section h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #666;
          margin: 0 0 12px 0;
        }

        .attendees-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .attendee-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .attendee-status {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .attendee-name {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #1a1a1a;
        }

        .description-section p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          margin: 0;
          white-space: pre-wrap;
        }

        @media (max-width: 900px) {
          .meetings-container {
            grid-template-columns: 1fr;
          }

          .meeting-details {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            top: auto;
            border-radius: 16px 16px 0 0;
            max-height: 60vh;
            z-index: 100;
            box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
          }
        }

        @media (max-width: 768px) {
          .page-content {
            padding: 24px;
          }

          .meeting-card {
            flex-wrap: wrap;
          }

          .meeting-time {
            width: 100%;
            flex-direction: row;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .meeting-info {
            width: 100%;
          }

          .join-button {
            width: 100%;
            justify-content: center;
            margin-top: 12px;
          }
        }
      `}</style>
    </div>
  );
}

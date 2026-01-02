'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Recording {
  id: string;
  title: string | null;
  scheduledStart: string | null;
  durationSeconds: number | null;
  status: string;
  notetakerEnabled: boolean;
  attendeeCount: number;
  organizerName: string | null;
  primarySummary: string | null;
  actionItemCount: number;
  openActionItems: number;
}

export default function RecordingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'complete' | 'processing' | 'scheduled'>('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          router.push('/moccet-mail');
          return;
        }

        setUserEmail(session.user.email);

        // Fetch recordings
        const response = await fetch(
          `/api/meetings?email=${encodeURIComponent(session.user.email)}&limit=50`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch recordings');
        }

        const data = await response.json();
        setRecordings(data.meetings || []);
      } catch (err) {
        console.error('Error loading recordings:', err);
        setError('Failed to load recordings');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router, supabase.auth]);

  const filteredRecordings = recordings.filter((recording) => {
    if (filter === 'all') return true;
    if (filter === 'complete') return recording.status === 'complete';
    if (filter === 'processing') return ['processing', 'transcribing', 'summarizing'].includes(recording.status);
    if (filter === 'scheduled') return recording.status === 'scheduled';
    return true;
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
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
          padding: '4px 8px',
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

  if (isLoading) {
    return (
      <div className="recordings-loading">
        <div className="loading-spinner"></div>
        <p>Loading recordings...</p>
      </div>
    );
  }

  return (
    <div className="recordings-page">
      <div className="recordings-header">
        <div>
          <h1>Recordings</h1>
          <p className="recordings-subtitle">
            View and manage your meeting recordings and transcripts
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="recordings-filters">
        {(['all', 'complete', 'processing', 'scheduled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`filter-button ${filter === f ? 'active' : ''}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="recordings-error">
          <p>{error}</p>
        </div>
      )}

      {/* Recordings List */}
      {filteredRecordings.length === 0 ? (
        <div className="recordings-empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3>No recordings yet</h3>
          <p>
            {filter === 'all'
              ? 'Your meeting recordings will appear here once the notetaker joins your meetings.'
              : `No ${filter} recordings found.`}
          </p>
        </div>
      ) : (
        <div className="recordings-list">
          {filteredRecordings.map((recording) => (
            <div
              key={recording.id}
              className="recording-card"
              onClick={() => router.push(`/moccet-mail/dashboard/meetings/recordings/${recording.id}`)}
            >
              <div className="recording-card-header">
                <div className="recording-title-section">
                  <h3 className="recording-title">
                    {recording.title || 'Untitled Meeting'}
                  </h3>
                  <div className="recording-meta">
                    <span>{formatDate(recording.scheduledStart)}</span>
                    <span className="meta-separator">·</span>
                    <span>{formatDuration(recording.durationSeconds)}</span>
                    {recording.attendeeCount > 0 && (
                      <>
                        <span className="meta-separator">·</span>
                        <span>{recording.attendeeCount} attendees</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="recording-status">
                  {getStatusBadge(recording.status)}
                </div>
              </div>

              {recording.primarySummary && (
                <p className="recording-summary">
                  {recording.primarySummary.length > 200
                    ? recording.primarySummary.substring(0, 200) + '...'
                    : recording.primarySummary}
                </p>
              )}

              <div className="recording-card-footer">
                {recording.openActionItems > 0 && (
                  <span className="action-items-badge">
                    {recording.openActionItems} open action item{recording.openActionItems > 1 ? 's' : ''}
                  </span>
                )}
                <span className="view-details">View details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .recordings-page {
          padding: 32px 40px;
          max-width: 1000px;
        }

        .recordings-loading {
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

        .recordings-header {
          margin-bottom: 24px;
        }

        .recordings-header h1 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 28px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .recordings-subtitle {
          font-family: "Inter", Helvetica;
          font-size: 15px;
          color: #666;
          margin: 0;
        }

        .recordings-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }

        .filter-button {
          padding: 8px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-button:hover {
          background: #f8f7f2;
          color: #1a1a1a;
        }

        .filter-button.active {
          background: #1a1a1a;
          color: white;
          border-color: #1a1a1a;
        }

        .recordings-error {
          padding: 16px;
          background: #fee2e2;
          border-radius: 8px;
          color: #991b1b;
          margin-bottom: 24px;
        }

        .recordings-empty {
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

        .recordings-empty h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .recordings-empty p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666;
          margin: 0;
          max-width: 400px;
        }

        .recordings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .recording-card {
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .recording-card:hover {
          border-color: #d0d0d0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .recording-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .recording-title-section {
          flex: 1;
          min-width: 0;
        }

        .recording-title {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0 0 6px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .recording-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #666;
        }

        .meta-separator {
          color: #ccc;
        }

        .recording-status {
          flex-shrink: 0;
        }

        .recording-summary {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #4a4a4a;
          line-height: 1.5;
          margin: 12px 0 0 0;
        }

        .recording-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #f0f0f0;
        }

        .action-items-badge {
          font-family: "Inter", Helvetica;
          font-size: 12px;
          font-weight: 500;
          color: #854d0e;
          background: #fef9c3;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .view-details {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          font-weight: 500;
          color: #666;
        }

        .recording-card:hover .view-details {
          color: #1a1a1a;
        }
      `}</style>
    </div>
  );
}

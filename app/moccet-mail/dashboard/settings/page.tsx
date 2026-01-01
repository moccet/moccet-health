'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ConnectionStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  scopes?: string[];
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<ConnectionStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);

        try {
          const res = await fetch(`/api/gmail/status?email=${encodeURIComponent(session.user.email)}`);
          if (res.ok) {
            const data = await res.json();
            setGmailStatus({
              connected: data.connected,
              email: data.gmailEmail,
              connectedAt: data.connectedAt,
              scopes: data.scopes,
            });
          }
        } catch (error) {
          console.error('Error loading status:', error);
        }
      }
      setIsLoading(false);
    };
    loadStatus();
  }, [supabase.auth]);

  const handleDisconnect = async () => {
    if (!userEmail) return;

    setIsDisconnecting(true);

    try {
      const res = await fetch(`/api/gmail/disconnect?email=${encodeURIComponent(userEmail)}`, {
        method: 'POST',
      });

      if (res.ok) {
        setGmailStatus({ connected: false });
        setShowDisconnectConfirm(false);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/moccet-mail');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const scopeDescriptions: Record<string, string> = {
    'gmail.readonly': 'Read email metadata',
    'gmail.compose': 'Create draft emails',
    'gmail.labels': 'Create and manage labels',
    'gmail.modify': 'Apply labels to emails',
    'calendar.readonly': 'Read calendar events',
    'calendar.events': 'Create calendar events',
    'userinfo.email': 'Access email address',
  };

  const getScopeDescription = (scope: string) => {
    const shortScope = scope.replace('https://www.googleapis.com/auth/', '');
    return scopeDescriptions[shortScope] || shortScope;
  };

  if (isLoading) {
    return (
      <div className="settings-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-content">
        {/* Header */}
        <header className="page-header">
          <h1>Settings</h1>
          <p>Manage your account and connections</p>
        </header>

        {/* Connected Accounts */}
        <section className="settings-section">
          <h2>Connected Accounts</h2>

          <div className="account-card">
            <div className="account-header">
              <div className="account-icon gmail">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                </svg>
              </div>
              <div className="account-info">
                <h3>Gmail</h3>
                {gmailStatus.connected ? (
                  <span className="status connected">Connected</span>
                ) : (
                  <span className="status disconnected">Not connected</span>
                )}
              </div>
            </div>

            {gmailStatus.connected ? (
              <div className="account-details">
                <div className="detail-row">
                  <span className="detail-label">Connected email</span>
                  <span className="detail-value">{gmailStatus.email}</span>
                </div>
                {gmailStatus.connectedAt && (
                  <div className="detail-row">
                    <span className="detail-label">Connected on</span>
                    <span className="detail-value">{formatDate(gmailStatus.connectedAt)}</span>
                  </div>
                )}

                {gmailStatus.scopes && gmailStatus.scopes.length > 0 && (
                  <div className="scopes-section">
                    <h4>Authorized Permissions</h4>
                    <ul className="scopes-list">
                      {gmailStatus.scopes.map((scope, index) => (
                        <li key={index}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {getScopeDescription(scope)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  className="disconnect-button"
                  onClick={() => setShowDisconnectConfirm(true)}
                >
                  Disconnect Gmail
                </button>
              </div>
            ) : (
              <div className="account-details">
                <p className="not-connected-text">
                  Connect your Gmail account to enable inbox management features.
                </p>
                <a href="/moccet-mail/onboarding" className="connect-button">
                  Connect Gmail
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Privacy & Data */}
        <section className="settings-section">
          <h2>Privacy & Data</h2>

          <div className="privacy-card">
            <div className="privacy-item">
              <div className="privacy-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="privacy-content">
                <h4>Email Content</h4>
                <p>Moccet does not store your email body content. Emails are processed in real-time for categorization and draft generation only.</p>
              </div>
            </div>

            <div className="privacy-item">
              <div className="privacy-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="privacy-content">
                <h4>Data Security</h4>
                <p>Your OAuth tokens are encrypted and stored securely. You can disconnect at any time to revoke access.</p>
              </div>
            </div>

            <div className="privacy-item">
              <div className="privacy-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="privacy-content">
                <h4>What We Access</h4>
                <p>Email metadata (subject, sender, date), calendar event titles and times, and email volume patterns. We never read email body content.</p>
              </div>
            </div>
          </div>

          <a href="/privacy-policy" className="privacy-link">
            Read our full Privacy Policy
          </a>
        </section>

        {/* Account Actions */}
        <section className="settings-section">
          <h2>Account</h2>

          <div className="account-actions-card">
            <div className="action-row">
              <div className="action-info">
                <h4>Signed in as</h4>
                <p>{userEmail}</p>
              </div>
              <button className="signout-button" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="modal-overlay" onClick={() => setShowDisconnectConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-icon warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2>Disconnect Gmail?</h2>
              <p>This will revoke Moccet&apos;s access to your Gmail account. Your categories and draft settings will be preserved, but automatic features will stop working.</p>
              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => setShowDisconnectConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-disconnect-button"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .settings-page {
          min-height: 100vh;
          background-color: #fbfaf4;
        }

        .page-content {
          max-width: 700px;
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

        .settings-section {
          margin-bottom: 32px;
        }

        .settings-section h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0 0 16px 0;
        }

        .account-card,
        .privacy-card,
        .account-actions-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .account-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .account-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .account-icon.gmail {
          background: #fef2f2;
        }

        .account-icon svg {
          width: 24px;
          height: 24px;
          color: #dc2626;
        }

        .account-info h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0 0 4px 0;
        }

        .status {
          font-family: "Inter", Helvetica;
          font-weight: 500;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: 9999px;
        }

        .status.connected {
          background: #dcfce7;
          color: #166534;
        }

        .status.disconnected {
          background: #f3f4f6;
          color: #6b7280;
        }

        .account-details {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-label {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
        }

        .detail-value {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #1a1a1a;
        }

        .scopes-section {
          padding: 16px;
          background: #f8f7f2;
          border-radius: 12px;
        }

        .scopes-section h4 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
        }

        .scopes-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .scopes-list li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #1a1a1a;
        }

        .scopes-list svg {
          width: 16px;
          height: 16px;
          color: #22c55e;
          flex-shrink: 0;
        }

        .not-connected-text {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .connect-button {
          display: inline-flex;
          padding: 12px 24px;
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

        .disconnect-button {
          padding: 12px 24px;
          background: transparent;
          color: #dc2626;
          border: 1px solid #dc2626;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .disconnect-button:hover {
          background: #fef2f2;
        }

        .privacy-card {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .privacy-item {
          display: flex;
          gap: 16px;
        }

        .privacy-icon {
          width: 40px;
          height: 40px;
          background: #f8f7f2;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .privacy-icon svg {
          width: 20px;
          height: 20px;
          color: #1a1a1a;
        }

        .privacy-content h4 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 4px 0;
        }

        .privacy-content p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          margin: 0;
        }

        .privacy-link {
          display: inline-block;
          margin-top: 16px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          text-decoration: underline;
        }

        .privacy-link:hover {
          opacity: 0.7;
        }

        .action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .action-info h4 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 4px 0;
        }

        .action-info p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        .signout-button {
          padding: 10px 20px;
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

        .signout-button:hover {
          border-color: #ccc;
          color: #1a1a1a;
        }

        /* Modal */
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
          max-width: 400px;
        }

        .modal-content {
          padding: 32px;
          text-align: center;
        }

        .modal-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px auto;
        }

        .modal-icon.warning {
          background: #fef3c7;
        }

        .modal-icon svg {
          width: 28px;
          height: 28px;
          color: #f59e0b;
        }

        .modal-content h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 20px;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .modal-content p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          line-height: 1.5;
          margin: 0 0 24px 0;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .cancel-button {
          padding: 12px 24px;
          background: transparent;
          color: #666;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
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

        .confirm-disconnect-button {
          padding: 12px 24px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }

        .confirm-disconnect-button:hover {
          opacity: 0.9;
        }

        .confirm-disconnect-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .page-content {
            padding: 24px;
          }

          .action-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .signout-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

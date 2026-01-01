'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MailNavigation from '../MailNavigation';
import { createClient } from '@/lib/supabase/client';
import '../mail.css';

interface ScopeInfo {
  scope: string;
  name: string;
  badge: string;
  access: string[];
  usage: string[];
  notDo: string[];
}

const scopes: ScopeInfo[] = [
  {
    scope: 'gmail.readonly',
    name: 'Read Emails',
    badge: 'readonly',
    access: ['Email metadata (subject, sender, date)', 'Email count and volume patterns', 'After-hours email activity'],
    usage: ['Analyze communication patterns', 'Identify peak email hours', 'Calculate work-life balance metrics'],
    notDo: ['Store email content', 'Read email body text', 'Access attachments'],
  },
  {
    scope: 'calendar.readonly',
    name: 'Read Calendar',
    badge: 'readonly',
    access: ['Meeting titles and times', 'Calendar event patterns', 'Work hours and availability'],
    usage: ['Analyze meeting density', 'Find optimal break times', 'Calculate focus time availability'],
    notDo: ['Store meeting details', 'Access meeting notes', 'View private event details'],
  },
  {
    scope: 'gmail.modify',
    name: 'Apply Labels',
    badge: 'modify',
    access: ['Create new Gmail labels', 'Apply labels to messages', 'Organize inbox categories'],
    usage: ['Create smart organization labels', 'Mark emails by priority', 'Help you find important emails faster'],
    notDo: ['Delete emails', 'Move emails to trash', 'Modify email content'],
  },
  {
    scope: 'gmail.compose',
    name: 'Create Drafts',
    badge: 'compose',
    access: ['Create new email drafts', 'Save drafts to your Drafts folder'],
    usage: ['Generate AI-suggested replies', 'Help you respond faster', 'Save drafts for your review'],
    notDo: ['Send emails without approval', 'Access your contacts', 'Email anyone on your behalf'],
  },
  {
    scope: 'gmail.send',
    name: 'Send Emails',
    badge: 'send',
    access: ['Send emails you have approved', 'Send from your Gmail address'],
    usage: ['Send draft replies after you click "Send"', 'Only sends emails you explicitly approve'],
    notDo: ['Send emails automatically', 'Send without your confirmation', 'Email anyone without your explicit action'],
  },
  {
    scope: 'calendar.events',
    name: 'Create Events',
    badge: 'events',
    access: ['Create calendar events', 'Schedule reminders'],
    usage: ['Add wellness check-ins', 'Schedule breaks and recovery time', 'Create productivity reminders'],
    notDo: ['Delete existing events', 'Modify your meetings', 'Invite others to events'],
  },
];

export default function MoccetMailOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [expandedScope, setExpandedScope] = useState<string | null>(null);

  // Check authentication and Gmail connection status
  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUserEmail(session.user.email || null);

          // Check Gmail connection from cookies
          const cookies = document.cookie.split(';');
          const gmailEmailCookie = cookies.find(c => c.trim().startsWith('gmail_email='));
          if (gmailEmailCookie) {
            setIsConnected(true);
          }

          // Check URL params for successful OAuth callback
          const params = new URLSearchParams(window.location.search);
          if (params.get('success') === 'true' && params.get('auth') === 'gmail') {
            setIsConnected(true);
            window.history.replaceState({}, '', '/moccet-mail/onboarding');
          }

          setLoading(false);
        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          // Only redirect if explicitly signed out, not on initial load
          if (event === 'SIGNED_OUT') {
            router.push('/moccet-mail');
          }
        }
      }
    );

    // Initial check
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || null);
        setLoading(false);
      } else {
        // Wait a moment for cookies to be read, then check again
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession?.user) {
            router.push('/moccet-mail');
          } else {
            setUserEmail(retrySession.user.email || null);
            setLoading(false);
          }
        }, 500);
      }
    };

    checkInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const response = await fetch('/api/gmail/auth?returnPath=/moccet-mail/dashboard');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting:', error);
      setConnecting(false);
    }
  };

  const handleSkip = () => {
    router.push('/moccet-mail/dashboard');
  };

  const handleContinue = () => {
    router.push('/moccet-mail/dashboard');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/moccet-mail');
  };

  if (loading) {
    return (
      <main className="mail-page">
        <MailNavigation />
        <div className="mail-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div className="loading-spinner"></div>
        </div>
        <style jsx>{`
          .loading-spinner {
            width: 40px;
            height: 40px;
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
      </main>
    );
  }

  return (
    <main className="mail-page">
      <MailNavigation />

      <div className="mail-container">
        {/* Progress Indicator */}
        <div className="progress-bar">
          <div className="progress-step completed">
            <div className="step-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Sign In</span>
          </div>
          <div className="progress-line active"></div>
          <div className="progress-step active">
            <div className="step-circle">2</div>
            <span>Connect</span>
          </div>
          <div className="progress-line"></div>
          <div className="progress-step">
            <div className="step-circle">3</div>
            <span>Dashboard</span>
          </div>
        </div>

        {/* Welcome Section */}
        <section className="onboarding-hero">
          <h1>Connect your Google account</h1>
          <p>
            Welcome, <strong>{userEmail}</strong>! Connect your Gmail and Calendar to unlock
            intelligent inbox management and productivity insights.
          </p>
          <button onClick={handleSignOut} className="sign-out-link">
            Sign out
          </button>
        </section>

        {/* Scope Explanation */}
        <section className="scopes-section">
          <h2>What we&apos;ll access</h2>
          <p className="scopes-intro">
            We request only the permissions needed to provide our features.
            Tap each permission to learn exactly how we use it.
          </p>

          <div className="scope-cards">
            {scopes.map((scope) => (
              <div
                key={scope.scope}
                className={`scope-card ${expandedScope === scope.scope ? 'expanded' : ''}`}
                onClick={() => setExpandedScope(expandedScope === scope.scope ? null : scope.scope)}
              >
                <div className="scope-header">
                  <div className="scope-title">
                    <span className={`scope-badge ${scope.badge}`}>{scope.scope}</span>
                    <h3>{scope.name}</h3>
                  </div>
                  <svg
                    className={`expand-icon ${expandedScope === scope.scope ? 'rotated' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {expandedScope === scope.scope && (
                  <div className="scope-details">
                    <div className="scope-column">
                      <h4>What we access</h4>
                      <ul>
                        {scope.access.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="scope-column">
                      <h4>How we use it</h4>
                      <ul>
                        {scope.usage.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="scope-column not-do">
                      <h4>What we DON&apos;T do</h4>
                      <ul>
                        {scope.notDo.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Connection Card */}
        <section className="connection-card">
          {isConnected ? (
            <div className="connected-state">
              <div className="connected-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Gmail & Calendar Connected
              </div>
              <p>Your Google account has been linked successfully. You can now access all features.</p>
              <button onClick={handleContinue} className="connect-button">
                Continue to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="connect-prompt">
                <button
                  onClick={handleConnectGmail}
                  disabled={connecting}
                  className="connect-button google"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {connecting ? 'Connecting...' : 'Connect Gmail & Calendar'}
                </button>
              </div>

              <div className="skip-option">
                <p>Want to explore first?</p>
                <button onClick={handleSkip} className="skip-button">
                  Skip for now
                </button>
              </div>
            </>
          )}
        </section>

        {/* Important Notice */}
        <section className="important-notice">
          <div className="notice-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="notice-content">
            <h3>Emails are never sent without your approval</h3>
            <p>
              We create draft replies for you to review. You must explicitly click &quot;Send&quot; to send any email.
              We will <strong>never</strong> send emails automatically on your behalf.
            </p>
          </div>
        </section>

        {/* Privacy Notice */}
        <section className="privacy-notice">
          <h3>Your privacy matters</h3>
          <ul>
            <li>
              <strong>No email content stored</strong> - We only analyze metadata and patterns
            </li>
            <li>
              <strong>Disconnect anytime</strong> - Revoke access with one click from the dashboard
            </li>
            <li>
              <strong>Data processed in real-time</strong> - Nothing is saved to our servers
            </li>
            <li>
              <strong>You control sending</strong> - All emails require your explicit approval before sending
            </li>
          </ul>
          <Link href="/privacy-policy" className="privacy-link">
            Read our full Privacy Policy
          </Link>
        </section>

        {/* Footer */}
        <footer className="privacy-footer">
          <p>
            <Link href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              Manage your Google permissions
            </Link>
          </p>
        </footer>
      </div>

      <style jsx>{`
        .progress-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 48px;
          padding-top: 20px;
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .step-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "SF Pro", -apple-system, sans-serif;
          font-weight: 500;
          font-size: 14px;
          background: #e0e0e0;
          color: #666;
        }

        .progress-step.active .step-circle {
          background: #1a1a1a;
          color: white;
        }

        .progress-step.completed .step-circle {
          background: #2e7d32;
          color: white;
        }

        .progress-step.completed .step-circle svg {
          width: 18px;
          height: 18px;
        }

        .progress-step span {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #666;
        }

        .progress-step.active span,
        .progress-step.completed span {
          color: #1a1a1a;
          font-weight: 500;
        }

        .progress-line {
          width: 80px;
          height: 2px;
          background: #e0e0e0;
          margin: 0 16px;
          margin-bottom: 28px;
        }

        .progress-line.active {
          background: #1a1a1a;
        }

        .onboarding-hero {
          text-align: center;
          margin-bottom: 48px;
        }

        .onboarding-hero h1 {
          font-family: "Playfair Display", Georgia, serif;
          font-weight: 400;
          color: #1a1a1a;
          font-size: 42px;
          letter-spacing: -0.02em;
          margin: 0 0 16px 0;
        }

        .onboarding-hero p {
          font-family: "Inter", Helvetica;
          font-size: 16px;
          color: #4a4a4a;
          margin: 0 0 12px 0;
        }

        .sign-out-link {
          background: none;
          border: none;
          color: #666;
          font-size: 14px;
          text-decoration: underline;
          cursor: pointer;
          font-family: "Inter", Helvetica;
        }

        .sign-out-link:hover {
          color: #1a1a1a;
        }

        .scopes-section {
          margin-bottom: 48px;
        }

        .scopes-section h2 {
          font-family: "SF Pro", -apple-system, sans-serif;
          font-weight: 500;
          font-size: 24px;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .scopes-intro {
          font-family: "Inter", Helvetica;
          font-size: 15px;
          color: #666;
          margin: 0 0 24px 0;
        }

        .scope-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .scope-card {
          background: white;
          border-radius: 12px;
          padding: 20px 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .scope-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .scope-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .scope-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .scope-title h3 {
          font-family: "SF Pro", -apple-system, sans-serif;
          font-weight: 500;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0;
        }

        .expand-icon {
          width: 20px;
          height: 20px;
          color: #666;
          transition: transform 0.2s ease;
        }

        .expand-icon.rotated {
          transform: rotate(180deg);
        }

        .scope-details {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .scope-column h4 {
          font-family: "SF Pro", -apple-system, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .scope-column ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .scope-column li {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #4a4a4a;
          padding: 4px 0;
          padding-left: 16px;
          position: relative;
        }

        .scope-column li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 10px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1a1a1a;
        }

        .scope-column.not-do li::before {
          background: #d32f2f;
        }

        .scope-column.not-do h4 {
          color: #d32f2f;
        }

        .connected-state {
          text-align: center;
          padding: 20px 0;
        }

        .connected-state p {
          margin-bottom: 24px;
        }

        .connect-prompt {
          text-align: center;
          margin-bottom: 24px;
        }

        .connect-button.google {
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }

        .skip-option {
          text-align: center;
          padding-top: 16px;
          border-top: 1px solid #eee;
        }

        .skip-option p {
          font-size: 14px;
          color: #666;
          margin: 0 0 8px 0;
        }

        .skip-button {
          background: none;
          border: none;
          color: #1a1a1a;
          font-size: 14px;
          text-decoration: underline;
          cursor: pointer;
          font-family: "Inter", Helvetica;
        }

        .skip-button:hover {
          opacity: 0.7;
        }

        .important-notice {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          background: #e8f5e9;
          border: 1px solid #a5d6a7;
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 24px;
        }

        .notice-icon {
          flex-shrink: 0;
          color: #2e7d32;
        }

        .notice-content h3 {
          font-family: "SF Pro", -apple-system, sans-serif;
          font-weight: 600;
          font-size: 15px;
          color: #1b5e20;
          margin: 0 0 8px 0;
        }

        .notice-content p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #2e7d32;
          margin: 0;
          line-height: 1.5;
        }

        .privacy-notice {
          background: #f8f7f2;
          border-radius: 12px;
          padding: 24px 28px;
          margin-bottom: 40px;
        }

        .privacy-notice h3 {
          font-family: "SF Pro", -apple-system, sans-serif;
          font-weight: 500;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0 0 16px 0;
        }

        .privacy-notice ul {
          list-style: none;
          padding: 0;
          margin: 0 0 16px 0;
        }

        .privacy-notice li {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #4a4a4a;
          padding: 8px 0;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .privacy-notice li::before {
          content: "✓";
          color: #2e7d32;
          font-weight: bold;
        }

        .privacy-link {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #1a1a1a;
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .scope-details {
            grid-template-columns: 1fr;
          }

          .progress-line {
            width: 40px;
          }

          .onboarding-hero h1 {
            font-size: 32px;
          }
        }
      `}</style>
    </main>
  );
}

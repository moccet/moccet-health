'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MailNavigation from './MailNavigation';
import { createClient } from '@/lib/supabase/client';
import './mail.css';

export default function MoccetMailLandingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Already logged in, redirect to dashboard
        router.push('/moccet-mail/dashboard');
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router, supabase.auth]);

  if (isCheckingAuth) {
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

      <div className="landing-container">
        {/* Hero Section */}
        <section className="landing-hero">
          <h1><span className="title-moccet">moccet</span> <span className="title-mail">mail</span></h1>
          <p className="hero-subtitle">
            Intelligent inbox management that learns your patterns and helps you
            stay focused on what matters.
          </p>

          <button
            onClick={() => window.location.href = '/moccet-mail/auth'}
            className="get-started-button"
          >
            Get Started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </section>

        {/* Features Grid */}
        <section className="landing-features">
          <div className="feature-item">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3>Smart Labels</h3>
            <p>AI-powered categorization that organizes your inbox automatically</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3>Draft Replies</h3>
            <p>AI-suggested responses that match your writing style</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3>Auto Scheduling</h3>
            <p>Automatically create calendar events with Google Meet</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3>Insights</h3>
            <p>Understand your email patterns and optimize your workflow</p>
          </div>
        </section>

        {/* Privacy Notice */}
        <section className="landing-privacy">
          <p>
            <strong>Privacy first:</strong> We never store your email content. Data is processed in real-time only.
          </p>
        </section>
      </div>

      <style jsx>{`
        .landing-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 80px 40px;
          text-align: center;
        }

        .landing-hero {
          margin-bottom: 80px;
        }

        .landing-hero h1 {
          font-size: 64px;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0 0 24px 0;
          color: #1a1a1a;
        }

        .title-moccet {
          font-family: "Inter", Helvetica;
          font-weight: 900;
        }

        .title-mail {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-weight: 500;
          font-stretch: expanded;
        }

        .hero-subtitle {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          color: #4a4a4a;
          font-size: 20px;
          line-height: 1.6;
          margin: 0 auto 40px auto;
          max-width: 500px;
        }

        .get-started-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 18px 36px;
          background-color: #1a1a1a;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 17px;
          letter-spacing: -0.01em;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .get-started-button:hover {
          background-color: #333;
          transform: translateY(-1px);
        }

        .landing-features {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 60px;
        }

        .feature-item {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          text-align: center;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .feature-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          background: #f8f7f2;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px auto;
        }

        .feature-icon svg {
          width: 28px;
          height: 28px;
          color: #1a1a1a;
        }

        .feature-item h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 16px;
          color: #1a1a1a;
          margin: 0 0 10px 0;
        }

        .feature-item p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666666;
          line-height: 1.5;
          margin: 0;
        }

        .landing-privacy {
          padding: 24px;
          background: #f8f7f2;
          border-radius: 12px;
        }

        .landing-privacy p {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666666;
          margin: 0;
        }

        .landing-privacy strong {
          color: #1a1a1a;
        }

        @media (max-width: 900px) {
          .landing-features {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .landing-container {
            padding: 60px 24px;
          }

          .landing-hero h1 {
            font-size: 40px;
          }

          .hero-subtitle {
            font-size: 17px;
          }

          .landing-features {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

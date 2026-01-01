'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import '../mail.css';

export default function MoccetMailAuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.push('/moccet-mail/onboarding');
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router, supabase.auth]);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/moccet-mail/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsSubmitting(false);
      }
    } catch {
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/moccet-mail/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsSubmitting(false);
      }
    } catch {
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/moccet-mail/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setShowEmailSent(true);
    } catch {
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <main className="auth-page">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
        </div>
        <style jsx>{`
          .auth-page {
            min-height: 100vh;
            background-color: #f8f7f2;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .auth-loading {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e0e0e0;
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
    <main className="auth-page">
      {/* Close button */}
      <Link href="/moccet-mail" className="close-button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>

      <div className="auth-container">
        {!showEmailSent ? (
          <>
            {/* Header */}
            <h1>Sign up below to unlock the full potential of <span className="title-moccet">moccet</span></h1>
            <p className="auth-subtitle">
              By continuing, you agree to our <Link href="/privacy-policy">privacy policy</Link>.
            </p>

            {/* OAuth Buttons */}
            <div className="oauth-buttons">
              <button
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="oauth-button google"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={handleAppleSignIn}
                disabled={isSubmitting}
                className="oauth-button apple"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Continue with Apple
              </button>
            </div>

            {/* Divider */}
            <div className="divider"></div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="email-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isSubmitting}
                className="email-input"
              />
              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="email-button"
              >
                {isSubmitting ? 'Sending...' : 'Continue with email'}
              </button>
            </form>

            {error && <p className="error-message">{error}</p>}

            {/* Close link */}
            <Link href="/moccet-mail" className="close-link">
              Close
            </Link>
          </>
        ) : (
          <div className="email-sent">
            <div className="email-sent-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1>Check your email</h1>
            <p className="email-sent-text">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
            <p className="email-sent-hint">
              Click the link in your email to sign in. The link expires in 1 hour.
            </p>
            <button
              onClick={() => {
                setShowEmailSent(false);
                setEmail('');
              }}
              className="try-again-button"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          background-color: #f8f7f2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          position: relative;
        }

        .close-button {
          position: absolute;
          top: 24px;
          right: 24px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .close-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
          color: #1a1a1a;
        }

        .close-button svg {
          width: 24px;
          height: 24px;
        }

        .auth-container {
          width: 100%;
          max-width: 400px;
          text-align: center;
        }

        h1 {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 32px;
          color: #1a3a3a;
          line-height: 1.3;
          margin: 0 0 16px 0;
        }

        .title-moccet {
          font-family: "Inter", Helvetica;
          font-weight: 900;
        }

        .auth-subtitle {
          font-family: "Inter", Helvetica;
          font-size: 15px;
          color: #1a3a3a;
          margin: 0 0 32px 0;
        }

        .auth-subtitle a {
          color: #1a3a3a;
          text-decoration: underline;
        }

        .oauth-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .oauth-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 16px 24px;
          border: none;
          border-radius: 12px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .oauth-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .oauth-button svg {
          width: 20px;
          height: 20px;
        }

        .oauth-button.google {
          background-color: #1a3a3a;
          color: white;
        }

        .oauth-button.google:hover:not(:disabled) {
          background-color: #2a4a4a;
        }

        .oauth-button.apple {
          background-color: #1a3a3a;
          color: white;
        }

        .oauth-button.apple:hover:not(:disabled) {
          background-color: #2a4a4a;
        }

        .divider {
          height: 1px;
          background-color: #e0e0e0;
          margin: 24px 0;
        }

        .email-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .email-input {
          width: 100%;
          padding: 16px 18px;
          border: 1px solid #e8e8e0;
          border-radius: 12px;
          background-color: #f0efe8;
          font-family: "Inter", Helvetica;
          font-size: 15px;
          color: #1a1a1a;
          outline: none;
          transition: all 0.15s ease;
        }

        .email-input::placeholder {
          color: #999;
        }

        .email-input:focus {
          border-color: #1a3a3a;
          background-color: #fff;
        }

        .email-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .email-button {
          width: 100%;
          padding: 16px 24px;
          background-color: #f0efe8;
          color: #999;
          border: 1px solid #e8e8e0;
          border-radius: 12px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .email-button:not(:disabled) {
          background-color: #1a3a3a;
          color: white;
          border-color: #1a3a3a;
        }

        .email-button:hover:not(:disabled) {
          background-color: #2a4a4a;
        }

        .email-button:disabled {
          cursor: not-allowed;
        }

        .error-message {
          color: #dc2626;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          margin: 16px 0 0 0;
        }

        .close-link {
          display: inline-block;
          margin-top: 24px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 15px;
          color: #1a3a3a;
          text-decoration: none;
        }

        .close-link:hover {
          text-decoration: underline;
        }

        /* Email Sent State */
        .email-sent {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .email-sent-icon {
          width: 80px;
          height: 80px;
          background: #1a3a3a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .email-sent-icon svg {
          width: 40px;
          height: 40px;
          color: white;
        }

        .email-sent-text {
          font-family: "Inter", Helvetica;
          font-size: 16px;
          color: #4a4a4a;
          margin: 0 0 8px 0;
        }

        .email-sent-hint {
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #666;
          margin: 0 0 24px 0;
        }

        .try-again-button {
          padding: 14px 28px;
          background: transparent;
          color: #1a3a3a;
          border: 1px solid #1a3a3a;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .try-again-button:hover {
          background-color: #f0f0f0;
        }

        @media (max-width: 480px) {
          h1 {
            font-size: 26px;
          }

          .oauth-button,
          .email-button {
            padding: 14px 20px;
            font-size: 15px;
          }
        }
      `}</style>
    </main>
  );
}

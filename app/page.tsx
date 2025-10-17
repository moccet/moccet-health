'use client';

import { useState } from 'react';
import './landing.css';

export default function LandingPage() {
  const [userPosition] = useState(2848);
  const [showReferral, setShowReferral] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Send Slack notification
    try {
      await fetch('/api/notify-slack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          source: 'Moccet Landing Page',
        }),
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      // Continue even if notification fails
    }

    // Send welcome email
    try {
      await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      });
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Continue even if email fails
    }

    setShowReferral(true);
  };

  if (showReferral) {
    return (
      <main className="landing-page-moccet">
        <section className="first-page">
          <a href="/forge" className="product-link product-link-left">forge</a>
          <div className="logo" role="img" aria-label="Moccet logo">
            <div className="ellipse"></div>
            <div className="div"></div>
            <div className="ellipse-2"></div>
            <div className="ellipse-3"></div>
            <div className="ellipse-4"></div>
            <div className="ellipse-5"></div>
            <div className="ellipse-6"></div>
          </div>
          <a href="/sage" className="product-link product-link-right">sage</a>
          <header className="title-centered">
            <img className="moccet-title" src="/images/moccet.png" alt="moccet" />
          </header>
          <div className="content">
            <div className="referral-content">
              <div className="success-message">You&apos;re in</div>
              <span className="position-number">#{userPosition}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="landing-page-moccet">
      <section className="first-page">
        <a href="/forge" className="product-link product-link-left">forge</a>
        <div className="logo" role="img" aria-label="Moccet logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </div>
        <a href="/sage" className="product-link product-link-right">sage</a>
        <header className="title-centered">
          <img className="moccet-title" src="/images/moccet.png" alt="moccet" />
        </header>
        <div className="content">
          <img
            className="your-personal"
            src="/images/your-personal-health-ai.png"
            alt="Your personal health AI"
          />
          <form className="enter-email" onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              id="email-input"
              name="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              className="email-input-field"
            />
            <button type="submit" className="button">
              <span className="text-wrapper-3">Join the waitlist</span>
            </button>
          </form>
          <p className="p">2000+ people waiting for early access</p>
          <nav className="social-links" aria-label="Social media links and footer navigation">
            <a
              href="https://x.com/moccet"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Moccet on X (formerly Twitter)"
            >
              <img
                className="social-link"
                src="/images/vector.svg"
                alt="X social media icon"
              />
            </a>
            <a
              href="https://www.linkedin.com/company/moccet/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Moccet on LinkedIn"
            >
              <svg
                className="linkedin-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M14.5 0H1.5C0.675 0 0 0.675 0 1.5V14.5C0 15.325 0.675 16 1.5 16H14.5C15.325 16 16 15.325 16 14.5V1.5C16 0.675 15.325 0 14.5 0ZM5 13H3V6H5V13ZM4 5C3.45 5 3 4.55 3 4C3 3.45 3.45 3 4 3C4.55 3 5 3.45 5 4C5 4.55 4.55 5 4 5ZM13 13H11V9.5C11 8.675 10.325 8 9.5 8C8.675 8 8 8.675 8 9.5V13H6V6H8V7C8.5 6.5 9.25 6 10 6C11.65 6 13 7.35 13 9V13Z"
                  fill="white"
                />
              </svg>
            </a>
            <div className="div-wrapper">
              <a href="#privacy-policy" className="text-wrapper-4">Privacy Policy</a>
            </div>
            <div className="social-link-2">
              <span className="text-wrapper-5">moccet Inc © 2025</span>
            </div>
          </nav>
        </div>
      </section>
    </main>
  );
}

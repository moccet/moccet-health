'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import './landing.css';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email.trim() && emailRegex.test(email);
  };

  const openVideoModal = () => {
    setShowVideoModal(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
      }
    }, 100);
  };

  const closeVideoModal = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setShowVideoModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Get waitlist position
    try {
      await fetch('/api/waitlist-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      });
    } catch (error) {
      console.error('Error getting waitlist position:', error);
    }

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

    // Show welcome message
    setIsSubmitted(true);
  };

  return (
    <main className="landing-page-moccet">
      <section className="first-page">
        <Link href="/" className="logo" role="img" aria-label="Moccet logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </Link>
        <nav className="nav-menu">
          <Link href="/sage" className="nav-link">Sage</Link>
          <Link href="/forge" className="nav-link">Forge</Link>
          <Link href="/news" className="nav-link">Stories</Link>
          <a href="#waitlist" className="nav-link">
            Join the waitlist
            <svg className="nav-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
              <Link href="/sage" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Sage
              </Link>
              <Link href="/forge" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Forge
              </Link>
              <Link href="/news" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Stories
              </Link>
              <a href="#waitlist" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Join the waitlist
              </a>
            </div>
          </div>
        )}
        <header className="title-centered">
          <img className="moccet-title-img" src="/images/moccet.png" alt="moccet" />
          <button className="watch-now-button" onClick={openVideoModal}>
            <span>WATCH NOW</span>
            <div className="play-icon-wrapper">
              <svg className="play-icon" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 2.5L8.5 6L3.5 9.5V2.5Z" fill="currentColor"/>
              </svg>
            </div>
          </button>
        </header>
        <div className="content" id="waitlist">
          <img
            className="your-personal"
            src="/images/your-personal-health-ai.png"
            alt="Your personal health AI"
          />
          {!isSubmitted ? (
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
              <button type="submit" className="button" disabled={!isValidEmail(email)}>
                <span className="text-wrapper-3">Join the waitlist</span>
              </button>
            </form>
          ) : (
            <div className="success-message">Welcome to moccet</div>
          )}
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
            <div className="social-link-2">
              <a href="/privacy-policy" className="text-wrapper-5" style={{ textDecoration: 'none', color: '#ffffff' }}>
                Privacy Policy
              </a>
              <span className="text-wrapper-5" style={{ margin: '0 8px' }}>·</span>
              <a href="/terms-of-use" className="text-wrapper-5" style={{ textDecoration: 'none', color: '#ffffff' }}>
                Terms
              </a>
              <span className="text-wrapper-5" style={{ margin: '0 8px' }}>·</span>
              <span className="text-wrapper-5">moccet Inc © 2025</span>
            </div>
          </nav>
        </div>
      </section>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="video-modal" onClick={closeVideoModal}>
          <button className="modal-close" onClick={closeVideoModal} aria-label="Close video">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <video
              ref={videoRef}
              className="modal-video"
              src="/videos/moccet.mp4"
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}
    </main>
  );
}

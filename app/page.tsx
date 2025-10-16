'use client';

import { useState } from 'react';
import './landing-anima.css';

export default function LandingPage() {
  const [userPosition] = useState(2848);
  const [showReferral, setShowReferral] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowReferral(true);
  };

  if (showReferral) {
    return (
      <main className="landing-page-moccet" style={{ backgroundImage: "url('/images/chandu-j-s-w-6dug28-5u-unsplash-1.png')" }}>
        <img
          className="chandu-j-s-w"
          src="/images/chandu-j-s-w-6dug28-5u-unsplash-1.png"
          alt="Abstract purple and orange smoke background"
        />
        <h1 className="text-wrapper">moccet</h1>
        <img className="logo" src="/images/logo.png" alt="Moccet logo" />
        <section className="frame">
          <div className="referral-content">
            <div className="success-message">You&apos;re in</div>
            <span className="position-number">#{userPosition}</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="landing-page-moccet" style={{ backgroundImage: "url('/images/chandu-j-s-w-6dug28-5u-unsplash-1.png')" }}>
      <img
        className="chandu-j-s-w"
        src="/images/chandu-j-s-w-6dug28-5u-unsplash-1.png"
        alt="Abstract purple and orange smoke background"
      />
      <h1 className="text-wrapper">moccet</h1>
      <img className="logo" src="/images/logo.png" alt="Moccet logo" />
      <section className="frame">
        <h2 className="your-personal-health">Your <em>personal</em> health AI.</h2>
        <form
          className="enter-email"
          role="search"
          aria-label="Waitlist signup form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="email-input" className="visually-hidden">Enter your email address</label>
          <input
            type="email"
            id="email-input"
            className="text-wrapper-2"
            placeholder="Enter your email address"
            required
            aria-required="true"
            autoComplete="email"
            name="email"
          />
          <button type="submit" className="div-wrapper" aria-label="Join the waitlist">
            <span className="div">Join the waitlist</span>
          </button>
        </form>
        <p className="p">2000+ people waiting for early access</p>
        <nav className="social-links" aria-label="Social media and legal links">
          <a href="https://x.com/moccet" className="social-link" aria-label="Twitter">
            <img className="vector" src="/images/vector.svg" alt="" />
          </a>
          <a href="https://linkedin.com/company/moccet" className="social-link" aria-label="LinkedIn">
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
                fill="currentColor"
              />
            </svg>
          </a>
          <a href="#privacy" className="social-link-2">
            <span className="text-wrapper-3">Privacy Policy</span>
          </a>
          <div className="social-link-3">
            <span className="text-wrapper-4">moccet Inc © 2025</span>
          </div>
        </nav>
      </section>
    </main>
  );
}

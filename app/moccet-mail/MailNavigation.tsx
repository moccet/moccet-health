'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MailNavigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="mail-nav">
      <Link href="/" className="nav-logo" role="img" aria-label="moccet logo">
        <div className="ellipse"></div>
        <div className="div"></div>
        <div className="ellipse-2"></div>
        <div className="ellipse-3"></div>
        <div className="ellipse-4"></div>
        <div className="ellipse-5"></div>
        <div className="ellipse-6"></div>
      </Link>
      <div className="nav-menu">
        <Link href="/sage" className="nav-link">Sage</Link>
        <Link href="/forge" className="nav-link">Forge</Link>
        <Link href="/news" className="nav-link">Stories</Link>
        <Link href="/#waitlist" className="nav-link">
          Join the waitlist
          <svg className="nav-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>

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
            <Link href="/#waitlist" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              Join the waitlist
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

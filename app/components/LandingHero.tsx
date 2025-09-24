'use client';

import { useEffect } from 'react';
import styles from '../landing.module.css';

interface LandingHeroProps {
  onEarlyAccess: () => void;
  onWatchVideo: () => void;
}

export default function LandingHero({ onEarlyAccess, onWatchVideo }: LandingHeroProps) {
  // Force button styling as last resort
  useEffect(() => {
    const applyStyles = () => {
      const button = document.querySelector('[data-button="hero-cta"]') as HTMLButtonElement;
      if (button) {
        button.style.cssText = `
          padding: 8px 18px !important;
          background: #000 !important;
          color: #fff !important;
          border: none !important;
          border-radius: 20px !important;
          font-size: 16px !important;
          font-weight: 500 !important;
          margin-right: 12px !important;
          cursor: pointer !important;
          transition: opacity 0.15s !important;
          font-family: var(--font-inter) !important;
          width: auto !important;
          height: auto !important;
          min-height: auto !important;
          min-width: auto !important;
        `;
      }
    };

    applyStyles();
    setTimeout(applyStyles, 100);
    setTimeout(applyStyles, 500);
  }, []);

  return (
    <section className={styles.hero}>
      <h1>AI that discovers.<br />Experts who execute.</h1>
      <p className={styles.subtitle}>
        Autonomous intelligence embeds in your infrastructure, discovers insights without prompting,
        and deploys world-class operators to execute discoveries.
      </p>

      <div>
        <button
          onClick={onEarlyAccess}
          className="hero-cta-force-styles"
          data-button="hero-cta"
        >
          Get early access →
        </button>
        <button className={styles.watchVideoBtn} onClick={onWatchVideo}>
          Watch video ↗
        </button>
      </div>
    </section>
  );
}
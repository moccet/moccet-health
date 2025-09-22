'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './WaitlistModal.module.css';

interface WaitlistModalProps {
  onClose: () => void;
}

export default function WaitlistModal({ onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [useCase, setUseCase] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !name || !useCase || !agreed) return;

    setIsSubmitting(true);

    try {
      // Send Slack notification
      await fetch('/api/slack-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'early-access',
          data: {
            name,
            email,
            company: company || 'Not provided',
            useCase
          }
        })
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }

    // Simulate additional processing
    await new Promise(resolve => setTimeout(resolve, 500));

    setIsSubmitting(false);
    setShowSuccess(true);

    // Auto close after showing success
    setTimeout(() => {
      onClose();
    }, 3000);
  };


  return (
    <div className={styles.modalOverlay}>
      {/* Close button - X icon */}
      <button
        onClick={onClose}
        className={styles.closeButton}
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className={styles.modalContent}>

        {!showSuccess ? (
          <>
            <div className={styles.modalHeader}>
              <h1 className={styles.modalTitle}>Get Early Access</h1>
              <p className={styles.modalSubtitle}>
                Be among the first to experience autonomous AI that discovers insights without prompting
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                required
                disabled={isSubmitting}
                className={styles.input}
              />

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                disabled={isSubmitting}
                className={styles.input}
              />

              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company (optional)"
                disabled={isSubmitting}
                className={styles.input}
              />

              <select
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                required
                disabled={isSubmitting}
                className={styles.select}
              >
                <option value="">How will you use moccet?</option>
                <option value="data-insights">Data insights & analytics</option>
                <option value="process-automation">Process automation</option>
                <option value="customer-intelligence">Customer intelligence</option>
                <option value="risk-management">Risk management</option>
                <option value="supply-chain">Supply chain optimization</option>
                <option value="fraud-detection">Fraud detection</option>
                <option value="research">Research & development</option>
                <option value="personal">Personal use</option>
                <option value="other">Other</option>
              </select>

              <div className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  id="waitlist-agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  disabled={isSubmitting}
                  className={styles.checkbox}
                />
                <label htmlFor="waitlist-agree" className={styles.checkboxLabel}>
                  I agree to receive updates about moccet and understand that my data will be processed in accordance with the privacy policy.
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email || !name || !useCase || !agreed}
                className={styles.submitButton}
              >
                {isSubmitting ? (
                  <div className={styles.spinner} />
                ) : (
                  <>
                    Join Waitlist
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className={styles.successContainer}>
            <div className={styles.successIcon}>
              <svg width="40" height="40" fill="none" stroke="white" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className={styles.successTitle}>You&apos;re on the list!</h2>
            <p className={styles.successMessage}>
              We&apos;ll notify you as soon as moccet is ready for early access.
              You&apos;ll be among the first to experience autonomous AI intelligence.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
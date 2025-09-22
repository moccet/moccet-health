'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './ContactSales.module.css';

interface ContactSalesPageProps {
  onClose: () => void;
}

export default function ContactSalesPage({ onClose }: ContactSalesPageProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [useCase, setUseCase] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !name || !company || !employeeCount || !useCase || !agreed) return;

    setIsSubmitting(true);

    try {
      // Send Slack notification
      await fetch('/api/slack-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'sales',
          data: {
            name,
            email,
            company,
            phone: phone || 'Not provided',
            employeeCount,
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
              <h1 className={styles.modalTitle}>Contact Sales</h1>
              <p className={styles.modalSubtitle}>
                Let&apos;s discuss how moccet can transform your enterprise
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
                placeholder="Company"
                required
                disabled={isSubmitting}
                className={styles.input}
              />

              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number (optional)"
                disabled={isSubmitting}
                className={styles.input}
              />

              <select
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                required
                disabled={isSubmitting}
                className={styles.select}
              >
                <option value="">Number of employees</option>
                <option value="1-100">1-100</option>
                <option value="101-500">101-500</option>
                <option value="501-1000">501-1,000</option>
                <option value="1001-5000">1,001-5,000</option>
                <option value="5001-10000">5,001-10,000</option>
                <option value="10000+">10,000+</option>
              </select>

              <select
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                required
                disabled={isSubmitting}
                className={styles.select}
              >
                <option value="">Primary use case</option>
                <option value="data-insights">Data insights & analytics</option>
                <option value="process-automation">Process automation</option>
                <option value="customer-intelligence">Customer intelligence</option>
                <option value="risk-management">Risk management</option>
                <option value="supply-chain">Supply chain optimization</option>
                <option value="fraud-detection">Fraud detection</option>
                <option value="custom-ai">Custom AI solutions</option>
                <option value="other">Other</option>
              </select>

              <div className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  id="sales-agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  disabled={isSubmitting}
                  className={styles.checkbox}
                />
                <label htmlFor="sales-agree" className={styles.checkboxLabel}>
                  I agree to be contacted by the moccet sales team and receive updates about enterprise solutions.
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email || !name || !company || !employeeCount || !useCase || !agreed}
                className={styles.submitButton}
              >
                {isSubmitting ? (
                  <div className={styles.spinner} />
                ) : (
                  <>
                    Schedule Call
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
            <h2 className={styles.successTitle}>Thank you!</h2>
            <p className={styles.successMessage}>
              Our sales team will contact you within 24 hours to schedule a personalized demo
              and discuss how moccet can transform your enterprise.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
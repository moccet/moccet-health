'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './ResearchModal.module.css';

interface ResearchModalProps {
  onClose: () => void;
}

export default function ResearchModal({ onClose }: ResearchModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');
  const [researchArea, setResearchArea] = useState('');
  const [description, setDescription] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !name || !institution || !researchArea || !description || !agreed) return;

    setIsSubmitting(true);

    try {
      // Send Slack notification
      await fetch('/api/slack-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'research-application',
          data: {
            name,
            email,
            institution,
            department: department || 'Not specified',
            researchArea,
            description
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
              <h1 className={styles.modalTitle}>Apply for Research Access</h1>
              <p className={styles.modalSubtitle}>
                Free access for academic institutions to advance AI research
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Academic email"
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
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="University / Research institution"
                required
                disabled={isSubmitting}
                className={styles.input}
              />

              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department (optional)"
                disabled={isSubmitting}
                className={styles.input}
              />

              <select
                value={researchArea}
                onChange={(e) => setResearchArea(e.target.value)}
                required
                disabled={isSubmitting}
                className={styles.select}
              >
                <option value="">Research area</option>
                <option value="machine-learning">Machine Learning</option>
                <option value="nlp">Natural Language Processing</option>
                <option value="computer-vision">Computer Vision</option>
                <option value="reinforcement-learning">Reinforcement Learning</option>
                <option value="ai-safety">AI Safety & Ethics</option>
                <option value="robotics">Robotics</option>
                <option value="healthcare-ai">Healthcare AI</option>
                <option value="quantum-ai">Quantum Computing & AI</option>
                <option value="other">Other</option>
              </select>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe your research goals and how you plan to use moccet (200 words max)"
                required
                disabled={isSubmitting}
                className={styles.textarea}
                rows={4}
                maxLength={1000}
              />

              <div className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  id="research-agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  disabled={isSubmitting}
                  className={styles.checkbox}
                />
                <label htmlFor="research-agree" className={styles.checkboxLabel}>
                  I agree to use moccet solely for academic research purposes and will acknowledge moccet in any publications.
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email || !name || !institution || !researchArea || !description || !agreed}
                className={styles.submitButton}
              >
                {isSubmitting ? (
                  <div className={styles.spinner} />
                ) : (
                  <>
                    Submit Application
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
            <h2 className={styles.successTitle}>Application Received!</h2>
            <p className={styles.successMessage}>
              We&apos;ll review your research application and get back to you within 3-5 business days.
              Academic institutions receive full platform access for research purposes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
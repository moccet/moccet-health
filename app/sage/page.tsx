'use client';

import { useState } from 'react';
import './sage.css';

export default function SagePage() {
  const [email, setEmail] = useState('');
  const [buttonText, setButtonText] = useState('Join the waitlist');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Disable button during submission
    setIsSubmitting(true);
    setButtonText('Sending...');

    try {
      // Send Slack notification
      try {
        await fetch('/api/notify-slack', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            source: 'Sage Landing Page',
          }),
        });
      } catch (slackError) {
        console.error('Error sending Slack notification:', slackError);
        // Continue even if notification fails
      }

      // Send sage welcome email
      try {
        await fetch('/api/send-sage-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
          }),
        });
      } catch (emailError) {
        console.error('Error sending sage email:', emailError);
        // Continue even if email fails
      }

      // Show success message
      setButtonText('Sent!');
      setEmail('');

      // Reset button after 2 seconds
      setTimeout(() => {
        setButtonText('Join the waitlist');
        setIsSubmitting(false);
      }, 2000);

    } catch (error) {
      console.error('Error:', error);
      alert('There was an error. Please try again.');
      setButtonText('Join the waitlist');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="landing-page-moccet">
      <section className="first-page">
        <a href="/" className="product-link product-link-left">moccet</a>
        <div className="logo" role="img" aria-label="Sage logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </div>
        <a href="/forge" className="product-link product-link-right">forge</a>
        <header className="title-centered">
          <h1 className="sage-title">sage</h1>
        </header>
        <div className="content">
          <img
            className="your-personal"
            src="https://c.animaapp.com/ArhZSyxG/img/your-personal-nutrition-plan-@4x.png"
            alt="Your personal nutrition plan"
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
              disabled={isSubmitting}
            />
            <button type="submit" className="button" disabled={isSubmitting}>
              <span className="text-wrapper-3">{buttonText}</span>
            </button>
          </form>
          <p className="p">1000+ people on the list for early access</p>
          <nav className="social-links" aria-label="Social media links and footer navigation">
            <a
              href="https://x.com/moccet"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Moccet on X (formerly Twitter)"
            >
              <img
                className="social-link"
                src="https://c.animaapp.com/ArhZSyxG/img/social-link-3-1.svg"
                alt="X social media icon"
              />
            </a>
            <a
              href="https://www.linkedin.com/company/moccet/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Moccet on LinkedIn"
            >
              <img
                className="social-link"
                src="https://c.animaapp.com/ArhZSyxG/img/social-link-2-1.svg"
                alt="LinkedIn social media icon"
              />
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
      <img
        className="second-page"
        src="https://c.animaapp.com/ArhZSyxG/img/second-page@2x.png"
        alt="Detailed information about Sage nutrition planning"
      />
    </main>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sidebarActive, setSidebarActive] = useState(false);

  // Set sidebar to open on desktop by default
  useEffect(() => {
    if (window.innerWidth > 1024) {
      setSidebarActive(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleContactSales = () => {
    console.log('Contact Sales clicked');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setShowSuccess(true);
    setFormData({
      name: '',
      email: '',
      organization: '',
      subject: '',
      message: ''
    });

    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className={styles.container}>
      {/* Global Header */}
      <Header onToggleSidebar={toggleSidebar} onContactSales={handleContactSales} />

      {/* Global Sidebar */}
      <Sidebar isActive={sidebarActive} />

      {/* Hero Section */}
      <main className={`${styles.main} ${sidebarActive ? styles.mainWithSidebar : ''}`}>
        <section className={styles.hero}>
          <h1>Contact Us</h1>
          <p className={styles.subtitle}>
            We&apos;re here to help with any questions about moccet
          </p>
        </section>

        {/* Contact Options */}
        <section className={styles.contentSection}>
          <div className={styles.contactGrid}>
            <div className={styles.contactCard}>
              <h3>Sales Inquiries</h3>
              <p>Ready to transform your healthcare organization?</p>
              <a href="mailto:sales@moccet.com" className={styles.contactLink}>
                sales@moccet.com
              </a>
              <p className={styles.contactPhone}>+1 (707) 400-5566</p>
            </div>

            <div className={styles.contactCard}>
              <h3>Technical Support</h3>
              <p>Need help with our products or services?</p>
              <a href="mailto:support@moccet.com" className={styles.contactLink}>
                support@moccet.com
              </a>
              <p className={styles.contactAvailability}>24/7 support for enterprise customers</p>
            </div>

            <div className={styles.contactCard}>
              <h3>Media & Press</h3>
              <p>For media inquiries and press resources</p>
              <a href="mailto:press@moccet.com" className={styles.contactLink}>
                press@moccet.com
              </a>
              <Link href="/brand" className={styles.contactSecondaryLink}>
                Brand Resources →
              </Link>
            </div>

            <div className={styles.contactCard}>
              <h3>Partnerships</h3>
              <p>Interested in partnering with moccet?</p>
              <a href="mailto:partnerships@moccet.com" className={styles.contactLink}>
                partnerships@moccet.com
              </a>
              <p className={styles.contactNote}>Integration and reseller opportunities</p>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Send Us a Message</h2>
            <p>
              Fill out the form below and we&apos;ll get back to you within 24 business hours.
            </p>

            {showSuccess && (
              <div className={styles.successMessage}>
                <h3>Message Sent Successfully!</h3>
                <p>Thank you for contacting us. We&apos;ll respond within 24 hours.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.contactForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="organization">Organization</label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="subject">Subject *</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className={styles.formSelect}
                  >
                    <option value="">Select a subject</option>
                    <option value="sales">Sales Inquiry</option>
                    <option value="support">Technical Support</option>
                    <option value="partnership">Partnership Opportunity</option>
                    <option value="media">Media/Press</option>
                    <option value="careers">Careers</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className={styles.formTextarea}
                  placeholder="Tell us how we can help..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={styles.submitButton}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </section>

        {/* Office Locations */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Offices</h2>

            <div className={styles.officesGrid}>
              <div className={styles.officeCard}>
                <h3>San Francisco (HQ)</h3>
                <p>
                  555 California Street<br />
                  San Francisco, CA 94104<br />
                  United States
                </p>
              </div>

              <div className={styles.officeCard}>
                <h3>New York</h3>
                <p>
                  350 Fifth Avenue<br />
                  New York, NY 10118<br />
                  United States
                </p>
              </div>

              <div className={styles.officeCard}>
                <h3>London</h3>
                <p>
                  1 Canada Square<br />
                  London E14 5AB<br />
                  United Kingdom
                </p>
              </div>

              <div className={styles.officeCard}>
                <h3>Singapore</h3>
                <p>
                  1 Marina Boulevard<br />
                  Singapore 018989<br />
                  Singapore
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Frequently Asked Questions</h2>

            <div className={styles.faqItem}>
              <h3>What is the best way to reach moccet?</h3>
              <p>
                For sales inquiries, email sales@moccet.com or call +1 (707) 400-5566. For
                technical support, existing customers can use the in-app support or email
                support@moccet.com.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3>What are your support hours?</h3>
              <p>
                Enterprise customers receive 24/7 support. Standard support is available
                Monday-Friday, 9 AM - 6 PM PST. Emergency support is always available for
                critical issues.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3>How quickly can I expect a response?</h3>
              <p>
                We aim to respond to all inquiries within 24 business hours. Critical support
                issues for enterprise customers receive immediate attention.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3>Do you offer product demos?</h3>
              <p>
                Yes! Contact our sales team at sales@moccet.com to schedule a personalized
                demo of our platform tailored to your organization&apos;s needs.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3>How can I report a security issue?</h3>
              <p>
                Security issues should be reported immediately to security@moccet.com. Please
                refer to our Vulnerability Disclosure Policy for responsible disclosure guidelines.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Ready to Get Started?</h2>
          <p className={styles.finalCtaSubtitle}>
            Transform your healthcare organization with moccet
          </p>
          <div className={styles.buttonRow}>
            <button className={styles.ctaBtn} onClick={() => window.location.href='mailto:sales@moccet.com'}>
              Contact Sales
            </button>
            <Link href="/" className={styles.watchVideoBtn}>Learn More</Link>
          </div>
        </section>
      </main>

    </div>
  );
}
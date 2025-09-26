'use client';

import { useState, useEffect } from 'react';
import styles from '../landing.module.css';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function CareersPage() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [activePage, setActivePage] = useState('careers');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    position: '',
    experience: '',
    phone: '',
    message: ''
  });

  // Set sidebar to open on desktop by default
  useEffect(() => {
    if (window.innerWidth > 1024) {
      setSidebarActive(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleNavigate = (targetId: string) => {
    if (targetId.startsWith('#')) {
      const section = targetId.replace('#', '');
      if (section === 'contact') {
        setActivePage('contact');
      } else {
        setActivePage('careers');
        // Reset form state when going back to careers
        setIsSubmitted(false);
        setFormData({
          name: '',
          email: '',
          position: '',
          experience: '',
          phone: '',
          message: ''
        });
      }

      // Scroll to top when switching sections
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        setSidebarActive(false);
      }
    }
  };


  const handleApplyToPosition = (position: string) => {
    setActivePage('contact');
    setFormData(prev => ({
      ...prev,
      position: position
    }));

    // Scroll to top when switching sections
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      setSidebarActive(false);
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prepare the Slack message
      const slackMessage = {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Career Application (Careers Page)*\n\n*Name:* ${formData.name}\n*Email:* ${formData.email}\n*Position:* ${formData.position || 'Not provided'}\n*Experience:* ${formData.experience || 'Not provided'}\n*Phone:* ${formData.phone || 'Not provided'}\n*Message:* ${formData.message || 'No message provided'}`
            }
          }
        ]
      };

      // Replace with your actual Slack webhook URL
      const webhookUrl = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL || 'YOUR_SLACK_WEBHOOK_URL_HERE';

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending form:', error);
      alert('There was an error sending your application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <Header
        onToggleSidebar={toggleSidebar}
        onContactSales={() => handleNavigate('#contact')}
        sidebarActive={sidebarActive}
      />

      <Sidebar
        isActive={sidebarActive}
        onNavigate={handleNavigate}
      />

      <main
        style={{
          marginLeft: sidebarActive ? '240px' : '0',
          transition: 'margin-left 0.3s ease',
          padding: '0 80px',
          minHeight: '100vh'
        }}
      >
          {/* Careers Page */}
          {activePage === 'careers' && (
            <div>
              {/* Hero Section */}
              <section style={{ textAlign: 'center', padding: '80px 0 120px' }}>
                <h1 style={{ fontSize: '56px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-1.5px', color: '#000' }}>
                  Join the team building the future<br />of medical AI
                </h1>
                <p style={{ fontSize: '20px', color: '#374151', marginBottom: '40px', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Work alongside world-class researchers, engineers, and clinicians to create AI that saves lives and transforms healthcare.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleNavigate('#contact')}
                    className={styles.finalCtaPrimary}
                  >
                    Apply Now
                  </button>
                  <button className={styles.finalCtaSecondary}>
                    View Openings ↗
                  </button>
                </div>
              </section>

              {/* Mission Section */}
              <section style={{ marginBottom: '100px' }}>
                <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Our mission</h2>
                <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '60px', maxWidth: '800px' }}>
                  We&apos;re building AI that makes healthcare more accurate, accessible, and human. Every day, our work directly impacts patient outcomes and advances medical science.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px', marginBottom: '100px' }}>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Research & Development</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>Push the boundaries of medical AI with cutting-edge research</p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• ML Engineers & Research Scientists</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Computer Vision Specialists</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• NLP Researchers</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Data Scientists</li>
                    </ul>
                    <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>View openings ↗</a>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Clinical Affairs</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>Bridge AI technology with real-world clinical practice</p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Clinical Research Coordinators</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Medical Affairs Directors</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Regulatory Affairs Specialists</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Clinical Data Managers</li>
                    </ul>
                    <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>View openings ↗</a>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Engineering</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>Build scalable platforms that deploy AI to millions of patients</p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Full-stack Engineers</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• DevOps & Platform Engineers</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Mobile Developers</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Security Engineers</li>
                    </ul>
                    <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>View openings ↗</a>
                  </div>
                </div>
              </section>

              {/* Culture Section */}
              <section style={{ background: '#f9fafb', borderRadius: '24px', padding: '80px', margin: '0 -80px', marginBottom: '100px' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                  <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Why join moccet</h2>
                  <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                    We&apos;re not just building technology—we&apos;re creating a new paradigm for healthcare that puts patients first.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '24px', color: '#000' }}>
                      Work that matters
                    </h3>
                    <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6', marginBottom: '24px' }}>
                      Every model you train, every algorithm you optimize, and every feature you ship directly impacts patient care. Your work saves lives.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0' }}>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Direct patient impact through AI</li>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Collaboration with leading clinicians</li>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Publishing cutting-edge research</li>
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '24px', color: '#000' }}>
                      Exceptional benefits
                    </h3>
                    <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6', marginBottom: '24px' }}>
                      We believe in taking care of our team so you can focus on what you do best—transforming healthcare.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0' }}>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Competitive equity and compensation</li>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Comprehensive health coverage</li>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Flexible remote/hybrid work</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Current Openings */}
              <section style={{ marginBottom: '100px' }}>
                <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Current openings</h2>
                <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '60px', maxWidth: '800px' }}>
                  Join our team and help us build the future of medical AI. We&apos;re looking for exceptional talent across all areas.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Senior ML Engineer - Medical Imaging</h3>
                      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Engineering • San Francisco, CA • Full-time</p>
                      <p style={{ color: '#6b7280', fontSize: '14px' }}>Build computer vision models for medical imaging analysis</p>
                    </div>
                    <button
                      className={styles.finalCtaSecondary}
                      style={{ minWidth: '120px' }}
                      onClick={() => handleApplyToPosition('Senior ML Engineer - Medical Imaging (Engineering • San Francisco, CA • Full-time)')}
                    >
                      Apply →
                    </button>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Clinical Research Scientist</h3>
                      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Clinical Affairs • Remote • Full-time</p>
                      <p style={{ color: '#6b7280', fontSize: '14px' }}>Lead clinical validation studies for AI diagnostic tools</p>
                    </div>
                    <button
                      className={styles.finalCtaSecondary}
                      style={{ minWidth: '120px' }}
                      onClick={() => handleApplyToPosition('Clinical Research Scientist (Clinical Affairs • Remote • Full-time)')}
                    >
                      Apply →
                    </button>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Full-stack Engineer</h3>
                      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Engineering • San Francisco, CA • Full-time</p>
                      <p style={{ color: '#6b7280', fontSize: '14px' }}>Build healthcare applications and APIs for AI model deployment</p>
                    </div>
                    <button
                      className={styles.finalCtaSecondary}
                      style={{ minWidth: '120px' }}
                      onClick={() => handleApplyToPosition('Full-stack Engineer (Engineering • San Francisco, CA • Full-time)')}
                    >
                      Apply →
                    </button>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Product Manager - Clinical AI</h3>
                      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>Product • San Francisco, CA • Full-time</p>
                      <p style={{ color: '#6b7280', fontSize: '14px' }}>Drive product strategy for AI-powered diagnostic tools</p>
                    </div>
                    <button
                      className={styles.finalCtaSecondary}
                      style={{ minWidth: '120px' }}
                      onClick={() => handleApplyToPosition('Product Manager - Clinical AI (Product • San Francisco, CA • Full-time)')}
                    >
                      Apply →
                    </button>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section style={{ textAlign: 'center', padding: '80px 0', background: '#f9fafb', borderRadius: '24px', margin: '0 -80px' }}>
                <h2 style={{ fontSize: '48px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', color: '#000' }}>
                  Ready to transform healthcare?
                </h2>
                <p style={{ fontSize: '20px', color: '#6b7280', marginBottom: '40px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Join our mission to make AI-powered healthcare accessible to everyone, everywhere.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleNavigate('#contact')}
                    className={styles.finalCtaPrimary}
                  >
                    Apply Now
                  </button>
                  <button className={styles.finalCtaSecondary}>
                    Learn About Our Culture ↗
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* Contact Page */}
          {activePage === 'contact' && (
            <div style={{ padding: '80px 0', minHeight: '100vh', backgroundColor: '#ffffff' }}>
              <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontSize: '48px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', color: '#000' }}>
                  Join Our Team
                </h1>
                <p style={{ fontSize: '20px', color: '#6b7280', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Ready to help us build the future of medical AI? We&apos;d love to hear from you.
                </p>
              </div>

              {isSubmitted ? (
                <div style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
                  <h2 style={{ fontSize: '32px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Thank you!</h2>
                  <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '32px' }}>
                    We&apos;ve received your application and will be in touch soon.
                  </p>
                  <button
                    onClick={() => handleNavigate('#careers')}
                    className={styles.finalCtaSecondary}
                  >
                    Back to Careers
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Position of Interest
                    </label>
                    <select
                      name="position"
                      value={formData.position}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="">Select a position...</option>
                      <option value="Senior ML Engineer - Medical Imaging (Engineering • San Francisco, CA • Full-time)">
                        Senior ML Engineer - Medical Imaging
                      </option>
                      <option value="Clinical Research Scientist (Clinical Affairs • Remote • Full-time)">
                        Clinical Research Scientist
                      </option>
                      <option value="Full-stack Engineer (Engineering • San Francisco, CA • Full-time)">
                        Full-stack Engineer
                      </option>
                      <option value="Product Manager - Clinical AI (Product • San Francisco, CA • Full-time)">
                        Product Manager - Clinical AI
                      </option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Years of Experience
                    </label>
                    <input
                      type="text"
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                      Cover Letter / Additional Information
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={styles.finalCtaPrimary}
                    style={{ width: '100%' }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </form>
              )}
            </div>
          )}
      </main>
    </div>
  );
}
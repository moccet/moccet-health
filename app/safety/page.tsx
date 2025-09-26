'use client';

import { useState, useEffect } from 'react';
import styles from '../landing.module.css';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function SafetyPage() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [activePage, setActivePage] = useState('safety');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    jobTitle: '',
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

  const handleContactSales = () => {
    setActivePage('contact');
  };

  const showPage = (page: string) => {
    setActivePage(page);
    // Reset form state when switching pages
    if (page !== 'contact') {
      setIsSubmitted(false);
      setFormData({
        name: '',
        email: '',
        company: '',
        jobTitle: '',
        phone: '',
        message: ''
      });
    }
    // Only close sidebar on mobile, keep it open on desktop
    if (window.innerWidth <= 1024) {
      setSidebarActive(false);
    }
    window.scrollTo(0, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      // Send to Slack webhook
      const slackMessage = {
        text: `New Contact Form Submission from Safety Page`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Contact Form Submission (Safety Page)*\\n\\n*Name:* ${formData.name}\\n*Email:* ${formData.email}\\n*Company:* ${formData.company || 'Not provided'}\\n*Job Title:* ${formData.jobTitle || 'Not provided'}\\n*Phone:* ${formData.phone || 'Not provided'}\\n*Message:* ${formData.message || 'No message provided'}`
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
      alert('There was an error sending your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className={styles.container}>
      {/* Global Header */}
      <Header onToggleSidebar={toggleSidebar} onContactSales={handleContactSales} />

      {/* Global Sidebar */}
      <Sidebar
        isActive={sidebarActive}
        onNavigate={(href) => {
          if (href.startsWith('#')) {
            const pageId = href.substring(1);
            if (pageId === 'contact') {
              showPage('contact');
            } else if (pageId === '') {
              showPage('safety');
            }
          }
        }}
        activePage={activePage}
      />

      {/* Main content with global sidebar layout */}
      <main className={`${styles.main} ${sidebarActive ? styles.mainWithSidebar : ''} pt-[60px]`}>
        <div style={{ padding: '0 80px' }}>
          {/* Safety Page */}
          {activePage === 'safety' && (
            <div>
              {/* Hero Section */}
              <section style={{ textAlign: 'center', padding: '80px 0 120px' }}>
                <h1 style={{ fontSize: '56px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-1.5px', color: '#000' }}>
                  Safety-first healthcare AI
                </h1>
                <p style={{ fontSize: '20px', color: '#374151', marginBottom: '40px', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Omnisight operates with autonomous safety protocols designed specifically for clinical environments where accuracy and reliability are life-critical.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => showPage('contact')}
                    style={{ background: '#000', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
                  >
                    Contact Safety Team
                  </button>
                </div>
              </section>

              {/* Clinical Safety Standards */}
              <section style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '60px 0', marginBottom: '100px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '24px', fontWeight: '500', color: '#374151', opacity: '0.8' }}>FDA-Aligned</div>
                <div style={{ fontSize: '24px', fontWeight: '500', color: '#374151', opacity: '0.8' }}>HIPAA Compliant</div>
                <div style={{ fontSize: '24px', fontWeight: '500', color: '#374151', opacity: '0.8' }}>ISO 13485</div>
                <div style={{ fontSize: '24px', fontWeight: '500', color: '#374151', opacity: '0.8' }}>IEC 62304</div>
                <div style={{ fontSize: '24px', fontWeight: '500', color: '#374151', opacity: '0.8' }}>SOC 2 Type II</div>
              </section>

              {/* Core Safety Principles */}
              <section style={{ marginBottom: '120px' }}>
                <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', textAlign: 'center', color: '#000' }}>Built for clinical safety</h2>
                <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '60px', textAlign: 'center', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Every component of Omnisight includes multiple safety mechanisms designed to prevent, detect, and mitigate potential risks in healthcare settings.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px' }}>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Clinical Validation</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                      All diagnostic recommendations undergo multi-step clinical validation before reaching healthcare providers.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Evidence-based decision thresholds</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Clinical expert review protocols</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Continuous outcome monitoring</li>
                    </ul>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Uncertainty Quantification</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                      Omnisight explicitly measures and communicates confidence levels for all predictions and recommendations.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Confidence intervals for all predictions</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Graceful degradation under uncertainty</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Clear escalation to human experts</li>
                    </ul>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Bias Detection & Mitigation</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                      Comprehensive testing across diverse patient populations ensures equitable healthcare outcomes.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Demographic parity assessments</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Adversarial bias testing</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Continuous fairness monitoring</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Safety Architecture */}
              <section style={{ marginBottom: '120px' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                  <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>
                    Multi-layered safety architecture
                  </h2>
                  <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Omnisight implements defense-in-depth principles with multiple independent safety systems that work together to ensure patient safety.
                  </p>
                </div>

                <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '24px', color: '#000' }}>
                    Autonomous safety monitoring
                  </h3>
                  <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6', marginBottom: '24px' }}>
                    Our systems continuously monitor their own performance and automatically engage safety protocols when detecting anomalies or operating outside validated parameters.
                  </p>
                  <ul style={{ listStyle: 'none', padding: '0', display: 'inline-block', textAlign: 'left' }}>
                    <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Real-time performance monitoring</li>
                    <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Automatic anomaly detection</li>
                    <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Safe-state fallback mechanisms</li>
                  </ul>
                </div>
              </section>

              {/* Safety Governance */}
              <section style={{ marginBottom: '120px' }}>
                <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', textAlign: 'center', color: '#000' }}>Safety governance and oversight</h2>
                <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '60px', textAlign: 'center', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Our clinical safety board includes practicing physicians, medical ethicists, and patient advocates who provide ongoing oversight of all AI systems.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', margin: '0 auto 20px' }}>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Clinical Review Board</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Practicing physicians from leading medical institutions review all diagnostic algorithms</p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', margin: '0 auto 20px' }}>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Safety Metrics Dashboard</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Real-time monitoring of safety indicators across all deployed systems</p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', margin: '0 auto 20px' }}>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Incident Response</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>24/7 safety incident response team with direct escalation to medical directors</p>
                  </div>
                </div>
              </section>

              {/* Call to Action */}
              <section style={{ textAlign: 'center', padding: '80px 0', background: '#f9fafb', borderRadius: '24px', margin: '0 -80px' }}>
                <h2 style={{ fontSize: '48px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', color: '#000' }}>
                  Safety is our foundation,<br />not an afterthought
                </h2>
                <p style={{ fontSize: '20px', color: '#6b7280', marginBottom: '40px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Learn more about our safety protocols or connect with our clinical safety team to discuss implementation at your institution.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => showPage('contact')}
                    style={{ background: '#000', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
                  >
                    Contact Safety Team →
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* Contact Safety Team Page */}
          {activePage === 'contact' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center' }}>
                {!isSubmitted ? (
                  <>
                    <h1 style={{ fontSize: '48px', fontWeight: '400', marginBottom: '24px' }}>Get in touch with our safety team</h1>
                    <p style={{ fontSize: '18px', color: '#666', marginBottom: '48px' }}>
                      Connect with our clinical safety experts to discuss safety protocols, incident reporting, or safety certifications.
                    </p>
                    <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '16px'
                          }}
                          required
                        />
                      </div>
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Email *</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '16px'
                          }}
                          required
                        />
                      </div>
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Healthcare Institution</label>
                        <input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '16px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Role</label>
                        <input
                          type="text"
                          name="jobTitle"
                          value={formData.jobTitle}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '16px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '16px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Safety inquiry</label>
                        <textarea
                          name="message"
                          value={formData.message}
                          onChange={handleInputChange}
                          rows={4}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '16px',
                            resize: 'vertical'
                          }}
                          placeholder="Describe your safety inquiry, incident report, or certification question..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                          width: '100%',
                          padding: '16px',
                          background: isSubmitting ? '#ccc' : '#000',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '16px',
                          fontWeight: '500',
                          cursor: isSubmitting ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isSubmitting ? 'Sending...' : 'Contact Safety Team'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 24px',
                      fontSize: '36px'
                    }}>
                      ✓
                    </div>
                    <h2 style={{ fontSize: '32px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Message Sent!</h2>
                    <p style={{ fontSize: '18px', color: '#666', marginBottom: '32px' }}>
                      Thank you for contacting our safety team. We will get back to you within 24 hours with a detailed response.
                    </p>
                    <button
                      onClick={() => showPage('safety')}
                      style={{
                        padding: '12px 24px',
                        background: '#000',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Back to Safety
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

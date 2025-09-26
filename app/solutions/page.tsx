'use client';

import { useState, useEffect } from 'react';
import styles from '../landing.module.css';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

/*
interface Solution {
  id: string;
  title: string;
  category: string;
  description: string;
  features: string[];
  benefits: string[];
  icon: string;
}
*/

export default function SolutionsPage() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [activePage, setActivePage] = useState('solutions');
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
        text: `New Contact Form Submission from Solutions Page`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Contact Form Submission (Solutions Page)*\n\n*Name:* ${formData.name}\n*Email:* ${formData.email}\n*Company:* ${formData.company || 'Not provided'}\n*Job Title:* ${formData.jobTitle || 'Not provided'}\n*Phone:* ${formData.phone || 'Not provided'}\n*Message:* ${formData.message || 'No message provided'}`
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

  /*
  const solutions: Solution[] = [
    {
      id: 'clinical-insights',
      title: 'Clinical Insights Platform',
      category: 'Healthcare',
      description: 'Real-time clinical decision support powered by AI analysis of patient data, medical literature, and treatment outcomes.',
      features: [
        'Predictive risk scoring',
        'Treatment recommendation engine',
        'Drug interaction analysis',
        'Clinical pathway optimization'
      ],
      benefits: [
        'Reduce diagnostic errors by 45%',
        'Improve treatment outcomes by 32%',
        'Save 2+ hours per clinician daily'
      ],
      icon: ''
    },
    {
      id: 'operational-excellence',
      title: 'Operational Excellence Suite',
      category: 'Operations',
      description: 'Optimize workflows, reduce costs, and improve efficiency across your entire organization.',
      features: [
        'Resource allocation optimization',
        'Predictive maintenance',
        'Supply chain management',
        'Capacity planning'
      ],
      benefits: [
        'Cut operational costs by 30%',
        'Reduce downtime by 50%',
        'Improve resource utilization by 40%'
      ],
      icon: ''
    },
    {
      id: 'customer-intelligence',
      title: 'Customer Intelligence Platform',
      category: 'Customer Experience',
      description: 'Understand and predict customer behavior to deliver personalized experiences at scale.',
      features: [
        'Behavioral analytics',
        'Churn prediction',
        'Personalization engine',
        'Sentiment analysis'
      ],
      benefits: [
        'Increase retention by 25%',
        'Boost conversion rates by 35%',
        'Improve NPS scores by 20 points'
      ],
      icon: ''
    },
    {
      id: 'risk-management',
      title: 'Risk Management System',
      category: 'Risk & Compliance',
      description: 'Identify, assess, and mitigate risks across your organization with AI-powered analytics.',
      features: [
        'Real-time risk monitoring',
        'Fraud detection',
        'Compliance automation',
        'Audit trail management'
      ],
      benefits: [
        'Reduce fraud losses by 60%',
        'Cut compliance costs by 40%',
        'Improve audit readiness by 80%'
      ],
      icon: ''
    },
    {
      id: 'data-analytics',
      title: 'Advanced Analytics Platform',
      category: 'Analytics',
      description: 'Turn your data into actionable insights with powerful AI-driven analytics and visualization.',
      features: [
        'Predictive analytics',
        'Real-time dashboards',
        'Natural language queries',
        'Automated reporting'
      ],
      benefits: [
        'Accelerate insights by 10x',
        'Reduce analysis time by 75%',
        'Improve decision accuracy by 40%'
      ],
      icon: ''
    },
    {
      id: 'workforce-optimization',
      title: 'Workforce Optimization',
      category: 'Human Resources',
      description: 'Enhance productivity and employee satisfaction with AI-powered workforce management.',
      features: [
        'Skill gap analysis',
        'Performance prediction',
        'Scheduling optimization',
        'Employee engagement analytics'
      ],
      benefits: [
        'Increase productivity by 30%',
        'Reduce turnover by 25%',
        'Improve satisfaction scores by 35%'
      ],
      icon: ''
    },
    {
      id: 'research-acceleration',
      title: 'Research Acceleration Platform',
      category: 'Research & Development',
      description: 'Speed up research and development with AI-powered discovery and analysis tools.',
      features: [
        'Literature analysis',
        'Hypothesis generation',
        'Experiment optimization',
        'Collaboration tools'
      ],
      benefits: [
        'Reduce research time by 50%',
        'Increase discovery rate by 3x',
        'Cut development costs by 35%'
      ],
      icon: ''
    },
    {
      id: 'financial-intelligence',
      title: 'Financial Intelligence Suite',
      category: 'Finance',
      description: 'Optimize financial operations with AI-powered forecasting, analysis, and automation.',
      features: [
        'Revenue forecasting',
        'Expense optimization',
        'Cash flow management',
        'Investment analysis'
      ],
      benefits: [
        'Improve forecast accuracy by 40%',
        'Reduce financial close time by 50%',
        'Optimize working capital by 25%'
      ],
      icon: ''
    }
  ];
  */


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
              showPage('solutions');
            }
          }
        }}
        activePage={activePage}
      />

      {/* Main content with global sidebar layout */}
      <main className={`${styles.main} ${sidebarActive ? styles.mainWithSidebar : ''} pt-[60px]`}>
        <div style={{ padding: '0 80px' }}>
          {/* Solutions Page */}
          {activePage === 'solutions' && (
            <div>
              {/* Hero Section */}
              <section style={{ textAlign: 'center', padding: '80px 0 120px' }}>
                <h1 style={{ fontSize: '56px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-1.5px', color: '#000' }}>
                  Solutions built for<br />healthcare transformation
                </h1>
                <p style={{ fontSize: '20px', color: '#374151', marginBottom: '40px', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Omnisight delivers autonomous AI analysis across clinical operations without requiring prompts or manual oversight.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => showPage('contact')}
                    style={{ background: '#000', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
                  >
                    Request early access
                  </button>
                  <button
                    onClick={() => showPage('contact')}
                    style={{ background: 'white', color: '#000', border: '1px solid #e5e7eb', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    Contact sales
                  </button>
                </div>
              </section>

              {/* Trusted by Healthcare Leaders */}

              {/* Core Solutions */}
              <section style={{ marginBottom: '120px' }}>
                <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', textAlign: 'center', color: '#000' }}>Core healthcare solutions</h2>
                <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '60px', textAlign: 'center', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Omnisight autonomously identifies patterns and insights across your clinical data, operations, and patient outcomes.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px' }}>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Clinical Decision Support</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                      Real-time analysis of patient data, treatment histories, and clinical guidelines to support diagnostic decisions.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Predictive risk scoring for patient outcomes</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Drug interaction and contraindication alerts</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Evidence-based treatment recommendations</li>
                    </ul>
                    <button
                      onClick={() => showPage('contact')}
                      style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Learn more ↗
                    </button>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Operational Intelligence</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                      Autonomous optimization of hospital workflows, resource allocation, and operational efficiency.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Bed management and patient flow optimization</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Staffing predictions and scheduling</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Supply chain and inventory management</li>
                    </ul>
                    <button
                      onClick={() => showPage('contact')}
                      style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Learn more ↗
                    </button>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>Population Health Analytics</h3>
                    <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                      Comprehensive analysis of patient populations to identify trends, risks, and intervention opportunities.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Disease outbreak detection and monitoring</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Chronic disease management insights</li>
                      <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Healthcare quality measure tracking</li>
                    </ul>
                    <button
                      onClick={() => showPage('contact')}
                      style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Learn more ↗
                    </button>
                  </div>
                </div>
              </section>

              {/* Why Autonomous */}
              <section style={{ marginBottom: '120px' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                  <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>
                    Why autonomous analysis matters
                  </h2>
                  <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Unlike traditional systems that require constant prompting, Omnisight continuously monitors and analyzes your data to surface critical insights automatically.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', maxWidth: '600px' }}>
                    <h3 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '24px', color: '#000' }}>
                      No prompts required
                    </h3>
                    <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6', marginBottom: '24px' }}>
                      Omnisight runs continuously in the background, analyzing data streams and identifying patterns without any manual intervention from your clinical staff.
                    </p>
                    <ul style={{ listStyle: 'none', padding: '0' }}>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ 24/7 autonomous monitoring</li>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Real-time insight generation</li>
                      <li style={{ padding: '8px 0', color: '#374151', fontSize: '16px' }}>✓ Proactive alert system</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Implementation */}
              <section style={{ textAlign: 'center', padding: '80px 0', background: '#f9fafb', borderRadius: '24px', margin: '0 -80px' }}>
                <h2 style={{ fontSize: '48px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', color: '#000' }}>
                  Ready to transform<br />your healthcare operations?
                </h2>
                <p style={{ fontSize: '20px', color: '#6b7280', marginBottom: '40px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Join leading healthcare institutions already using Omnisight to improve patient outcomes and operational efficiency.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => showPage('contact')}
                    style={{ background: '#000', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
                  >
                    Get early access →
                  </button>
                  <button
                    onClick={() => showPage('contact')}
                    style={{ background: 'white', color: '#000', border: '1px solid #e5e7eb', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    Schedule demo →
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* Contact Sales Page */}
          {activePage === 'contact' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center' }}>
                {!isSubmitted ? (
                  <>
                    <h1 style={{ fontSize: '48px', fontWeight: '400', marginBottom: '24px' }}>Get in touch with our sales team</h1>
                    <p style={{ fontSize: '18px', color: '#666', marginBottom: '48px' }}>
                      Learn how moccet solutions can transform your organization with AI-powered insights.
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
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Company</label>
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
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Job Title</label>
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
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>How can we help you?</label>
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
                          placeholder="Tell us about your solution needs and goals..."
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
                        {isSubmitting ? 'Sending...' : 'Send Message'}
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
                      Thank you for your interest in moccet. Our sales team will get back to you within 24 hours.
                    </p>
                    <button
                      onClick={() => showPage('solutions')}
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
                      Back to Solutions
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
'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function PricingPage() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [activePage, setActivePage] = useState('pricing');
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
        text: `New Contact Form Submission from Pricing Page`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Contact Form Submission*\n\n*Name:* ${formData.name}\n*Email:* ${formData.email}\n*Company:* ${formData.company || 'Not provided'}\n*Job Title:* ${formData.jobTitle || 'Not provided'}\n*Phone:* ${formData.phone || 'Not provided'}\n*Message:* ${formData.message || 'No message provided'}`
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

  const toggleFAQ = (element: HTMLButtonElement) => {
    const answer = element.nextElementSibling as HTMLElement;
    const isActive = element.classList.contains('active');

    // Close all other FAQs
    document.querySelectorAll('.faq-question').forEach(q => {
      q.classList.remove('active');
      (q.nextSibling as HTMLElement)?.classList?.remove('active');
      const toggle = q.querySelector('.faq-toggle');
      if (toggle) toggle.textContent = '+';
    });

    // Toggle current FAQ
    if (!isActive) {
      element.classList.add('active');
      answer.classList.add('active');
      const toggle = element.querySelector('.faq-toggle');
      if (toggle) toggle.textContent = '−';
    }
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif', backgroundColor: '#ffffff', color: '#000', lineHeight: '1.6' }}>
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
              showPage('pricing');
            }
          }
        }}
        activePage={activePage}
      />

      {/* Main content with global sidebar layout */}
      <main className={`transition-all duration-200 ${sidebarActive ? 'ml-[240px]' : 'ml-0'} pt-[60px]`}>
        <div style={{ padding: '64px 48px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Pricing Page */}
          {activePage === 'pricing' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Hero Section */}
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>moccet</div>
            <h1 style={{ fontSize: '64px', fontWeight: '400', marginBottom: '24px', letterSpacing: '-2px' }}>Pricing</h1>
            <p style={{ fontSize: '18px', color: '#333' }}>See pricing for our pilot, enterprise, and research plans.</p>
          </div>

          {/* Main Pricing Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '60px' }}>
            {/* Research/Free Tier */}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '32px 24px', background: 'white' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px' }}>Research</h2>
              <p style={{ fontSize: '15px', color: '#666', marginBottom: '32px', minHeight: '48px' }}>
                Explore how AI can transform your research with full platform access
              </p>

              <div style={{ marginBottom: '32px' }}>
                <span style={{ fontSize: '48px', fontWeight: '400' }}>$0</span>
                <span style={{ fontSize: '16px', color: '#666', marginLeft: '4px' }}>/ month</span>
              </div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: 'white',
                  color: '#000',
                  border: '1px solid #e5e5e5',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Apply →
              </button>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Full access to Omnisight platform for academic use</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Autonomous data analysis without prompting</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Research license and documentation</span>
                </li>
              </ul>
            </div>

            {/* Pilot Tier */}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '32px 24px', background: 'white' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px' }}>Pilot</h2>
              <p style={{ fontSize: '15px', color: '#666', marginBottom: '32px', minHeight: '48px' }}>
                Prove value with a 30-day deployment across your organization
              </p>

              <div style={{ marginBottom: '32px' }}>
                <span style={{ fontSize: '48px', fontWeight: '400' }}>$50K</span>
                <span style={{ fontSize: '16px', color: '#666', marginLeft: '4px' }}>/ pilot</span>
              </div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Request early access →
              </button>

              <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Everything in Research and:
              </div>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Full deployment across 5 data sources</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Weekly consultations with expert operators</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>ROI analysis and impact reporting</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Money-back guarantee if ROI targets not met</span>
                </li>
              </ul>
            </div>

            {/* Enterprise Tier */}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '32px 24px', background: 'white' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px' }}>Enterprise</h2>
              <p style={{ fontSize: '15px', color: '#666', marginBottom: '32px', minHeight: '48px' }}>
                Scale AI across your entire organization with dedicated support
              </p>

              <div style={{ marginBottom: '32px' }}>
                <span style={{ fontSize: '48px', fontWeight: '400' }}>Custom</span>
              </div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Contact sales →
              </button>

              <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Everything in Pilot and:
              </div>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Unlimited data sources and integrations</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Dedicated team of expert operators</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Custom model training for your industry</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>24/7 priority support with SLAs</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Air-gapped deployment options</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Business & Enterprise Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '80px' }}>
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '32px', background: 'white' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px' }}>Business</h3>
              <p style={{ fontSize: '15px', color: '#666', marginBottom: '24px' }}>
                A secure, collaborative workspace for startups and growing businesses
              </p>

              <div style={{ marginBottom: '76px' }}></div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Request early access →
              </button>

              <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Everything in Pilot and:
              </div>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Connectors to internal knowledge systems</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>A secure, dedicated workspace with essential admin controls, SAML SSO, and MFA</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Support for compliance with GDPR, CCPA, and other privacy laws</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Business features like data analysis, custom workflows, and reporting</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Encryption at rest and in transit, no training on your business data</span>
                </li>
              </ul>
            </div>

            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '32px', background: 'white' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px' }}>Enterprise</h3>
              <p style={{ fontSize: '15px', color: '#666', marginBottom: '24px' }}>
                Enterprise-grade AI, security, and support at scale
              </p>

              <div style={{ marginBottom: '52px' }}></div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: 'white',
                  color: '#000',
                  border: '1px solid #e5e5e5',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Contact Sales
              </button>

              <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Everything in Business and:
              </div>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Expanded context window for larger data sets and complex analyses</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Enterprise-level security and controls, including SCIM, user analytics, and role-based access</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Advanced data privacy with custom retention policies and encryption</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>24/7 priority support, SLAs, custom legal terms, and dedicated success team</span>
                </li>
                <li style={{ padding: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Invoicing and billing, volume discounts</span>
                </li>
              </ul>
            </div>
          </div>

          {/* FAQ Section */}
          <div style={{ marginTop: '100px', width: '100%', maxWidth: '800px' }}>
            <h2 style={{ fontSize: '48px', fontWeight: '400', textAlign: 'center', marginBottom: '60px' }}>FAQ</h2>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question active"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '24px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                How does moccet&apos;s pricing work?
                <span className="faq-toggle" style={{ fontSize: '24px', fontWeight: '300' }}>−</span>
              </button>
              <div className="faq-answer active" style={{ maxHeight: '500px', paddingBottom: '24px', overflow: 'hidden', transition: 'max-height 0.3s' }}>
                <p style={{ fontSize: '15px', color: '#666', lineHeight: '1.6' }}>
                  moccet Omnisight is currently in early access. The Research tier is free for academic institutions. Our Pilot program ($50K) provides a 30-day proof of value with full deployment and money-back guarantee. Business and Enterprise plans offer custom pricing based on your organization&apos;s needs and scale. Contact our sales team to discuss pricing options.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '24px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                Is moccet free to use?
                <span className="faq-toggle" style={{ fontSize: '24px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s' }}>
                <p style={{ fontSize: '15px', color: '#666', lineHeight: '1.6', paddingBottom: '24px' }}>
                  Yes, moccet offers a free Research tier for academic institutions. This includes full platform access with an academic license. Commercial use requires either our Pilot, Business, or Enterprise plans.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '24px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                Does moccet offer a plan for educational institutions?
                <span className="faq-toggle" style={{ fontSize: '24px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s' }}>
                <p style={{ fontSize: '15px', color: '#666', lineHeight: '1.6', paddingBottom: '24px' }}>
                  Yes! Our Research tier is specifically designed for academic and educational institutions. It provides full platform access at no cost for research and educational purposes. Apply through our website to get started.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '24px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                How secure is moccet?
                <span className="faq-toggle" style={{ fontSize: '24px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s' }}>
                <p style={{ fontSize: '15px', color: '#666', lineHeight: '1.6', paddingBottom: '24px' }}>
                  moccet uses proprietary small models that ensure your data never leaves your server. We offer enterprise-grade security including SOC 2 Type II, ISO 27001, GDPR compliance, encryption at rest and in transit, SAML SSO, MFA, and air-gapped deployment options for Enterprise customers.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '24px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                How do I get started with moccet?
                <span className="faq-toggle" style={{ fontSize: '24px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s' }}>
                <p style={{ fontSize: '15px', color: '#666', lineHeight: '1.6', paddingBottom: '24px' }}>
                  Request early access through our website. For Research tier, apply with your academic credentials. For Pilot program, schedule a consultation to discuss your use case and ROI targets. Our team will guide you through deployment, which typically takes just days, not months.
                </p>
              </div>
            </div>
          </div>
            </div>
          )}

          {/* Contact Sales Page */}
          {activePage === 'contact' && (
            <div style={{ width: '100%', maxWidth: '600px' }}>
              <div style={{ textAlign: 'center' }}>
                {!isSubmitted ? (
                  <>
                    <h1 style={{ fontSize: '48px', fontWeight: '400', marginBottom: '24px' }}>Get in touch with our sales team</h1>
                    <p style={{ fontSize: '18px', color: '#666', marginBottom: '48px' }}>
                      Learn how moccet can transform your organization with AI that delivers autonomous insights.
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
                            border: '1px solid #e5e5e5',
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
                            border: '1px solid #e5e5e5',
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
                            border: '1px solid #e5e5e5',
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
                            border: '1px solid #e5e5e5',
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
                            border: '1px solid #e5e5e5',
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
                            border: '1px solid #e5e5e5',
                            borderRadius: '6px',
                            fontSize: '16px',
                            resize: 'vertical'
                          }}
                          placeholder="Tell us about your use case and goals..."
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
                      onClick={() => showPage('pricing')}
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
                      Back to Pricing
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
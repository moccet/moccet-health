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
      const answerEl = q.nextElementSibling as HTMLElement;
      if (answerEl) {
        answerEl.classList.remove('active');
        answerEl.style.maxHeight = '0';
        answerEl.style.paddingBottom = '0';
      }
      const toggle = q.querySelector('.faq-toggle');
      if (toggle) toggle.textContent = '+';
    });

    // Toggle current FAQ
    if (!isActive) {
      element.classList.add('active');
      answer.classList.add('active');
      answer.style.maxHeight = answer.scrollHeight + 'px';
      answer.style.paddingBottom = '20px';
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
      <main className={`transition-all duration-200 ${sidebarActive ? 'lg:ml-[240px] ml-0' : 'ml-0'} pt-[60px]`}>
        <div style={{ padding: '32px 16px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="md:px-12 lg:px-16 xl:px-20 md:py-16 lg:py-20">
          {/* Pricing Page */}
          {activePage === 'pricing' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Hero Section */}
          <div style={{ textAlign: 'center', marginBottom: '60px' }} className="md:mb-20">
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }} className="md:mb-6">moccet</div>
            <h1 style={{ fontSize: '32px', fontWeight: '400', marginBottom: '16px', letterSpacing: '-1px' }} className="md:text-5xl lg:text-6xl md:mb-6 md:tracking-tight">Pricing</h1>
            <p style={{ fontSize: '16px', color: '#333' }} className="md:text-lg">See pricing for our pilot, enterprise, and research plans.</p>
          </div>

          {/* Main Pricing Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 mb-10 md:mb-16 w-full max-w-sm sm:max-w-none">
            {/* Research/Free Tier */}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '24px 16px', background: 'white' }} className="md:p-8">
              <h2 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }} className="md:text-2xl md:mb-3">Research</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', minHeight: '40px' }} className="md:text-base md:mb-8 md:min-h-12">
                Explore how AI can transform your research with full platform access
              </p>

              <div style={{ marginBottom: '24px' }} className="md:mb-8">
                <span style={{ fontSize: '36px', fontWeight: '400' }} className="md:text-5xl">$0</span>
                <span style={{ fontSize: '14px', color: '#666', marginLeft: '4px' }} className="md:text-base">/ month</span>
              </div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: 'white',
                  color: '#000',
                  border: '1px solid #e5e5e5',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  minHeight: '44px'
                }}
                className="md:text-base md:mb-6"
              >
                Apply →
              </button>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Full access to Omnisight platform for academic use</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Autonomous data analysis without prompting</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Research license and documentation</span>
                </li>
              </ul>
            </div>

            {/* Pilot Tier */}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '24px 16px', background: 'white' }} className="md:p-8">
              <h2 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }} className="md:text-2xl md:mb-3">Pilot</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', minHeight: '40px' }} className="md:text-base md:mb-8 md:min-h-12">
                Prove value with a 30-day deployment across your organization
              </p>

              <div style={{ marginBottom: '24px' }} className="md:mb-8">
                <span style={{ fontSize: '36px', fontWeight: '400' }} className="md:text-5xl">$100K</span>
                <span style={{ fontSize: '14px', color: '#666', marginLeft: '4px' }} className="md:text-base">/ pilot</span>
              </div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  minHeight: '44px'
                }}
                className="md:text-base md:mb-6"
              >
                Request early access →
              </button>

              <div style={{ fontSize: '12px', fontWeight: '600', color: '#000', margin: '20px 0 8px', display: 'flex', alignItems: 'center', gap: '4px' }} className="md:text-sm md:my-3">
                Everything in Research and:
              </div>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Full deployment across 5 data sources</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Weekly consultations with expert operators</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>ROI analysis and impact reporting</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Money-back guarantee if ROI targets not met</span>
                </li>
              </ul>
            </div>

            {/* Enterprise Tier */}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '24px 16px', background: 'white' }} className="md:p-8">
              <h2 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }} className="md:text-2xl md:mb-3">Enterprise</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', minHeight: '40px' }} className="md:text-base md:mb-8 md:min-h-12">
                Scale AI across your entire organization with dedicated support
              </p>

              <div style={{ marginBottom: '24px' }} className="md:mb-8">
                <span style={{ fontSize: '36px', fontWeight: '400' }} className="md:text-5xl">Custom</span>
              </div>

              <button
                onClick={() => showPage('contact')}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  minHeight: '44px'
                }}
                className="md:text-base md:mb-6"
              >
                Contact sales →
              </button>

              <div style={{ fontSize: '12px', fontWeight: '600', color: '#000', margin: '20px 0 8px', display: 'flex', alignItems: 'center', gap: '4px' }} className="md:text-sm md:my-3">
                Everything in Pilot and:
              </div>

              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Unlimited data sources and integrations</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Dedicated team of expert operators</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Custom model training for your industry</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>24/7 priority support with SLAs</span>
                </li>
                <li style={{ padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }} className="md:text-sm md:py-2 md:gap-2">
                  <span style={{ marginTop: '2px', flexShrink: '0', color: '#000' }}>✓</span>
                  <span>Air-gapped deployment options</span>
                </li>
              </ul>
            </div>
          </div>


          {/* FAQ Section */}
          <div style={{ marginTop: '60px', width: '100%', maxWidth: '800px' }} className="md:mt-24">
            <h2 style={{ fontSize: '28px', fontWeight: '400', textAlign: 'center', marginBottom: '40px' }} className="md:text-5xl md:mb-15">FAQ</h2>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question active md:text-base md:py-6"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '44px'
                }}
              >
                How does moccet&apos;s pricing work?
                <span className="faq-toggle md:text-2xl" style={{ fontSize: '20px', fontWeight: '300' }}>−</span>
              </button>
              <div className="faq-answer active md:pb-6" style={{ maxHeight: '500px', paddingBottom: '20px', overflow: 'hidden', transition: 'max-height 0.3s ease-out' }}>
                <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }} className="md:text-base">
                  moccet Omnisight is currently in early access. The Research tier is free for academic institutions. Our Pilot program ($100K) provides a 30-day proof of value with full deployment and money-back guarantee. Contact our sales team to discuss pricing options.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question md:text-base md:py-6"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '44px'
                }}
              >
                Is moccet free to use?
                <span className="faq-toggle md:text-2xl" style={{ fontSize: '20px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer md:pb-6" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s ease-out', paddingBottom: '0' }}>
                <p className="md:text-base" style={{ fontSize: '14px', color: '#666', lineHeight: '1.6', paddingBottom: '20px' }}>
                  Yes, moccet offers a free Research tier for academic institutions. This includes full platform access with an academic license. Commercial use requires our Pilot plan.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question md:text-base md:py-6"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '44px'
                }}
              >
                Does moccet offer a plan for educational institutions?
                <span className="faq-toggle md:text-2xl" style={{ fontSize: '20px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer md:pb-6" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s ease-out', paddingBottom: '0' }}>
                <p className="md:text-base" style={{ fontSize: '14px', color: '#666', lineHeight: '1.6', paddingBottom: '20px' }}>
                  Yes! Our Research tier is specifically designed for academic and educational institutions. It provides full platform access at no cost for research and educational purposes. Apply through our website to get started.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question md:text-base md:py-6"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '44px'
                }}
              >
                How secure is moccet?
                <span className="faq-toggle md:text-2xl" style={{ fontSize: '20px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer md:pb-6" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s ease-out', paddingBottom: '0' }}>
                <p className="md:text-base" style={{ fontSize: '14px', color: '#666', lineHeight: '1.6', paddingBottom: '20px' }}>
                  moccet uses proprietary small models that ensure your data never leaves your server. We offer enterprise-grade security including SOC 2 Type II, ISO 27001, GDPR compliance, encryption at rest and in transit, SAML SSO, MFA, and air-gapped deployment options for Enterprise customers.
                </p>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e5e5e5' }}>
              <button
                className="faq-question md:text-base md:py-6"
                onClick={(e) => toggleFAQ(e.currentTarget)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '44px'
                }}
              >
                How do I get started with moccet?
                <span className="faq-toggle md:text-2xl" style={{ fontSize: '20px', fontWeight: '300' }}>+</span>
              </button>
              <div className="faq-answer md:pb-6" style={{ maxHeight: '0', overflow: 'hidden', transition: 'max-height 0.3s ease-out', paddingBottom: '0' }}>
                <p className="md:text-base" style={{ fontSize: '14px', color: '#666', lineHeight: '1.6', paddingBottom: '20px' }}>
                  Request early access through our website. For Research tier, apply with your academic credentials. For Pilot program, schedule a consultation to discuss your use case and ROI targets. Our team will guide you through deployment, which typically takes just days, not months.
                </p>
              </div>
            </div>
          </div>
            </div>
          )}

          {/* Contact Sales Page */}
          {activePage === 'contact' && (
            <div style={{ width: '100%', maxWidth: '600px', padding: '0 16px' }} className="md:px-0">
              <div style={{ textAlign: 'center' }}>
                {!isSubmitted ? (
                  <>
                    <h1 style={{ fontSize: '28px', fontWeight: '400', marginBottom: '16px' }} className="md:text-5xl md:mb-6">Get in touch with our sales team</h1>
                    <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px' }} className="md:text-lg md:mb-12">
                      Learn how moccet can transform your organization with AI that delivers autonomous insights.
                    </p>
                    <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                      <div style={{ marginBottom: '20px' }} className="md:mb-6">
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }} className="md:mb-2">Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '14px 12px',
                            border: '1px solid #e5e5e5',
                            borderRadius: '6px',
                            fontSize: '16px',
                            minHeight: '44px'
                          }}
                          required
                        />
                      </div>
                      <div style={{ marginBottom: '20px' }} className="md:mb-6">
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }} className="md:mb-2">Email *</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '14px 12px',
                            border: '1px solid #e5e5e5',
                            borderRadius: '6px',
                            fontSize: '16px',
                            minHeight: '44px'
                          }}
                          required
                        />
                      </div>
                      <div style={{ marginBottom: '20px' }} className="md:mb-6">
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }} className="md:mb-2">Company</label>
                        <input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '14px 12px',
                            border: '1px solid #e5e5e5',
                            borderRadius: '6px',
                            fontSize: '16px',
                            minHeight: '44px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '20px' }} className="md:mb-6">
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }} className="md:mb-2">Job Title</label>
                        <input
                          type="text"
                          name="jobTitle"
                          value={formData.jobTitle}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '14px 12px',
                            border: '1px solid #e5e5e5',
                            borderRadius: '6px',
                            fontSize: '16px',
                            minHeight: '44px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '20px' }} className="md:mb-6">
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }} className="md:mb-2">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '14px 12px',
                            border: '1px solid #e5e5e5',
                            borderRadius: '6px',
                            fontSize: '16px',
                            minHeight: '44px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '20px' }} className="md:mb-6">
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }} className="md:mb-2">How can we help you?</label>
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
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          minHeight: '48px'
                        }}
                      >
                        {isSubmitting ? 'Sending...' : 'Send Message'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0' }} className="md:py-15">
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px',
                      fontSize: '24px'
                    }} className="md:w-20 md:h-20 md:mb-6 md:text-4xl">
                      ✓
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: '400', marginBottom: '12px', color: '#000' }} className="md:text-3xl md:mb-4">Message Sent!</h2>
                    <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }} className="md:text-lg md:mb-8">
                      Thank you for your interest in moccet. Our sales team will get back to you within 24 hours.
                    </p>
                    <button
                      onClick={() => showPage('pricing')}
                      style={{
                        padding: '14px 24px',
                        background: '#000',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        minHeight: '44px'
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
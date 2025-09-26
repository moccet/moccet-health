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
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Set responsive breakpoints and sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);

      if (width > 1024) {
        setSidebarActive(true);
      } else {
        setSidebarActive(false);
      }
    };

    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleNavigate = (targetId: string) => {
    if (targetId.startsWith('#')) {
      // Scroll to top when navigating
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        setSidebarActive(false);
      }
    }
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
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <Header
        onToggleSidebar={toggleSidebar}
        onContactSales={handleContactSales}
        sidebarActive={sidebarActive}
      />

      <Sidebar
        isActive={sidebarActive}
        onNavigate={handleNavigate}
      />

      <main
        style={{
          marginLeft: isMobile || isTablet ? '0' : (sidebarActive ? '240px' : '0'),
          transition: 'margin-left 0.3s ease',
          padding: isMobile ? '0 20px 150px 20px' : isTablet ? '0 40px' : '0 80px',
          paddingTop: '60px',
          minHeight: '100vh'
        }}
      >
        <section style={{ textAlign: 'center', padding: isMobile ? '40px 0 60px' : isTablet ? '60px 0 80px' : '80px 0 120px' }}>
          <h1 style={{
            fontSize: isMobile ? '32px' : isTablet ? '44px' : '56px',
            fontWeight: '400',
            lineHeight: '1.2',
            marginBottom: '24px',
            letterSpacing: isMobile ? '-0.5px' : '-1.5px',
            color: '#000'
          }}>
            Contact Us
          </h1>
          <p style={{
            fontSize: isMobile ? '16px' : isTablet ? '18px' : '20px',
            color: '#374151',
            marginBottom: '40px',
            maxWidth: isMobile ? '100%' : '800px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6'
          }}>
            We&apos;re here to help with any questions about moccet and how we can transform your healthcare organization.
          </p>
        </section>

        {/* Contact Options */}
        <section style={{ marginBottom: isMobile ? '60px' : '100px' }}>
          <h2 style={{
            fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
            fontWeight: '400',
            marginBottom: '16px',
            color: '#000',
            textAlign: 'center'
          }}>
            How can we help?
          </h2>
          <p style={{
            fontSize: isMobile ? '16px' : '18px',
            color: '#6b7280',
            marginBottom: isMobile ? '40px' : '60px',
            textAlign: 'center',
            maxWidth: isMobile ? '100%' : '800px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6'
          }}>
            Choose the best way to reach us based on your inquiry.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: isMobile ? '20px' : '32px',
            marginBottom: isMobile ? '60px' : '100px'
          }}>
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '24px' : '32px',
              background: 'white'
            }}>
              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '500',
                marginBottom: '12px',
                color: '#000'
              }}>
                Sales Inquiries
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>Ready to transform your healthcare organization?</p>
              <a href="mailto:sales@moccet.com" style={{
                color: '#000',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '500',
                display: 'block',
                marginBottom: '8px',
                padding: isMobile ? '8px 0' : '4px 0',
                minHeight: isMobile ? '44px' : 'auto',
                lineHeight: isMobile ? '28px' : 'normal'
              }}>
                sales@moccet.com
              </a>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>+1 (707) 400-5566</p>
            </div>

            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '24px' : '32px',
              background: 'white'
            }}>
              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '500',
                marginBottom: '12px',
                color: '#000'
              }}>
                Technical Support
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>Need help with our products or services?</p>
              <a href="mailto:support@moccet.com" style={{
                color: '#000',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '500',
                display: 'block',
                marginBottom: '8px',
                padding: isMobile ? '8px 0' : '4px 0',
                minHeight: isMobile ? '44px' : 'auto',
                lineHeight: isMobile ? '28px' : 'normal'
              }}>
                support@moccet.com
              </a>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>24/7 support for enterprise customers</p>
            </div>

            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '24px' : '32px',
              background: 'white'
            }}>
              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '500',
                marginBottom: '12px',
                color: '#000'
              }}>
                Media & Press
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>For media inquiries and press resources</p>
              <a href="mailto:press@moccet.com" style={{
                color: '#000',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '500',
                display: 'block',
                marginBottom: '8px',
                padding: isMobile ? '8px 0' : '4px 0',
                minHeight: isMobile ? '44px' : 'auto',
                lineHeight: isMobile ? '28px' : 'normal'
              }}>
                press@moccet.com
              </a>
              <Link href="/brand" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                Brand Resources →
              </Link>
            </div>

            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '24px' : '32px',
              background: 'white'
            }}>
              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '500',
                marginBottom: '12px',
                color: '#000'
              }}>
                Partnerships
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>Interested in partnering with moccet?</p>
              <a href="mailto:partnerships@moccet.com" style={{
                color: '#000',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '500',
                display: 'block',
                marginBottom: '8px',
                padding: isMobile ? '8px 0' : '4px 0',
                minHeight: isMobile ? '44px' : 'auto',
                lineHeight: isMobile ? '28px' : 'normal'
              }}>
                partnerships@moccet.com
              </a>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>Integration and reseller opportunities</p>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section style={{
          background: '#f9fafb',
          borderRadius: isMobile ? '16px' : '24px',
          padding: isMobile ? '40px 20px' : isTablet ? '60px 40px' : '80px',
          margin: isMobile ? '0 -20px' : isTablet ? '0 -40px' : '0 -80px',
          marginBottom: isMobile ? '60px' : '100px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '40px' : '60px' }}>
            <h2 style={{
              fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
              fontWeight: '400',
              marginBottom: '16px',
              color: '#000'
            }}>
              Send Us a Message
            </h2>
            <p style={{
              fontSize: isMobile ? '16px' : '18px',
              color: '#6b7280',
              maxWidth: isMobile ? '100%' : '600px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: '1.6'
            }}>
              Fill out the form below and we&apos;ll get back to you within 24 business hours.
            </p>
          </div>

          {showSuccess && (
            <div style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto 40px auto', padding: '20px', background: '#10b981', color: 'white', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }}>Message Sent Successfully!</h3>
              <p style={{ fontSize: '16px', margin: '0' }}>Thank you for contacting us. We&apos;ll respond within 24 hours.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{
            maxWidth: isMobile ? '100%' : '600px',
            margin: '0 auto'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
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
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
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
                Organization
              </label>
              <input
                type="text"
                id="organization"
                name="organization"
                value={formData.organization}
                onChange={handleChange}
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
                Subject *
              </label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: 'white'
                }}
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

            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Message *
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                placeholder="Tell us how we can help..."
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
              style={{
                width: '100%',
                padding: isMobile ? '16px 24px' : '12px 24px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                minHeight: isMobile ? '48px' : '44px',
                touchAction: 'manipulation'
              }}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </section>

        {/* Office Locations */}
        <section style={{ marginBottom: isMobile ? '60px' : '100px' }}>
          <h2 style={{
            fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
            fontWeight: '400',
            marginBottom: '16px',
            color: '#000',
            textAlign: 'center'
          }}>
            Our Global Offices
          </h2>
          <p style={{
            fontSize: isMobile ? '16px' : '18px',
            color: '#6b7280',
            marginBottom: isMobile ? '40px' : '60px',
            textAlign: 'center',
            maxWidth: isMobile ? '100%' : '800px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6'
          }}>
            Connect with our teams around the world.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: isMobile ? '20px' : '32px'
          }}>
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '24px' : '32px',
              background: 'white',
              textAlign: 'center'
            }}>
              <h3 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '500',
                marginBottom: '12px',
                color: '#000'
              }}>
                Palo Alto (HQ)
              </h3>
              <p style={{ color: '#6b7280', lineHeight: '1.6', fontSize: '14px' }}>
                3000 Sand Hill Road<br />
                Palo Alto, CA 94304<br />
                United States
              </p>
            </div>

            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '24px' : '32px',
              background: 'white',
              textAlign: 'center'
            }}>
              <h3 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '500',
                marginBottom: '12px',
                color: '#000'
              }}>
                New York
              </h3>
              <p style={{ color: '#6b7280', lineHeight: '1.6', fontSize: '14px' }}>
                350 Fifth Avenue<br />
                New York, NY 10118<br />
                United States
              </p>
            </div>

            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '24px' : '32px',
              background: 'white',
              textAlign: 'center'
            }}>
              <h3 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '500',
                marginBottom: '12px',
                color: '#000'
              }}>
                London
              </h3>
              <p style={{ color: '#6b7280', lineHeight: '1.6', fontSize: '14px' }}>
                25 Berkeley Square<br />
                Mayfair, London W1J 6HN<br />
                United Kingdom
              </p>
            </div>

          </div>
        </section>

      </main>

    </div>
  );
}
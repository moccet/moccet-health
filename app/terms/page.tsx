'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function TermsPage() {
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
          padding: isMobile ? '0 20px 120px 20px' : isTablet ? '0 40px' : '0 80px',
          paddingTop: '60px',
          minHeight: '100vh'
        }}
      >
        <section style={{ textAlign: 'center', padding: isMobile ? '80px 0 60px' : isTablet ? '100px 0 80px' : '120px 0 120px' }}>
          <h1 style={{
            fontSize: isMobile ? '32px' : isTablet ? '44px' : '56px',
            fontWeight: '400',
            lineHeight: '1.2',
            marginBottom: '24px',
            letterSpacing: isMobile ? '-0.5px' : '-1.5px',
            color: '#000'
          }}>
            Terms of Use
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
            Please read these terms carefully before using our services
          </p>
        </section>

        {/* Terms Content */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <p className={styles.legalDate}>Effective Date: September 26, 2025</p>
            <p className={styles.legalDate}>Last Modified: September 26, 2025</p>

            <h2>1. Agreement to Terms</h2>
            <p>
              By using moccet&apos;s website, products, and services (collectively, the &quot;Services&quot;),
              you agree to be bound by these Terms of Use (&quot;Terms&quot;). If you do not agree to
              these Terms, you must not access or use our Services.
            </p>
            <p>
              These Terms apply to all visitors, users, and others who access or use our
              Services, including healthcare organizations, individual practitioners, and
              trial users.
            </p>

            <h2>2. Use of Services</h2>

            <h3>2.1 Eligibility</h3>
            <p>
              You must be at least 18 years old and have the legal capacity to enter into
              these Terms. If you are using our Services on behalf of an organization, you
              represent and warrant that you have the authority to bind that organization
              to these Terms.
            </p>

            <h3>2.2 Account Registration</h3>
            <p>
              To access certain features, you must register for an account. You agree to:
            </p>
            <ul>
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>

            <h3>2.3 Acceptable Use</h3>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Services for any unlawful purpose or in violation of any regulations</li>
              <li>Attempt to gain unauthorized access to any portion of the Services</li>
              <li>Interfere with or disrupt the Services or servers</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Use the Services to infringe on intellectual property rights</li>
              <li>Harvest or collect information about other users</li>
              <li>Impersonate any person or entity</li>
            </ul>

            <h2>3. Healthcare Services Disclaimer</h2>
            <p>
              <strong>moccet is not a healthcare provider.</strong> Our Services are designed
              to support healthcare professionals and organizations but do not constitute
              medical advice, diagnosis, or treatment. All clinical decisions should be made
              by qualified healthcare professionals based on their professional judgment.
            </p>
            <p>
              The Services are intended for use by trained healthcare professionals only.
              Patients and non-healthcare professionals should not rely on our Services
              for medical decisions.
            </p>

            <h2>4. Intellectual Property Rights</h2>

            <h3>4.1 Our Property</h3>
            <p>
              The Services and all content, features, and functionality are owned by moccet
              and are protected by international copyright, trademark, patent, trade secret,
              and other intellectual property laws.
            </p>

            <h3>4.2 Your License to Use</h3>
            <p>
              Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
              revocable license to access and use the Services for your internal business
              purposes.
            </p>

            <h3>4.3 Your Content</h3>
            <p>
              You retain ownership of any data you submit to the Services. By using the
              Services, you grant us a license to use, process, and store your content
              solely to provide the Services to you.
            </p>

            <h2>5. Privacy and Data Protection</h2>
            <p>
              Your use of our Services is also governed by our Privacy Policy, which is
              incorporated into these Terms by reference. We are committed to protecting
              your privacy and handling your data in accordance with applicable laws,
              including HIPAA.
            </p>

            <h2>6. Fees and Payment</h2>
            <p>
              Certain Services require payment of fees. You agree to pay all fees according
              to the pricing and payment terms presented to you. Fees are non-refundable
              except as expressly stated in these Terms or required by law.
            </p>

            <h2>7. Disclaimers and Limitations of Liability</h2>

            <h3>7.1 No Warranties</h3>
            <p>
              THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
              ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>

            <h3>7.2 Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, MOCCET SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
              LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
            </p>

            <h2>8. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless moccet and its officers,
              directors, employees, and agents from any claims, damages, losses, liabilities,
              and expenses arising from your use of the Services or violation of these Terms.
            </p>

            <h2>9. Termination</h2>
            <p>
              We may terminate or suspend your access to the Services immediately, without
              prior notice or liability, for any reason, including breach of these Terms.
              Upon termination, your right to use the Services will immediately cease.
            </p>

            <h2>10. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by the laws of the State of California, without
              regard to its conflict of law provisions. Any disputes arising from these
              Terms or the Services shall be resolved through binding arbitration in
              San Francisco, California.
            </p>

            <h2>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide
              notice of material changes through the Services or by email. Your continued
              use after such notice constitutes acceptance of the modified Terms.
            </p>

            <h2>12. General Provisions</h2>

            <h3>12.1 Entire Agreement</h3>
            <p>
              These Terms, together with our Privacy Policy and any other agreements
              expressly incorporated by reference, constitute the entire agreement between
              you and moccet regarding the Services.
            </p>

            <h3>12.2 Severability</h3>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable,
              the remaining provisions will continue in full force and effect.
            </p>

            <h3>12.3 No Waiver</h3>
            <p>
              Our failure to enforce any right or provision of these Terms will not be
              considered a waiver of those rights.
            </p>

            <h3>12.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms without our prior written consent.
              We may assign our rights and obligations without restriction.
            </p>

            <h2>13. Contact Information</h2>
            <p>
              If you have questions about these Terms of Use, please contact us at:
            </p>
            <p>
              <strong>Legal Department</strong><br />
              moccet, Inc.<br />
              Email: <a href="mailto:legal@moccet.com">legal@moccet.com</a><br />
              Phone: +1 (707) 400-5566<br />
              Address: 555 California Street, San Francisco, CA 94104
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: '#f9fafb',
          borderRadius: '12px',
          margin: '40px 0 0 0'
        }}>
          <h2 style={{
            fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
            fontWeight: '400',
            lineHeight: '1.2',
            marginBottom: '16px',
            color: '#000'
          }}>
            Have Questions?
          </h2>
          <p style={{
            fontSize: isMobile ? '16px' : '18px',
            color: '#6b7280',
            marginBottom: '32px',
            maxWidth: isMobile ? '100%' : '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6'
          }}>
            Our legal team is here to help clarify any terms
          </p>
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center'
          }}>
            <a href="mailto:legal@moccet.com" style={{
              display: 'inline-block',
              padding: isMobile ? '14px 28px' : '12px 24px',
              backgroundColor: '#000',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              minHeight: isMobile ? '48px' : '44px',
              lineHeight: isMobile ? '20px' : 'normal',
              touchAction: 'manipulation'
            }}>
              Contact Legal
            </a>
            <Link href="/privacy" style={{
              display: 'inline-block',
              padding: isMobile ? '14px 28px' : '12px 24px',
              backgroundColor: 'transparent',
              color: '#374151',
              textDecoration: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              minHeight: isMobile ? '48px' : '44px',
              lineHeight: isMobile ? '20px' : 'normal',
              touchAction: 'manipulation'
            }}>
              Privacy Policy
            </Link>
          </div>
        </section>

        {/* Mobile Bottom Spacer */}
        <div style={{
          height: '150px',
          width: '100%'
        }}></div>
      </main>
    </div>
  );
}
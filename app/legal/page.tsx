'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

export default function LegalPage() {
  const [activeSection, setActiveSection] = useState('terms');

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <Link href="/" className={styles.contactSalesBtn}>
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Legal</h1>
          <p className={styles.subtitle}>
            Terms, privacy, and compliance information
          </p>
        </section>

        {/* Navigation Tabs */}
        <section className={styles.contentSection}>
          <div className={styles.legalTabs}>
            <button
              className={`${styles.legalTab} ${activeSection === 'terms' ? styles.legalTabActive : ''}`}
              onClick={() => setActiveSection('terms')}
            >
              Terms of Service
            </button>
            <button
              className={`${styles.legalTab} ${activeSection === 'privacy' ? styles.legalTabActive : ''}`}
              onClick={() => setActiveSection('privacy')}
            >
              Privacy Policy
            </button>
            <button
              className={`${styles.legalTab} ${activeSection === 'hipaa' ? styles.legalTabActive : ''}`}
              onClick={() => setActiveSection('hipaa')}
            >
              HIPAA Compliance
            </button>
            <button
              className={`${styles.legalTab} ${activeSection === 'security' ? styles.legalTabActive : ''}`}
              onClick={() => setActiveSection('security')}
            >
              Security
            </button>
          </div>
        </section>

        {/* Terms of Service */}
        {activeSection === 'terms' && (
          <section className={styles.contentSection}>
            <div className={styles.articleContent}>
              <h2>Terms of Service</h2>
              <p className={styles.legalDate}>Effective Date: January 1, 2024</p>

              <h3>1. Acceptance of Terms</h3>
              <p>
                By accessing or using moccet&apos;s services (&quot;Services&quot;), you agree to be
                bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these
                Terms, do not use our Services.
              </p>

              <h3>2. Description of Services</h3>
              <p>
                moccet provides AI-powered healthcare analytics and insights platforms
                designed to improve clinical outcomes and operational efficiency in
                healthcare organizations. Our Services include software applications,
                APIs, data analysis tools, and related support services.
              </p>

              <h3>3. User Responsibilities</h3>
              <p>You agree to:</p>
              <ul>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Use the Services in compliance with all applicable laws and regulations</li>
                <li>Not attempt to gain unauthorized access to any portion of the Services</li>
                <li>Not use the Services for any unlawful or prohibited purpose</li>
              </ul>

              <h3>4. Healthcare Disclaimer</h3>
              <p>
                moccet&apos;s Services are intended to support, not replace, clinical decision-making.
                All clinical decisions should be made by qualified healthcare professionals
                based on their professional judgment. moccet does not provide medical advice,
                diagnosis, or treatment.
              </p>

              <h3>5. Data Usage and Ownership</h3>
              <p>
                You retain all rights to your data. By using our Services, you grant moccet
                a limited license to process your data solely for the purpose of providing
                the Services. We will handle all data in accordance with our Privacy Policy
                and applicable data protection laws.
              </p>

              <h3>6. Intellectual Property</h3>
              <p>
                All intellectual property rights in the Services remain the property of
                moccet. You may not copy, modify, distribute, sell, or lease any part of
                our Services without explicit written permission.
              </p>

              <h3>7. Limitation of Liability</h3>
              <p>
                To the maximum extent permitted by law, moccet shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages resulting
                from your use or inability to use the Services.
              </p>

              <h3>8. Termination</h3>
              <p>
                We may terminate or suspend your access to the Services immediately, without
                prior notice or liability, for any reason, including breach of these Terms.
              </p>

              <h3>9. Changes to Terms</h3>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users
                of any material changes via email or through the Services.
              </p>

              <h3>10. Contact Information</h3>
              <p>
                For questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@moccet.com">legal@moccet.com</a>
              </p>
            </div>
          </section>
        )}

        {/* Privacy Policy */}
        {activeSection === 'privacy' && (
          <section className={styles.contentSection}>
            <div className={styles.articleContent}>
              <h2>Privacy Policy</h2>
              <p className={styles.legalDate}>Effective Date: January 1, 2024</p>

              <h3>1. Information We Collect</h3>
              <p>We collect information you provide directly to us, including:</p>
              <ul>
                <li>Account information (name, email, organization)</li>
                <li>Healthcare data processed through our Services</li>
                <li>Usage data and analytics</li>
                <li>Communications with our team</li>
              </ul>

              <h3>2. How We Use Information</h3>
              <p>We use the information we collect to:</p>
              <ul>
                <li>Provide, maintain, and improve our Services</li>
                <li>Process and analyze healthcare data as requested</li>
                <li>Send technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends and usage</li>
              </ul>

              <h3>3. Information Sharing</h3>
              <p>
                We do not sell, trade, or rent your personal information. We may share
                information only in the following circumstances:
              </p>
              <ul>
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect rights, privacy, safety, or property</li>
                <li>With service providers under strict confidentiality agreements</li>
              </ul>

              <h3>4. Data Security</h3>
              <p>
                We implement administrative, technical, and physical security measures
                designed to protect your information. All data is encrypted in transit
                and at rest using industry-standard encryption protocols.
              </p>

              <h3>5. Data Retention</h3>
              <p>
                We retain information for as long as necessary to provide Services and
                comply with legal obligations. You may request deletion of your data at
                any time.
              </p>

              <h3>6. Your Rights</h3>
              <p>You have the right to:</p>
              <ul>
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to certain processing activities</li>
                <li>Export your data in a portable format</li>
              </ul>

              <h3>7. International Data Transfers</h3>
              <p>
                We may transfer information to countries other than the country in which
                the data was originally collected. These transfers are conducted in
                compliance with applicable data protection laws.
              </p>

              <h3>8. Contact Us</h3>
              <p>
                For privacy-related questions, contact our Data Protection Officer at{' '}
                <a href="mailto:privacy@moccet.com">privacy@moccet.com</a>
              </p>
            </div>
          </section>
        )}

        {/* HIPAA Compliance */}
        {activeSection === 'hipaa' && (
          <section className={styles.contentSection}>
            <div className={styles.articleContent}>
              <h2>HIPAA Compliance</h2>
              <p className={styles.legalDate}>Last Updated: January 1, 2024</p>

              <h3>Our Commitment to HIPAA</h3>
              <p>
                moccet is fully committed to compliance with the Health Insurance Portability
                and Accountability Act (HIPAA). We maintain comprehensive safeguards to protect
                Protected Health Information (PHI) and ensure compliance with all applicable
                HIPAA regulations.
              </p>

              <h3>Business Associate Agreement (BAA)</h3>
              <p>
                We execute Business Associate Agreements with all covered entities using our
                Services. Our BAA ensures that we:
              </p>
              <ul>
                <li>Use and disclose PHI only as permitted by the agreement</li>
                <li>Implement appropriate safeguards to prevent unauthorized use or disclosure</li>
                <li>Report any breaches of unsecured PHI</li>
                <li>Ensure any subcontractors agree to the same restrictions</li>
                <li>Make PHI available to individuals when required</li>
              </ul>

              <h3>Administrative Safeguards</h3>
              <ul>
                <li>Security Officer designation and responsibilities</li>
                <li>Workforce training and access management</li>
                <li>Access authorization and modification procedures</li>
                <li>Incident response and reporting procedures</li>
                <li>Regular risk assessments and mitigation strategies</li>
              </ul>

              <h3>Physical Safeguards</h3>
              <ul>
                <li>Facility access controls and monitoring</li>
                <li>Workstation security policies</li>
                <li>Device and media controls</li>
                <li>Equipment disposal and reuse procedures</li>
              </ul>

              <h3>Technical Safeguards</h3>
              <ul>
                <li>Unique user identification and automatic logoff</li>
                <li>Encryption and decryption of PHI</li>
                <li>Audit logs and monitoring systems</li>
                <li>Integrity controls and transmission security</li>
                <li>Access controls and authentication mechanisms</li>
              </ul>

              <h3>Breach Notification</h3>
              <p>
                In the event of a breach involving PHI, we will notify affected covered
                entities without unreasonable delay and no later than 60 days after
                discovery of the breach, as required by HIPAA.
              </p>

              <h3>Audits and Certifications</h3>
              <p>
                moccet undergoes regular third-party security audits and maintains
                SOC 2 Type II certification. We conduct annual HIPAA risk assessments
                and maintain comprehensive documentation of our compliance efforts.
              </p>

              <h3>Questions</h3>
              <p>
                For questions about our HIPAA compliance, please contact our Compliance
                Officer at <a href="mailto:compliance@moccet.com">compliance@moccet.com</a>
              </p>
            </div>
          </section>
        )}

        {/* Security */}
        {activeSection === 'security' && (
          <section className={styles.contentSection}>
            <div className={styles.articleContent}>
              <h2>Security</h2>
              <p className={styles.legalDate}>Last Updated: January 1, 2024</p>

              <h3>Security Overview</h3>
              <p>
                moccet employs industry-leading security measures to protect your data.
                Our comprehensive security program encompasses people, processes, and
                technology to ensure the confidentiality, integrity, and availability
                of your information.
              </p>

              <h3>Infrastructure Security</h3>
              <ul>
                <li>Cloud infrastructure hosted on AWS with SOC 2 compliance</li>
                <li>Multi-region deployment for redundancy and disaster recovery</li>
                <li>Network isolation and segmentation</li>
                <li>Web Application Firewall (WAF) protection</li>
                <li>DDoS protection and mitigation</li>
              </ul>

              <h3>Data Encryption</h3>
              <ul>
                <li>AES-256 encryption for data at rest</li>
                <li>TLS 1.3 for all data in transit</li>
                <li>Encrypted backups with secure key management</li>
                <li>Hardware Security Module (HSM) for key storage</li>
              </ul>

              <h3>Access Controls</h3>
              <ul>
                <li>Multi-factor authentication (MFA) required for all accounts</li>
                <li>Role-based access control (RBAC)</li>
                <li>Principle of least privilege</li>
                <li>Regular access reviews and audits</li>
                <li>Session management and automatic timeouts</li>
              </ul>

              <h3>Application Security</h3>
              <ul>
                <li>Secure software development lifecycle (SSDLC)</li>
                <li>Regular security code reviews</li>
                <li>Automated vulnerability scanning</li>
                <li>Penetration testing by third-party experts</li>
                <li>Security headers and content security policies</li>
              </ul>

              <h3>Monitoring and Incident Response</h3>
              <ul>
                <li>24/7 security monitoring and alerting</li>
                <li>Security Information and Event Management (SIEM)</li>
                <li>Incident response team and procedures</li>
                <li>Regular incident response drills</li>
                <li>Forensic capabilities and evidence preservation</li>
              </ul>

              <h3>Compliance and Certifications</h3>
              <ul>
                <li>SOC 2 Type II certified</li>
                <li>HIPAA compliant</li>
                <li>ISO 27001 certification in progress</li>
                <li>Regular third-party security audits</li>
                <li>Compliance with GDPR and CCPA</li>
              </ul>

              <h3>Security Training</h3>
              <p>
                All moccet employees undergo comprehensive security training, including:
              </p>
              <ul>
                <li>Annual security awareness training</li>
                <li>HIPAA training for all staff</li>
                <li>Phishing simulation exercises</li>
                <li>Secure coding practices for developers</li>
                <li>Incident response training for relevant teams</li>
              </ul>

              <h3>Vulnerability Disclosure</h3>
              <p>
                We welcome responsible disclosure of security vulnerabilities. If you
                discover a vulnerability, please report it to{' '}
                <a href="mailto:security@moccet.com">security@moccet.com</a>
              </p>

              <h3>Security Updates</h3>
              <p>
                For security updates and advisories, visit our Security Center or
                subscribe to our security mailing list.
              </p>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Have Legal Questions?</h2>
          <p className={styles.finalCtaSubtitle}>
            Our legal team is here to help with compliance and regulatory matters
          </p>
          <div className={styles.buttonRow}>
            <a href="mailto:legal@moccet.com" className={styles.ctaBtn}>Contact Legal Team</a>
            <Link href="/" className={styles.watchVideoBtn}>Back to Home</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Product</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/health">moccet-health</Link></li>
                <li><a href="#">Features</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">Security</a></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Company</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/philosophy">Our Philosophy</Link></li>
                <li><Link href="/careers">Careers</Link></li>
                <li><Link href="/brand">Brand</Link></li>
                <li><Link href="/legal">Legal</Link></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Resources</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/research">Research</Link></li>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Reference</a></li>
                <li><a href="#">Status</a></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Connect</h4>
              <ul className={styles.footerLinks}>
                <li><a href="#">Contact Sales</a></li>
                <li><a href="#">Support</a></li>
                <li><a href="#">Twitter</a></li>
                <li><a href="#">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; 2024 moccet. All rights reserved.</p>
            <div className={styles.footerBottomLinks}>
              <Link href="/legal">Privacy Policy</Link>
              <Link href="/legal">Terms of Service</Link>
              <a href="#">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
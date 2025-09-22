'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function PrivacyPage() {
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
          <h1>Privacy Policy</h1>
          <p className={styles.subtitle}>
            How we collect, use, and protect your information
          </p>
        </section>

        {/* Privacy Content */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <p className={styles.legalDate}>Effective Date: January 1, 2024</p>
            <p className={styles.legalDate}>Last Updated: January 1, 2024</p>

            <h2>Introduction</h2>
            <p>
              At moccet, we take your privacy seriously. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use our website,
              products, and services. Please read this policy carefully to understand our
              practices regarding your information.
            </p>

            <h2>1. Information We Collect</h2>

            <h3>1.1 Information You Provide Directly</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, phone number, organization name, job title</li>
              <li><strong>Payment Information:</strong> Billing address, payment method details (processed by secure third-party providers)</li>
              <li><strong>Healthcare Data:</strong> Clinical data, patient information (de-identified), operational metrics</li>
              <li><strong>Communications:</strong> Support requests, feedback, correspondence with our team</li>
              <li><strong>User Content:</strong> Any content you upload, submit, or transmit through the Services</li>
            </ul>

            <h3>1.2 Information Collected Automatically</h3>
            <ul>
              <li><strong>Usage Data:</strong> Features used, time spent, interactions with the Services</li>
              <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
              <li><strong>Log Data:</strong> Access times, pages viewed, app crashes, system activity</li>
              <li><strong>Location Data:</strong> General geographic location based on IP address</li>
              <li><strong>Cookies and Tracking:</strong> Session cookies, preference cookies, analytics cookies</li>
            </ul>

            <h3>1.3 Information from Third Parties</h3>
            <ul>
              <li>Healthcare system integrations (EHR/EMR systems)</li>
              <li>Identity verification services</li>
              <li>Analytics providers</li>
              <li>Marketing partners (with your consent)</li>
            </ul>

            <h2>2. How We Use Your Information</h2>

            <h3>2.1 To Provide and Improve Services</h3>
            <ul>
              <li>Process and analyze healthcare data as requested</li>
              <li>Deliver AI-powered insights and predictions</li>
              <li>Customize and personalize your experience</li>
              <li>Develop new features and improve existing ones</li>
              <li>Provide customer support and respond to inquiries</li>
            </ul>

            <h3>2.2 For Business Operations</h3>
            <ul>
              <li>Process payments and manage subscriptions</li>
              <li>Send administrative information and updates</li>
              <li>Monitor and analyze usage patterns and trends</li>
              <li>Detect, prevent, and address technical issues</li>
              <li>Protect against fraud and security threats</li>
            </ul>

            <h3>2.3 For Legal and Compliance</h3>
            <ul>
              <li>Comply with legal obligations and regulations</li>
              <li>Enforce our terms and policies</li>
              <li>Respond to legal requests and prevent harm</li>
              <li>Maintain audit logs for compliance purposes</li>
            </ul>

            <h2>3. How We Share Your Information</h2>

            <h3>3.1 We Do Not Sell Your Information</h3>
            <p>
              We never sell, rent, or trade your personal information or healthcare data
              to third parties for their marketing purposes.
            </p>

            <h3>3.2 Authorized Sharing</h3>
            <p>We may share your information in the following circumstances:</p>
            <ul>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share</li>
              <li><strong>Service Providers:</strong> Trusted vendors who assist in operating our Services under strict confidentiality agreements</li>
              <li><strong>Healthcare Partners:</strong> Other healthcare providers or systems you authorize us to connect with</li>
              <li><strong>Legal Requirements:</strong> When required by law, subpoena, or government request</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>Protection of Rights:</strong> To protect the rights, property, or safety of moccet, our users, or others</li>
            </ul>

            <h2>4. Data Security</h2>

            <h3>4.1 Security Measures</h3>
            <p>We implement industry-leading security measures including:</p>
            <ul>
              <li>End-to-end encryption for data in transit and at rest</li>
              <li>Multi-factor authentication requirements</li>
              <li>Regular security audits and penetration testing</li>
              <li>SOC 2 Type II certification</li>
              <li>HIPAA-compliant infrastructure and processes</li>
              <li>24/7 security monitoring and incident response</li>
            </ul>

            <h3>4.2 Data Breach Response</h3>
            <p>
              In the event of a data breach, we will notify affected users within 72 hours
              and provide information about the incident, potential impacts, and steps
              we&apos;re taking to address it.
            </p>

            <h2>5. Your Rights and Choices</h2>

            <h3>5.1 Your Rights</h3>
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Receive your data in a portable format</li>
              <li><strong>Restriction:</strong> Limit how we process your information</li>
              <li><strong>Objection:</strong> Object to certain processing activities</li>
              <li><strong>Withdrawal:</strong> Withdraw consent where processing is based on consent</li>
            </ul>

            <h3>5.2 How to Exercise Your Rights</h3>
            <p>
              To exercise any of these rights, contact our Privacy Team at
              <a href="mailto:privacy@moccet.com"> privacy@moccet.com</a>. We will respond
              to your request within 30 days.
            </p>

            <h3>5.3 Communication Preferences</h3>
            <p>
              You can opt out of marketing communications at any time by clicking the
              &quot;unsubscribe&quot; link in our emails or contacting us directly. Note that you
              will still receive essential service-related communications.
            </p>

            <h2>6. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide Services,
              comply with legal obligations, resolve disputes, and enforce agreements.
              Specific retention periods vary based on:
            </p>
            <ul>
              <li>Type of data and its sensitivity</li>
              <li>Legal and regulatory requirements</li>
              <li>Business and operational needs</li>
              <li>Your consent and preferences</li>
            </ul>

            <h2>7. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than
              your own. We ensure appropriate safeguards are in place through:
            </p>
            <ul>
              <li>Standard contractual clauses approved by regulatory authorities</li>
              <li>Adequacy decisions by relevant data protection authorities</li>
              <li>Other legally approved transfer mechanisms</li>
            </ul>

            <h2>8. Children&apos;s Privacy</h2>
            <p>
              Our Services are not directed to individuals under 18 years old. We do not
              knowingly collect personal information from children. If we become aware that
              we have collected information from a child, we will promptly delete it.
            </p>

            <h2>9. Cookies and Tracking Technologies</h2>

            <h3>9.1 Types of Cookies We Use</h3>
            <ul>
              <li><strong>Essential Cookies:</strong> Required for basic functionality</li>
              <li><strong>Performance Cookies:</strong> Help us understand how you use our Services</li>
              <li><strong>Functionality Cookies:</strong> Remember your preferences</li>
              <li><strong>Analytics Cookies:</strong> Provide insights to improve our Services</li>
            </ul>

            <h3>9.2 Managing Cookies</h3>
            <p>
              You can control cookies through your browser settings. However, disabling
              certain cookies may limit your ability to use some features of our Services.
            </p>

            <h2>10. Third-Party Links</h2>
            <p>
              Our Services may contain links to third-party websites. We are not responsible
              for the privacy practices of these sites. We encourage you to read their
              privacy policies before providing any information.
            </p>

            <h2>11. California Privacy Rights (CCPA)</h2>
            <p>
              California residents have additional rights under the California Consumer
              Privacy Act (CCPA), including:
            </p>
            <ul>
              <li>Right to know what personal information we collect, use, and share</li>
              <li>Right to delete personal information (with some exceptions)</li>
              <li>Right to opt-out of the sale of personal information (we do not sell data)</li>
              <li>Right to non-discrimination for exercising privacy rights</li>
            </ul>

            <h2>12. European Privacy Rights (GDPR)</h2>
            <p>
              If you are located in the European Economic Area (EEA), you have rights under
              the General Data Protection Regulation (GDPR), including:
            </p>
            <ul>
              <li>Clear information about our processing activities</li>
              <li>Legal basis for processing your data</li>
              <li>Right to lodge a complaint with supervisory authorities</li>
              <li>Additional protections for sensitive data</li>
            </ul>

            <h2>13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              material changes via email or through the Services. The &quot;Last Updated&quot; date
              at the top indicates when the policy was last revised.
            </p>

            <h2>14. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy
              or our privacy practices, please contact us:
            </p>
            <p>
              <strong>Data Protection Officer</strong><br />
              moccet, Inc.<br />
              Email: <a href="mailto:privacy@moccet.com">privacy@moccet.com</a><br />
              Phone: 1-800-MOCCET-1<br />
              Address: 555 California Street, San Francisco, CA 94104<br />
            </p>
            <p>
              For EU residents, you may also contact our EU representative:<br />
              moccet EU Representative<br />
              Email: <a href="mailto:eu-privacy@moccet.com">eu-privacy@moccet.com</a>
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Privacy Questions?</h2>
          <p className={styles.finalCtaSubtitle}>
            Our privacy team is here to help with any concerns
          </p>
          <div className={styles.buttonRow}>
            <a href="mailto:privacy@moccet.com" className={styles.ctaBtn}>Contact Privacy Team</a>
            <Link href="/terms" className={styles.watchVideoBtn}>Terms of Use</Link>
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
              <h4 className={styles.footerColumnTitle}>Support</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/contact">Contact Us</Link></li>
                <li><Link href="/terms">Terms of Use</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/policies">Other Policies</Link></li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; 2024 moccet. All rights reserved.</p>
            <div className={styles.footerBottomLinks}>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <a href="#">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
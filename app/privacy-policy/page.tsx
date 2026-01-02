'use client';

import { useState } from 'react';
import Link from 'next/link';
import './privacy.css';

export default function PrivacyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="privacy-page">
      {/* Navigation */}
      <nav className="privacy-nav">
        <Link href="/" className="nav-logo" role="img" aria-label="moccet logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </Link>
        <div className="nav-menu">
          <Link href="/sage" className="nav-link">Sage</Link>
          <Link href="/moccet-mail" className="nav-link">Mail</Link>
          <Link href="/forge" className="nav-link">Forge</Link>
          <Link href="/news" className="nav-link">Stories</Link>
          <Link href="/#waitlist" className="nav-link">
            Join the waitlist
            <svg className="nav-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
              <Link href="/sage" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Sage
              </Link>
              <Link href="/moccet-mail" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Mail
              </Link>
              <Link href="/forge" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Forge
              </Link>
              <Link href="/news" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Stories
              </Link>
              <Link href="/#waitlist" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Join the waitlist
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="privacy-container">
        <header className="privacy-header">
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="privacy-subtitle">moccet Inc.</p>
          <p className="privacy-date">Last Updated: November 8, 2025</p>
        </header>

        <section className="privacy-content">
          <div className="section">
            <h2>1. Introduction</h2>
            <p>
              Welcome to moccet. We are committed to protecting your privacy and ensuring the security of your personal information.
              This Privacy Policy explains how moccet Inc. (&ldquo;moccet,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and protects your data
              when you use our health AI services, including Sage (nutrition planning) and Forge (training programs).
            </p>
            <p>
              By using moccet&apos;s services, you agree to the collection and use of information in accordance with this policy.
            </p>
          </div>

          <div className="section">
            <h2>2. Information We Collect</h2>

            <h3>2.1 Information You Provide</h3>
            <p>We collect information that you voluntarily provide to us, including:</p>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, password, and profile details</li>
              <li><strong>Health Data:</strong> Dietary preferences, fitness goals, activity levels, and health metrics you choose to share</li>
              <li><strong>Communication Data:</strong> Messages, feedback, and support requests you send to us</li>
              <li><strong>Payment Information:</strong> Billing details processed through secure third-party payment processors</li>
            </ul>

            <h3>2.2 Automatically Collected Information</h3>
            <p>When you use our services, we automatically collect:</p>
            <ul>
              <li><strong>Usage Data:</strong> How you interact with Sage and Forge, including queries, preferences, and feature usage</li>
              <li><strong>Device Information:</strong> Device type, operating system, browser type, and IP address</li>
              <li><strong>Cookies and Similar Technologies:</strong> Data collected through cookies and analytics tools</li>
            </ul>

            <h3>2.3 Third-Party Sources</h3>
            <p>We may receive information from:</p>
            <ul>
              <li>Wearable devices and fitness trackers you choose to connect</li>
              <li>Third-party authentication providers (e.g., Google, Apple)</li>
              <li>Analytics and security service providers</li>
            </ul>
          </div>

          <div className="section">
            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li><strong>Provide Personalized Health AI Services:</strong> Generate customized nutrition plans and training programs through Sage and Forge</li>
              <li><strong>Improve Our Services:</strong> Enhance AI models, features, and user experience</li>
              <li><strong>Communication:</strong> Send you service updates, support responses, and marketing communications (with your consent)</li>
              <li><strong>Security and Fraud Prevention:</strong> Protect your account and prevent unauthorized access</li>
              <li><strong>Legal Compliance:</strong> Meet regulatory requirements and respond to legal requests</li>
              <li><strong>Research and Development:</strong> Develop new features and improve AI capabilities (using anonymized data)</li>
            </ul>
          </div>

          <div className="section">
            <h2>4. Data Sharing and Disclosure</h2>
            <p>We do not sell your personal data. We may share your information with:</p>
            <ul>
              <li><strong>Service Providers:</strong> Third-party vendors who help us operate our services (cloud hosting, analytics, payment processing)</li>
              <li><strong>Business Partners:</strong> Partners who provide integrated services with your explicit consent</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales (with continued protection of your data)</li>
            </ul>
            <p>
              <strong>Important:</strong> Your health data is never shared with advertisers or used for marketing purposes without your explicit consent.
            </p>
          </div>

          <div className="section">
            <h2>5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul>
              <li>End-to-end encryption for sensitive health data</li>
              <li>Secure data transmission using SSL/TLS protocols</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and authentication measures</li>
              <li>Employee training on data protection and privacy</li>
            </ul>
            <p>
              While we strive to protect your data, no method of transmission over the internet is 100% secure.
              We encourage you to use strong passwords and keep your login credentials confidential.
            </p>
          </div>

          <div className="section">
            <h2>6. Your Privacy Rights</h2>
            <p>Depending on your location, you have the following rights:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your data (subject to legal obligations)</li>
              <li><strong>Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Withdraw Consent:</strong> Revoke consent for data processing where applicable</li>
              <li><strong>Object to Processing:</strong> Object to certain types of data processing</li>
            </ul>
            <p>
              To exercise these rights, please contact us at <a href="mailto:privacy@moccet.com">privacy@moccet.com</a>
            </p>
          </div>

          <div className="section">
            <h2>7. International Data Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries other than your country of residence.
              We ensure appropriate safeguards are in place, including:
            </p>
            <ul>
              <li>Standard Contractual Clauses approved by regulatory authorities</li>
              <li>Adequacy decisions for data transfers to certain jurisdictions</li>
              <li>Compliance with applicable data protection regulations (GDPR, CCPA, etc.)</li>
            </ul>
          </div>

          <div className="section">
            <h2>8. Data Retention</h2>
            <p>
              We retain your personal data only as long as necessary for the purposes outlined in this policy,
              including:
            </p>
            <ul>
              <li>For as long as you maintain an active account</li>
              <li>As required by law or for legal proceedings</li>
              <li>To fulfill legitimate business purposes (fraud prevention, security)</li>
            </ul>
            <p>
              After account deletion, we will delete or anonymize your data within 90 days, except where
              retention is required by law.
            </p>
          </div>

          <div className="section">
            <h2>9. Health Information Privacy</h2>
            <p>
              We recognize the sensitive nature of health data. While moccet is not currently a covered entity
              under HIPAA, we apply similar privacy and security standards to protect your health information:
            </p>
            <ul>
              <li>Health data is encrypted both in transit and at rest</li>
              <li>Access to health data is restricted to authorized personnel only</li>
              <li>We do not use health data for advertising purposes</li>
              <li>You maintain control over what health data you share</li>
            </ul>
          </div>

          <div className="section">
            <h2>10. Children&apos;s Privacy</h2>
            <p>
              moccet&apos;s services are not intended for individuals under the age of 18. We do not knowingly
              collect personal information from children. If you believe we have inadvertently collected
              information from a child, please contact us immediately at <a href="mailto:privacy@moccet.com">privacy@moccet.com</a>.
            </p>
          </div>

          <div className="section">
            <h2>11. Cookies and Tracking Technologies</h2>
            <p>We use cookies and similar technologies to:</p>
            <ul>
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns and improve our services</li>
              <li>Provide personalized content and recommendations</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
            <p>
              You can control cookie settings through your browser preferences. Note that disabling cookies
              may affect service functionality.
            </p>
          </div>

          <div className="section">
            <h2>12. Third-Party Links</h2>
            <p>
              Our services may contain links to third-party websites or services. We are not responsible for
              the privacy practices of these third parties. We encourage you to review their privacy policies
              before providing any personal information.
            </p>
          </div>

          <div className="section">
            <h2>13. Updates to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal
              requirements. We will notify you of material changes by:
            </p>
            <ul>
              <li>Posting the updated policy with a new &ldquo;Last Updated&rdquo; date</li>
              <li>Sending an email notification to your registered email address</li>
              <li>Displaying a prominent notice on our website or app</li>
            </ul>
            <p>
              Your continued use of moccet&apos;s services after such updates constitutes acceptance of the revised policy.
            </p>
          </div>

          <div className="section">
            <h2>14. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices,
              please contact us:
            </p>
            <div className="contact-info">
              <p><strong>Email:</strong> <a href="mailto:privacy@moccet.com">privacy@moccet.com</a></p>
              <p><strong>Address:</strong> moccet Inc., [Address to be added]</p>
              <p><strong>Data Protection Officer:</strong> <a href="mailto:dpo@moccet.com">dpo@moccet.com</a></p>
            </div>
          </div>

          <div className="section">
            <h2>15. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act:
            </p>
            <ul>
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
              <li>Right to non-discrimination for exercising your privacy rights</li>
            </ul>
            <p>
              To exercise these rights, contact us at <a href="mailto:privacy@moccet.com">privacy@moccet.com</a>
              or call our toll-free number: [Phone number to be added]
            </p>
          </div>

          <div className="section">
            <h2>16. European Privacy Rights (GDPR)</h2>
            <p>
              If you are located in the European Economic Area (EEA), UK, or Switzerland, you have rights under
              the General Data Protection Regulation:
            </p>
            <ul>
              <li>Right to access, rectify, or erase your personal data</li>
              <li>Right to restrict or object to processing</li>
              <li>Right to data portability</li>
              <li>Right to withdraw consent</li>
              <li>Right to lodge a complaint with a supervisory authority</li>
            </ul>
            <p>
              For EU-related inquiries, contact our EU representative: [Details to be added]
            </p>
          </div>
        </section>

        <footer className="privacy-footer">
          <p>Thank you for trusting moccet with your health and wellness journey.</p>
          <nav className="footer-links">
            <Link href="/">Home</Link>
            <Link href="/sage">Sage</Link>
            <Link href="/forge">Forge</Link>
            <Link href="/news">Stories</Link>
          </nav>
          <p className="copyright">© 2025 moccet Inc. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}

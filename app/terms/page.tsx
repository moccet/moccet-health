'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function TermsPage() {
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
          <h1>Terms of Use</h1>
          <p className={styles.subtitle}>
            Please read these terms carefully before using our services
          </p>
        </section>

        {/* Terms Content */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <p className={styles.legalDate}>Effective Date: January 1, 2024</p>
            <p className={styles.legalDate}>Last Modified: January 1, 2024</p>

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
              moccet, Inc.<br />
              Legal Department<br />
              Email: <a href="mailto:legal@moccet.com">legal@moccet.com</a><br />
              Address: 555 California Street, San Francisco, CA 94104
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Have Questions?</h2>
          <p className={styles.finalCtaSubtitle}>
            Our legal team is here to help clarify any terms
          </p>
          <div className={styles.buttonRow}>
            <a href="mailto:legal@moccet.com" className={styles.ctaBtn}>Contact Legal</a>
            <Link href="/privacy" className={styles.watchVideoBtn}>Privacy Policy</Link>
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
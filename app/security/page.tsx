'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function SecurityPage() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <Link href="/contact" className={styles.contactSalesBtn}>
            Contact Security Team
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Security & Privacy</h1>
          <p className={styles.subtitle}>
            Enterprise-grade security and privacy protection for your most sensitive data
          </p>
        </section>

        {/* Security Overview */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Security is Non-Negotiable</h2>
            <p>
              In healthcare and enterprise AI, security isn&apos;t just a feature – it&apos;s the foundation.
              moccet implements defense-in-depth security strategies that protect your data at every
              layer, from infrastructure to application, ensuring your sensitive information remains
              secure and compliant with the strictest regulations.
            </p>
            <p>
              Our comprehensive security program combines cutting-edge technology, rigorous processes,
              and continuous monitoring to provide unparalleled protection for your data and operations.
            </p>
          </div>
        </section>

        {/* Security Architecture */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Multi-Layer Security Architecture</h2>

            <div className={styles.securityLayers}>
              <div className={styles.securityLayer}>
                <div className={styles.layerNumber}>1</div>
                <div className={styles.layerContent}>
                  <h3>Infrastructure Security</h3>
                  <ul>
                    <li>SOC 2 Type II certified cloud infrastructure</li>
                    <li>Physically secured data centers with 24/7 monitoring</li>
                    <li>Redundant systems across multiple geographic regions</li>
                    <li>Network segmentation and isolated environments</li>
                    <li>DDoS protection and traffic filtering</li>
                  </ul>
                </div>
              </div>

              <div className={styles.securityLayer}>
                <div className={styles.layerNumber}>2</div>
                <div className={styles.layerContent}>
                  <h3>Data Protection</h3>
                  <ul>
                    <li>AES-256 encryption for data at rest</li>
                    <li>TLS 1.3 encryption for all data in transit</li>
                    <li>Hardware Security Modules (HSM) for key management</li>
                    <li>Encrypted backups with immutable storage</li>
                    <li>Data loss prevention (DLP) controls</li>
                  </ul>
                </div>
              </div>

              <div className={styles.securityLayer}>
                <div className={styles.layerNumber}>3</div>
                <div className={styles.layerContent}>
                  <h3>Access Control</h3>
                  <ul>
                    <li>Multi-factor authentication (MFA) required for all users</li>
                    <li>Single Sign-On (SSO) with SAML 2.0 support</li>
                    <li>Role-based access control (RBAC) with least privilege</li>
                    <li>Just-in-time access provisioning</li>
                    <li>Comprehensive audit logging of all access</li>
                  </ul>
                </div>
              </div>

              <div className={styles.securityLayer}>
                <div className={styles.layerNumber}>4</div>
                <div className={styles.layerContent}>
                  <h3>Application Security</h3>
                  <ul>
                    <li>Secure software development lifecycle (SSDLC)</li>
                    <li>Regular penetration testing and vulnerability assessments</li>
                    <li>Static and dynamic application security testing</li>
                    <li>Container security scanning and runtime protection</li>
                    <li>Web Application Firewall (WAF) protection</li>
                  </ul>
                </div>
              </div>

              <div className={styles.securityLayer}>
                <div className={styles.layerNumber}>5</div>
                <div className={styles.layerContent}>
                  <h3>Monitoring & Response</h3>
                  <ul>
                    <li>24/7 Security Operations Center (SOC)</li>
                    <li>Real-time threat detection and response</li>
                    <li>Security Information and Event Management (SIEM)</li>
                    <li>Automated incident response procedures</li>
                    <li>Forensic capabilities and threat intelligence</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy Features */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Privacy by Design</h2>
            <p>
              Privacy isn&apos;t an afterthought – it&apos;s built into every aspect of our platform
              from the ground up. We implement privacy-preserving technologies that allow you
              to leverage AI while maintaining complete control over your data.
            </p>

            <div className={styles.privacyFeatures}>
              <div className={styles.privacyFeature}>
                <h3>Data Minimization</h3>
                <p>
                  We only collect and process the minimum data necessary to provide our services.
                  Automatic data retention policies ensure data is deleted when no longer needed.
                </p>
              </div>

              <div className={styles.privacyFeature}>
                <h3>De-identification & Anonymization</h3>
                <p>
                  Advanced techniques to remove or obscure personally identifiable information,
                  ensuring privacy while maintaining data utility for AI training and analysis.
                </p>
              </div>

              <div className={styles.privacyFeature}>
                <h3>Federated Learning</h3>
                <p>
                  Train AI models on distributed data without centralizing sensitive information.
                  Your data never leaves your environment, only model updates are shared.
                </p>
              </div>

              <div className={styles.privacyFeature}>
                <h3>Differential Privacy</h3>
                <p>
                  Mathematical guarantees that individual data points cannot be identified from
                  aggregated results, providing strong privacy protection for analytics.
                </p>
              </div>

              <div className={styles.privacyFeature}>
                <h3>Secure Multi-party Computation</h3>
                <p>
                  Enable collaborative analysis across organizations without sharing raw data,
                  perfect for multi-institutional research and benchmarking.
                </p>
              </div>

              <div className={styles.privacyFeature}>
                <h3>Data Residency Controls</h3>
                <p>
                  Choose where your data is stored and processed with geographic restrictions
                  to meet local regulations and organizational policies.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Compliance & Certifications */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Compliance & Certifications</h2>
            <p>
              We maintain the highest standards of compliance and regularly undergo independent
              audits to verify our security and privacy controls.
            </p>

            <div className={styles.complianceGrid}>
              <div className={styles.complianceCard}>
                <h3>HIPAA Compliant</h3>
                <p>
                  Fully compliant with HIPAA requirements for handling Protected Health
                  Information (PHI). We sign Business Associate Agreements (BAAs) with all
                  healthcare customers.
                </p>
              </div>

              <div className={styles.complianceCard}>
                <h3>SOC 2 Type II</h3>
                <p>
                  Annual SOC 2 Type II audit covering security, availability, processing
                  integrity, confidentiality, and privacy controls.
                </p>
              </div>

              <div className={styles.complianceCard}>
                <h3>ISO 27001</h3>
                <p>
                  ISO 27001 certified Information Security Management System (ISMS) with
                  continuous improvement and risk management.
                </p>
              </div>

              <div className={styles.complianceCard}>
                <h3>GDPR Compliant</h3>
                <p>
                  Full compliance with EU General Data Protection Regulation, including
                  data subject rights, lawful basis, and privacy by design.
                </p>
              </div>

              <div className={styles.complianceCard}>
                <h3>CCPA Compliant</h3>
                <p>
                  Compliance with California Consumer Privacy Act requirements for
                  transparency, control, and data subject rights.
                </p>
              </div>

              <div className={styles.complianceCard}>
                <h3>HITRUST CSF</h3>
                <p>
                  Working toward HITRUST CSF certification, the gold standard for
                  healthcare information security and privacy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Zero Trust Security */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Zero Trust Security Model</h2>
            <p>
              We implement a comprehensive Zero Trust architecture that assumes no implicit
              trust and continuously verifies every transaction, user, and device.
            </p>

            <div className={styles.zeroTrustPrinciples}>
              <div className={styles.zeroTrustPrinciple}>
                <h3>Never Trust, Always Verify</h3>
                <p>Every access request is authenticated, authorized, and encrypted regardless of source</p>
              </div>
              <div className={styles.zeroTrustPrinciple}>
                <h3>Least Privilege Access</h3>
                <p>Users and systems only get the minimum access required for their specific tasks</p>
              </div>
              <div className={styles.zeroTrustPrinciple}>
                <h3>Micro-segmentation</h3>
                <p>Network and application segmentation limits lateral movement in case of breach</p>
              </div>
              <div className={styles.zeroTrustPrinciple}>
                <h3>Continuous Validation</h3>
                <p>Ongoing verification of user, device, and application trustworthiness</p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Features */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Advanced Security Features</h2>

            <div className={styles.securityFeaturesGrid}>
              <div className={styles.securityFeatureCard}>
                <h3>Threat Intelligence</h3>
                <p>
                  Real-time threat intelligence feeds integrated with our security systems
                  to proactively identify and block emerging threats.
                </p>
              </div>

              <div className={styles.securityFeatureCard}>
                <h3>Vulnerability Management</h3>
                <p>
                  Continuous vulnerability scanning, patch management, and remediation
                  tracking to maintain a secure environment.
                </p>
              </div>

              <div className={styles.securityFeatureCard}>
                <h3>Audit Logging</h3>
                <p>
                  Comprehensive, tamper-proof audit logs of all system activities with
                  long-term retention and analysis capabilities.
                </p>
              </div>

              <div className={styles.securityFeatureCard}>
                <h3>Backup & Recovery</h3>
                <p>
                  Automated, encrypted backups with point-in-time recovery and tested
                  disaster recovery procedures.
                </p>
              </div>

              <div className={styles.securityFeatureCard}>
                <h3>Incident Response</h3>
                <p>
                  24/7 incident response team with defined procedures, escalation paths,
                  and communication protocols.
                </p>
              </div>

              <div className={styles.securityFeatureCard}>
                <h3>Secrets Management</h3>
                <p>
                  Centralized secrets management with automatic rotation, encryption,
                  and access controls for all credentials.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Governance */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Data Governance</h2>

            <h3>Data Classification</h3>
            <p>
              Automatic classification of data based on sensitivity levels with appropriate
              controls applied at each level.
            </p>

            <h3>Data Lifecycle Management</h3>
            <p>
              Comprehensive policies for data collection, processing, storage, retention,
              and deletion throughout the entire lifecycle.
            </p>

            <h3>Data Subject Rights</h3>
            <p>
              Full support for data subject rights including access, correction, deletion,
              portability, and consent management.
            </p>

            <h3>Cross-border Data Transfers</h3>
            <p>
              Secure mechanisms for international data transfers including Standard
              Contractual Clauses and adequacy decisions.
            </p>
          </div>
        </section>

        {/* Security Training */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Security Culture</h2>
            <p>
              Security is everyone&apos;s responsibility at moccet. We maintain a strong security
              culture through:
            </p>
            <ul>
              <li>Mandatory security awareness training for all employees</li>
              <li>Regular phishing simulations and security drills</li>
              <li>Secure coding training for all developers</li>
              <li>Security champions program across all teams</li>
              <li>Bug bounty program for responsible disclosure</li>
              <li>Regular security updates and threat briefings</li>
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Learn More About Our Security</h2>
          <p className={styles.finalCtaSubtitle}>
            Download our security whitepaper or schedule a security review with our team
          </p>
          <div className={styles.buttonRow}>
            <button className={styles.ctaBtn}>Download Security Whitepaper</button>
            <Link href="/contact" className={styles.watchVideoBtn}>Schedule Security Review</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Safety</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/safety">Safety Approach</Link></li>
                <li><Link href="/security">Security & Privacy</Link></li>
                <li><Link href="/trust">Trust & Transparency</Link></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Company</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/careers">Careers</Link></li>
                <li><Link href="/brand">Brand</Link></li>
                <li><Link href="/legal">Legal</Link></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Resources</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/research">Research</Link></li>
                <li><Link href="/business">Business</Link></li>
                <li><Link href="/solutions">Solutions</Link></li>
                <li><a href="#">Documentation</a></li>
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
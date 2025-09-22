'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function TrustPage() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <Link href="/contact" className={styles.contactSalesBtn}>
            Contact Us
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Trust & Transparency</h1>
          <p className={styles.subtitle}>
            Building trust through radical transparency in AI development and deployment
          </p>
        </section>

        {/* Trust Philosophy */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Trust is Earned, Not Given</h2>
            <p>
              At moccet, we understand that trust is the foundation of any successful AI deployment,
              especially in critical domains like healthcare. We earn your trust through radical
              transparency, consistent reliability, and unwavering commitment to ethical practices.
            </p>
            <p>
              We believe that transparency isn&apos;t just about being open – it&apos;s about making our
              technology understandable, our decisions accountable, and our impact measurable.
              Every aspect of our AI systems is designed to be transparent, interpretable, and
              aligned with your values and expectations.
            </p>
          </div>
        </section>

        {/* Transparency Pillars */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Transparency Pillars</h2>

            <div className={styles.transparencyGrid}>
              <div className={styles.transparencyCard}>
                <div className={styles.transparencyIcon}></div>
                <h3>Explainable AI</h3>
                <p>
                  Our AI systems don&apos;t just provide answers – they explain their reasoning.
                  Healthcare professionals can understand why specific recommendations are made,
                  what factors were considered, and how confident the system is in its conclusions.
                </p>
                <ul>
                  <li>Clear explanation of decision factors</li>
                  <li>Feature importance visualization</li>
                  <li>Confidence scores and uncertainty quantification</li>
                  <li>Traceable decision paths</li>
                </ul>
              </div>

              <div className={styles.transparencyCard}>
                <div className={styles.transparencyIcon}></div>
                <h3>Performance Transparency</h3>
                <p>
                  We openly share how our systems perform across different scenarios, populations,
                  and conditions. No cherry-picked metrics or hidden limitations – just honest,
                  comprehensive performance data.
                </p>
                <ul>
                  <li>Real-world performance metrics</li>
                  <li>Demographic performance breakdowns</li>
                  <li>Known limitations and edge cases</li>
                  <li>Continuous performance monitoring</li>
                </ul>
              </div>

              <div className={styles.transparencyCard}>
                <div className={styles.transparencyIcon}></div>
                <h3>Open Documentation</h3>
                <p>
                  Comprehensive documentation that covers not just how to use our systems, but
                  how they work, their limitations, and best practices for implementation.
                </p>
                <ul>
                  <li>Technical architecture details</li>
                  <li>Training data and methodologies</li>
                  <li>Validation and testing procedures</li>
                  <li>Integration guidelines</li>
                </ul>
              </div>

              <div className={styles.transparencyCard}>
                <div className={styles.transparencyIcon}></div>
                <h3>Ethical Transparency</h3>
                <p>
                  We&apos;re open about our ethical principles, decision-making processes, and how
                  we handle challenging ethical dilemmas in AI development.
                </p>
                <ul>
                  <li>Published ethical guidelines</li>
                  <li>Ethics committee decisions</li>
                  <li>Bias mitigation strategies</li>
                  <li>Fairness metrics and audits</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Through Accountability */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Trust Through Accountability</h2>
            <p>
              We hold ourselves accountable to the highest standards and provide mechanisms
              for oversight, feedback, and continuous improvement.
            </p>

            <div className={styles.accountabilityMeasures}>
              <div className={styles.accountabilityMeasure}>
                <h3>Third-Party Audits</h3>
                <p>
                  Regular independent audits of our AI systems, security practices, and
                  ethical compliance. All audit reports are made available to our customers.
                </p>
              </div>

              <div className={styles.accountabilityMeasure}>
                <h3>Public Reporting</h3>
                <p>
                  Quarterly transparency reports covering system performance, incidents,
                  improvements, and learnings shared with the broader community.
                </p>
              </div>

              <div className={styles.accountabilityMeasure}>
                <h3>Customer Advisory Board</h3>
                <p>
                  Direct input from healthcare organizations and clinicians guides our
                  development priorities and ethical considerations.
                </p>
              </div>

              <div className={styles.accountabilityMeasure}>
                <h3>Responsible Disclosure</h3>
                <p>
                  When issues arise, we communicate promptly and transparently, providing
                  full details and remediation plans.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Model Cards */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>AI Model Cards</h2>
            <p>
              Every AI model we deploy comes with a comprehensive Model Card that provides
              complete transparency about its capabilities, limitations, and appropriate use cases.
            </p>

            <div className={styles.modelCardSections}>
              <div className={styles.modelCardSection}>
                <h3>Model Details</h3>
                <ul>
                  <li>Architecture and version information</li>
                  <li>Training date and update history</li>
                  <li>Development team and contact</li>
                  <li>Licensing and usage terms</li>
                </ul>
              </div>

              <div className={styles.modelCardSection}>
                <h3>Intended Use</h3>
                <ul>
                  <li>Primary use cases and applications</li>
                  <li>Target users and contexts</li>
                  <li>Out-of-scope use cases</li>
                  <li>Known limitations</li>
                </ul>
              </div>

              <div className={styles.modelCardSection}>
                <h3>Performance Metrics</h3>
                <ul>
                  <li>Accuracy across different conditions</li>
                  <li>Precision, recall, and F1 scores</li>
                  <li>Performance by demographic groups</li>
                  <li>Comparison with baselines</li>
                </ul>
              </div>

              <div className={styles.modelCardSection}>
                <h3>Training Data</h3>
                <ul>
                  <li>Data sources and collection methods</li>
                  <li>Data volume and diversity</li>
                  <li>Preprocessing and augmentation</li>
                  <li>Privacy and consent procedures</li>
                </ul>
              </div>

              <div className={styles.modelCardSection}>
                <h3>Ethical Considerations</h3>
                <ul>
                  <li>Potential biases and mitigation</li>
                  <li>Fairness assessments</li>
                  <li>Privacy implications</li>
                  <li>Environmental impact</li>
                </ul>
              </div>

              <div className={styles.modelCardSection}>
                <h3>Updates & Monitoring</h3>
                <ul>
                  <li>Update schedule and process</li>
                  <li>Performance monitoring metrics</li>
                  <li>Drift detection methods</li>
                  <li>Feedback incorporation</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Transparency Reports */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Transparency Reports</h2>
            <p>
              We publish comprehensive transparency reports that provide insights into our
              operations, impact, and continuous improvement efforts.
            </p>

            <div className={styles.transparencyReports}>
              <div className={styles.reportCard}>
                <h3>Q4 2024 Transparency Report</h3>
                <p className={styles.reportDate}>Published: January 2025</p>
                <ul className={styles.reportHighlights}>
                  <li>99.97% system uptime achieved</li>
                  <li>3 security incidents detected and resolved</li>
                  <li>15% improvement in model fairness metrics</li>
                  <li>Zero data breaches</li>
                </ul>
                <button className={styles.downloadReportBtn}>Download Full Report</button>
              </div>

              <div className={styles.reportCard}>
                <h3>2024 Annual Impact Report</h3>
                <p className={styles.reportDate}>Published: January 2025</p>
                <ul className={styles.reportHighlights}>
                  <li>10M+ patients served</li>
                  <li>32% reduction in diagnostic errors</li>
                  <li>$2B in healthcare costs saved</li>
                  <li>500+ healthcare organizations partnered</li>
                </ul>
                <button className={styles.downloadReportBtn}>Download Full Report</button>
              </div>

              <div className={styles.reportCard}>
                <h3>AI Ethics & Fairness Report</h3>
                <p className={styles.reportDate}>Published: December 2024</p>
                <ul className={styles.reportHighlights}>
                  <li>Comprehensive fairness audits completed</li>
                  <li>Bias mitigation strategies implemented</li>
                  <li>Ethical review board recommendations</li>
                  <li>Community feedback incorporated</li>
                </ul>
                <button className={styles.downloadReportBtn}>Download Full Report</button>
              </div>
            </div>
          </div>
        </section>

        {/* Open Source Commitment */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Open Source & Community</h2>
            <p>
              We believe in giving back to the community and advancing the field through
              open collaboration. Many of our tools, frameworks, and research are open source,
              allowing others to verify, improve, and build upon our work.
            </p>

            <div className={styles.openSourceCommitments}>
              <div className={styles.commitmentItem}>
                <h3>Open Standards</h3>
                <p>We contribute to and adopt open standards for AI transparency and interoperability</p>
              </div>
              <div className={styles.commitmentItem}>
                <h3>Open Research</h3>
                <p>Our research papers and findings are published openly for peer review and validation</p>
              </div>
              <div className={styles.commitmentItem}>
                <h3>Open Tools</h3>
                <p>Key tools and frameworks are open-sourced for community benefit and scrutiny</p>
              </div>
              <div className={styles.commitmentItem}>
                <h3>Open Collaboration</h3>
                <p>We actively collaborate with academia, industry, and government on transparency initiatives</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Metrics */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Measuring Trust</h2>
            <p>
              We continuously measure and report on key trust indicators to ensure we&apos;re
              meeting our commitments to transparency and reliability.
            </p>

            <div className={styles.trustMetrics}>
              <div className={styles.trustMetric}>
                <h3>98%</h3>
                <p>Customer Trust Score</p>
                <span className={styles.metricDetail}>Based on quarterly surveys</span>
              </div>
              <div className={styles.trustMetric}>
                <h3>100%</h3>
                <p>Audit Compliance</p>
                <span className={styles.metricDetail}>All audits passed successfully</span>
              </div>
              <div className={styles.trustMetric}>
                <h3>24hr</h3>
                <p>Incident Disclosure</p>
                <span className={styles.metricDetail}>Average time to notify customers</span>
              </div>
              <div className={styles.trustMetric}>
                <h3>A+</h3>
                <p>Transparency Rating</p>
                <span className={styles.metricDetail}>Independent assessment score</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feedback Mechanisms */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Your Voice Matters</h2>
            <p>
              Trust is a two-way street. We provide multiple channels for feedback, concerns,
              and suggestions to ensure our systems meet your needs and expectations.
            </p>

            <div className={styles.feedbackChannels}>
              <div className={styles.feedbackChannel}>
                <h3>Direct Feedback</h3>
                <p>Email our transparency team directly at transparency@moccet.com</p>
              </div>
              <div className={styles.feedbackChannel}>
                <h3>User Advisory Groups</h3>
                <p>Participate in regular advisory sessions to shape our products</p>
              </div>
              <div className={styles.feedbackChannel}>
                <h3>Bug Bounty Program</h3>
                <p>Report security or ethical issues through our responsible disclosure program</p>
              </div>
              <div className={styles.feedbackChannel}>
                <h3>Community Forums</h3>
                <p>Engage with other users and our team in open discussions</p>
              </div>
            </div>
          </div>
        </section>

        {/* Commitments */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Commitments to You</h2>
            <div className={styles.commitmentsList}>
              <div className={styles.commitment}>
                <h3>No Black Boxes</h3>
                <p>Every AI decision can be explained and understood</p>
              </div>
              <div className={styles.commitment}>
                <h3>No Hidden Agendas</h3>
                <p>Our business model and incentives are transparent</p>
              </div>
              <div className={styles.commitment}>
                <h3>No Surprise Changes</h3>
                <p>Clear communication about updates and modifications</p>
              </div>
              <div className={styles.commitment}>
                <h3>No Data Exploitation</h3>
                <p>Your data is used only for agreed purposes</p>
              </div>
              <div className={styles.commitment}>
                <h3>No Vendor Lock-in</h3>
                <p>Data portability and interoperability guaranteed</p>
              </div>
              <div className={styles.commitment}>
                <h3>No Excuses</h3>
                <p>Full accountability for our systems and their impact</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Experience Transparent AI</h2>
          <p className={styles.finalCtaSubtitle}>
            See our commitment to trust and transparency in action
          </p>
          <div className={styles.buttonRow}>
            <button className={styles.ctaBtn}>View Latest Transparency Report</button>
            <Link href="/contact" className={styles.watchVideoBtn}>Schedule a Trust Review</Link>
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
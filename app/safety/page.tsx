'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function SafetyPage() {
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
          <h1>Our Safety Approach</h1>
          <p className={styles.subtitle}>
            Building AI systems that are safe, reliable, and aligned with human values
          </p>
        </section>

        {/* Safety Philosophy */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Safety is Our Foundation</h2>
            <p>
              At moccet, we believe that powerful AI systems must be built with safety as a
              core design principle, not an afterthought. Our comprehensive safety approach
              encompasses technical robustness, ethical considerations, and continuous monitoring
              to ensure our AI systems benefit humanity while minimizing potential risks.
            </p>
            <p>
              We recognize the profound impact AI can have on society, particularly in critical
              domains like healthcare. That&apos;s why we&apos;ve developed a multi-layered safety framework
              that guides every aspect of our research, development, and deployment processes.
            </p>
          </div>
        </section>

        {/* Safety Principles */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Core Safety Principles</h2>

            <div className={styles.principlesGrid}>
              <div className={styles.principleCard}>
                <div className={styles.principleIcon}></div>
                <h3>Robustness & Reliability</h3>
                <p>
                  Our AI systems are designed to perform reliably across diverse conditions,
                  with extensive testing for edge cases, adversarial inputs, and distributional
                  shifts. We implement multiple layers of validation to ensure consistent,
                  predictable behavior.
                </p>
              </div>

              <div className={styles.principleCard}>
                <div className={styles.principleIcon}></div>
                <h3>Alignment with Human Values</h3>
                <p>
                  We ensure our AI systems are aligned with human values and intentions,
                  particularly in healthcare contexts where decisions can have life-changing
                  consequences. Our models are trained to prioritize patient welfare and
                  clinical best practices.
                </p>
              </div>

              <div className={styles.principleCard}>
                <div className={styles.principleIcon}></div>
                <h3>Interpretability & Explainability</h3>
                <p>
                  We build AI systems that can explain their reasoning, especially for
                  high-stakes decisions. Healthcare professionals need to understand why
                  our systems make specific recommendations to maintain trust and accountability.
                </p>
              </div>

              <div className={styles.principleCard}>
                <div className={styles.principleIcon}></div>
                <h3>Fairness & Non-Discrimination</h3>
                <p>
                  We actively work to identify and mitigate biases in our AI systems,
                  ensuring equitable treatment across all demographics. Our models undergo
                  rigorous fairness audits to prevent discriminatory outcomes.
                </p>
              </div>

              <div className={styles.principleCard}>
                <div className={styles.principleIcon}></div>
                <h3>Privacy & Security by Design</h3>
                <p>
                  Patient privacy and data security are paramount. We implement state-of-the-art
                  privacy-preserving techniques including differential privacy, secure multi-party
                  computation, and federated learning.
                </p>
              </div>

              <div className={styles.principleCard}>
                <div className={styles.principleIcon}></div>
                <h3>Continuous Monitoring & Improvement</h3>
                <p>
                  Safety is an ongoing process. We continuously monitor our deployed systems,
                  gather feedback, and implement improvements. Our models are designed to
                  fail safely when encountering uncertain situations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Safety Measures */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Technical Safety Measures</h2>

            <h3>Multi-Layer Safety Architecture</h3>
            <p>
              Our systems employ multiple layers of safety controls, each designed to catch
              potential issues that might slip through other layers:
            </p>
            <ul>
              <li><strong>Input Validation:</strong> Rigorous checking of all inputs for anomalies, outliers, and potential adversarial examples</li>
              <li><strong>Model Uncertainty Quantification:</strong> Explicit modeling of uncertainty to know when the system is unsure</li>
              <li><strong>Output Verification:</strong> Multiple checks on model outputs before they reach end users</li>
              <li><strong>Human-in-the-Loop:</strong> Critical decisions always involve human review and approval</li>
              <li><strong>Rollback Capabilities:</strong> Ability to quickly revert to previous safe states if issues arise</li>
            </ul>

            <h3>Adversarial Robustness</h3>
            <p>
              We extensively test our models against adversarial attacks and edge cases:
            </p>
            <ul>
              <li>Regular red team exercises to identify vulnerabilities</li>
              <li>Adversarial training to improve model robustness</li>
              <li>Comprehensive test suites covering rare and extreme scenarios</li>
              <li>Continuous monitoring for unexpected behavior patterns</li>
            </ul>

            <h3>Safety Constraints & Guardrails</h3>
            <p>
              Our AI systems operate within carefully defined boundaries:
            </p>
            <ul>
              <li>Hard constraints on critical parameters and decisions</li>
              <li>Automatic escalation for high-risk or uncertain cases</li>
              <li>Rate limiting and anomaly detection for system abuse</li>
              <li>Comprehensive audit trails for all decisions and actions</li>
            </ul>
          </div>
        </section>

        {/* Safety in Healthcare */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Safety in Healthcare Applications</h2>
            <p>
              Healthcare presents unique safety challenges that require specialized approaches:
            </p>

            <div className={styles.healthcareSafetyGrid}>
              <div className={styles.healthcareSafetyCard}>
                <h3>Clinical Validation</h3>
                <p>
                  All our healthcare AI undergoes rigorous clinical validation through
                  prospective studies, ensuring safety and efficacy in real-world settings
                  before deployment.
                </p>
              </div>

              <div className={styles.healthcareSafetyCard}>
                <h3>FDA Compliance</h3>
                <p>
                  We work closely with regulatory bodies to ensure our systems meet or
                  exceed all safety requirements for medical devices and clinical decision
                  support systems.
                </p>
              </div>

              <div className={styles.healthcareSafetyCard}>
                <h3>Clinical Expert Oversight</h3>
                <p>
                  Medical professionals are involved at every stage of development and
                  deployment, ensuring our systems align with clinical best practices
                  and ethical standards.
                </p>
              </div>

              <div className={styles.healthcareSafetyCard}>
                <h3>Patient Safety Protocols</h3>
                <p>
                  Comprehensive protocols ensure patient safety is never compromised,
                  including fail-safe mechanisms and clear escalation procedures for
                  critical situations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Safety Research */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Safety Research & Innovation</h2>
            <p>
              We invest heavily in safety research to advance the field and develop new
              techniques for building safer AI systems:
            </p>

            <div className={styles.researchHighlights}>
              <div className={styles.researchHighlight}>
                <h3>Interpretable ML Models</h3>
                <p>
                  Developing new architectures that provide clear explanations for their
                  predictions without sacrificing performance.
                </p>
              </div>
              <div className={styles.researchHighlight}>
                <h3>Uncertainty Quantification</h3>
                <p>
                  Advanced techniques for models to accurately assess and communicate
                  their confidence levels in different scenarios.
                </p>
              </div>
              <div className={styles.researchHighlight}>
                <h3>Fairness Metrics</h3>
                <p>
                  Creating comprehensive fairness metrics and debiasing techniques
                  specifically for healthcare applications.
                </p>
              </div>
              <div className={styles.researchHighlight}>
                <h3>Safe Exploration</h3>
                <p>
                  Methods for AI systems to learn and improve while maintaining safety
                  constraints in deployment environments.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Safety Governance */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Safety Governance</h2>

            <h3>AI Ethics Committee</h3>
            <p>
              Our independent AI Ethics Committee includes ethicists, clinicians, patient
              advocates, and safety experts who review all major deployments and provide
              guidance on ethical considerations.
            </p>

            <h3>Safety Review Process</h3>
            <p>
              Every AI system undergoes comprehensive safety reviews at multiple stages:
            </p>
            <ol>
              <li><strong>Design Review:</strong> Safety considerations during system architecture</li>
              <li><strong>Pre-Training Review:</strong> Dataset and training methodology assessment</li>
              <li><strong>Post-Training Evaluation:</strong> Comprehensive testing and validation</li>
              <li><strong>Pre-Deployment Audit:</strong> Final safety checks and risk assessment</li>
              <li><strong>Post-Deployment Monitoring:</strong> Continuous safety monitoring and updates</li>
            </ol>

            <h3>Incident Response</h3>
            <p>
              We maintain a 24/7 incident response team trained to handle safety issues:
            </p>
            <ul>
              <li>Rapid response protocols for safety incidents</li>
              <li>Clear escalation procedures and decision authority</li>
              <li>Transparent communication with affected stakeholders</li>
              <li>Post-incident analysis and system improvements</li>
            </ul>
          </div>
        </section>

        {/* Transparency & Reporting */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Transparency & Accountability</h2>
            <p>
              We believe transparency is essential for AI safety. We regularly publish:
            </p>
            <ul>
              <li>Safety impact assessments for our AI systems</li>
              <li>Performance metrics across different demographics</li>
              <li>Incident reports and lessons learned</li>
              <li>Research papers on safety techniques and findings</li>
              <li>Third-party audit results and certifications</li>
            </ul>
          </div>
        </section>

        {/* Collaboration */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Industry Collaboration</h2>
            <p>
              We actively collaborate with the broader AI safety community to advance the
              field and establish best practices:
            </p>
            <div className={styles.collaborationList}>
              <ul>
                <li>Participation in AI safety consortiums and working groups</li>
                <li>Open-sourcing safety tools and frameworks</li>
                <li>Contributing to safety standards and regulations</li>
                <li>Sharing safety insights and best practices</li>
                <li>Supporting academic research in AI safety</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Learn More About Our Safety Commitment</h2>
          <p className={styles.finalCtaSubtitle}>
            Explore our safety research, read our latest safety report, or contact our team
          </p>
          <div className={styles.buttonRow}>
            <Link href="/research" className={styles.ctaBtn}>Safety Research</Link>
            <Link href="/contact" className={styles.watchVideoBtn}>Contact Safety Team</Link>
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
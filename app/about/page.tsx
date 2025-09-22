'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function AboutPage() {


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
          <h1>About moccet</h1>
          <p className={styles.subtitle}>
            Building the future of healthcare with AI-powered insights
          </p>
        </section>

        {/* Mission Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Mission</h2>
            <p>
              At moccet, we believe that healthcare should be proactive, not reactive.
              Our mission is to empower healthcare organizations with AI-driven insights
              that predict, prevent, and optimize patient outcomes before issues arise.
            </p>
            <p>
              We&apos;re building a future where every healthcare decision is informed by
              comprehensive data analysis, pattern recognition, and predictive modeling –
              making healthcare more efficient, effective, and accessible for everyone.
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Story</h2>
            <p>
              Founded in 2023 by a team of healthcare professionals, data scientists,
              and engineers, moccet emerged from a simple observation: healthcare systems
              were drowning in data but starving for insights.
            </p>
            <p>
              We saw clinicians spending hours on documentation, administrators struggling
              with resource allocation, and patients experiencing delays in care – all
              while valuable data sat unused in siloed systems.
            </p>
            <p>
              moccet was built to bridge this gap. By combining cutting-edge AI with
              deep healthcare expertise, we&apos;ve created a platform that transforms raw
              data into actionable intelligence, helping healthcare organizations work
              smarter, not harder.
            </p>
          </div>
        </section>

        {/* Values Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Values</h2>

            <h3>Patient-First Innovation</h3>
            <p>
              Every feature we build, every algorithm we develop, starts with a simple
              question: How will this improve patient outcomes? We never lose sight of
              the human element in healthcare.
            </p>

            <h3>Transparency & Trust</h3>
            <p>
              Healthcare decisions are too important for black boxes. We believe in
              explainable AI, clear communication, and building trust through
              transparency in everything we do.
            </p>

            <h3>Continuous Learning</h3>
            <p>
              Healthcare evolves daily, and so do we. We&apos;re committed to continuous
              improvement, staying at the forefront of medical research, and adapting
              our solutions to meet emerging challenges.
            </p>

            <h3>Privacy & Security</h3>
            <p>
              Patient data is sacred. We maintain the highest standards of data
              security, privacy compliance, and ethical data handling, ensuring that
              trust is never compromised.
            </p>
          </div>
        </section>

        {/* Team Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Team</h2>
            <p>
              moccet brings together over 100 professionals from diverse backgrounds –
              physicians, nurses, data scientists, engineers, designers, and healthcare
              administrators. This multidisciplinary approach ensures our solutions are
              both technically sophisticated and clinically relevant.
            </p>
            <p>
              Our leadership team has decades of combined experience across Mayo Clinic,
              Johns Hopkins, Google Health, Microsoft Research, and leading healthcare
              technology companies. But what unites us isn&apos;t our credentials – it&apos;s our
              shared commitment to transforming healthcare through intelligent technology.
            </p>
          </div>
        </section>

        {/* Impact Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Impact</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <h3>500+</h3>
                <p>Healthcare Organizations</p>
              </div>
              <div className={styles.statCard}>
                <h3>10M+</h3>
                <p>Patient Lives Improved</p>
              </div>
              <div className={styles.statCard}>
                <h3>30%</h3>
                <p>Average Efficiency Gain</p>
              </div>
              <div className={styles.statCard}>
                <h3>$2B+</h3>
                <p>Healthcare Costs Saved</p>
              </div>
            </div>
          </div>
        </section>

        {/* Looking Forward Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Looking Forward</h2>
            <p>
              The future of healthcare is being written now, and we&apos;re honored to be
              part of this transformation. As we continue to grow and evolve, our
              commitment remains unchanged: to build technology that makes healthcare
              better for everyone – patients, providers, and communities alike.
            </p>
            <p>
              Join us as we work toward a future where AI doesn&apos;t replace the human
              touch in healthcare, but amplifies it – where technology serves humanity,
              and where better health outcomes are accessible to all.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Ready to Transform Your Healthcare Organization?</h2>
          <p className={styles.finalCtaSubtitle}>
            Join hundreds of healthcare organizations already using moccet
          </p>
          <div className={styles.buttonRow}>
            <Link href="/" className={styles.ctaBtn}>Get Started</Link>
            <Link href="/careers" className={styles.watchVideoBtn}>Join Our Team</Link>
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
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
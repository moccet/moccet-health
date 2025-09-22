'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

export default function BusinessPage() {
  const [activeTab, setActiveTab] = useState('healthcare');

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <Link href="/contact" className={styles.contactSalesBtn}>
            Contact Sales
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>moccet for Business</h1>
          <p className={styles.subtitle}>
            Transform your organization with AI that understands your industry
          </p>
        </section>

        {/* Value Proposition */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Built for Enterprise Scale</h2>
            <p>
              moccet delivers enterprise-grade AI solutions that integrate seamlessly with
              your existing infrastructure. Our platform is designed to handle the complexity,
              security, and scale requirements of the world&apos;s largest organizations.
            </p>
          </div>
        </section>

        {/* Industry Solutions */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Industry Solutions</h2>

            <div className={styles.legalTabs}>
              <button
                className={`${styles.legalTab} ${activeTab === 'healthcare' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('healthcare')}
              >
                Healthcare
              </button>
              <button
                className={`${styles.legalTab} ${activeTab === 'finance' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('finance')}
              >
                Finance
              </button>
              <button
                className={`${styles.legalTab} ${activeTab === 'retail' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('retail')}
              >
                Retail
              </button>
              <button
                className={`${styles.legalTab} ${activeTab === 'manufacturing' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('manufacturing')}
              >
                Manufacturing
              </button>
              <button
                className={`${styles.legalTab} ${activeTab === 'education' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('education')}
              >
                Education
              </button>
            </div>

            {/* Healthcare Tab */}
            {activeTab === 'healthcare' && (
              <div className={styles.tabContent}>
                <h3>Healthcare & Life Sciences</h3>
                <p>
                  Revolutionize patient care with AI that understands clinical workflows,
                  predicts outcomes, and optimizes operations.
                </p>
                <h4>Key Solutions:</h4>
                <ul>
                  <li>Clinical decision support systems</li>
                  <li>Patient risk stratification</li>
                  <li>Operational efficiency optimization</li>
                  <li>Drug discovery acceleration</li>
                  <li>Population health management</li>
                </ul>
                <h4>Success Story:</h4>
                <p>
                  Major hospital network reduced readmission rates by 32% and saved $15M
                  annually using moccet&apos;s predictive analytics platform.
                </p>
              </div>
            )}

            {/* Finance Tab */}
            {activeTab === 'finance' && (
              <div className={styles.tabContent}>
                <h3>Financial Services</h3>
                <p>
                  Enhance risk management, fraud detection, and customer experience with
                  AI built for the financial sector.
                </p>
                <h4>Key Solutions:</h4>
                <ul>
                  <li>Real-time fraud detection</li>
                  <li>Credit risk assessment</li>
                  <li>Regulatory compliance automation</li>
                  <li>Customer service optimization</li>
                  <li>Investment strategy analysis</li>
                </ul>
                <h4>Success Story:</h4>
                <p>
                  Leading bank reduced fraud losses by 45% while improving legitimate
                  transaction approval rates by 12%.
                </p>
              </div>
            )}

            {/* Retail Tab */}
            {activeTab === 'retail' && (
              <div className={styles.tabContent}>
                <h3>Retail & E-commerce</h3>
                <p>
                  Personalize customer experiences and optimize operations with AI that
                  understands consumer behavior.
                </p>
                <h4>Key Solutions:</h4>
                <ul>
                  <li>Demand forecasting</li>
                  <li>Inventory optimization</li>
                  <li>Personalized recommendations</li>
                  <li>Price optimization</li>
                  <li>Supply chain management</li>
                </ul>
                <h4>Success Story:</h4>
                <p>
                  Global retailer increased revenue by 23% through AI-powered personalization
                  and reduced inventory costs by 18%.
                </p>
              </div>
            )}

            {/* Manufacturing Tab */}
            {activeTab === 'manufacturing' && (
              <div className={styles.tabContent}>
                <h3>Manufacturing & Industrial</h3>
                <p>
                  Optimize production, predict maintenance needs, and ensure quality with
                  industrial AI solutions.
                </p>
                <h4>Key Solutions:</h4>
                <ul>
                  <li>Predictive maintenance</li>
                  <li>Quality control automation</li>
                  <li>Supply chain optimization</li>
                  <li>Energy efficiency management</li>
                  <li>Production planning optimization</li>
                </ul>
                <h4>Success Story:</h4>
                <p>
                  Automotive manufacturer reduced unplanned downtime by 40% and improved
                  overall equipment effectiveness by 25%.
                </p>
              </div>
            )}

            {/* Education Tab */}
            {activeTab === 'education' && (
              <div className={styles.tabContent}>
                <h3>Education & Research</h3>
                <p>
                  Transform learning outcomes and accelerate research with AI designed for
                  academic institutions.
                </p>
                <h4>Key Solutions:</h4>
                <ul>
                  <li>Personalized learning paths</li>
                  <li>Student success prediction</li>
                  <li>Research acceleration tools</li>
                  <li>Administrative automation</li>
                  <li>Academic integrity monitoring</li>
                </ul>
                <h4>Success Story:</h4>
                <p>
                  University improved graduation rates by 28% using moccet&apos;s student success
                  prediction and intervention system.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Enterprise Features */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Enterprise-Grade Features</h2>

            <div className={styles.benefitsGrid}>
              <div className={styles.benefitCard}>
                <h3>Security First</h3>
                <p>SOC 2 Type II certified, HIPAA compliant, with end-to-end encryption</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Scalability</h3>
                <p>Handle millions of transactions per second with auto-scaling infrastructure</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Integration Ready</h3>
                <p>Pre-built connectors for major enterprise systems and APIs</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Global Deployment</h3>
                <p>Multi-region support with data residency options</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Advanced Analytics</h3>
                <p>Real-time dashboards and customizable reporting</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Dedicated Support</h3>
                <p>24/7 enterprise support with dedicated success managers</p>
              </div>
            </div>
          </div>
        </section>

        {/* ROI Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Proven ROI</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <h3>3.5x</h3>
                <p>Average ROI in Year 1</p>
              </div>
              <div className={styles.statCard}>
                <h3>45%</h3>
                <p>Reduction in Operational Costs</p>
              </div>
              <div className={styles.statCard}>
                <h3>60%</h3>
                <p>Faster Decision Making</p>
              </div>
              <div className={styles.statCard}>
                <h3>90%</h3>
                <p>User Satisfaction Rate</p>
              </div>
            </div>
          </div>
        </section>

        {/* Implementation Process */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Implementation Process</h2>
            <p>
              Our proven implementation methodology ensures successful deployment and
              rapid time to value.
            </p>

            <div className={styles.processSteps}>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>1</div>
                <div>
                  <h3>Discovery & Assessment</h3>
                  <p>Understand your unique challenges and objectives</p>
                </div>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>2</div>
                <div>
                  <h3>Solution Design</h3>
                  <p>Architect a customized solution for your needs</p>
                </div>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>3</div>
                <div>
                  <h3>Pilot Program</h3>
                  <p>Prove value with a focused initial deployment</p>
                </div>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>4</div>
                <div>
                  <h3>Full Deployment</h3>
                  <p>Scale across your organization with confidence</p>
                </div>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>5</div>
                <div>
                  <h3>Optimization</h3>
                  <p>Continuously improve and expand capabilities</p>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Ready to Transform Your Business?</h2>
          <p className={styles.finalCtaSubtitle}>
            See how moccet can deliver measurable impact for your organization
          </p>
          <div className={styles.buttonRow}>
            <Link href="/contact" className={styles.ctaBtn}>Schedule a Demo</Link>
            <Link href="/solutions" className={styles.watchVideoBtn}>Explore Solutions</Link>
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
                <li><Link href="/business">Business</Link></li>
                <li><Link href="/solutions">Solutions</Link></li>
                <li><a href="#">Pricing</a></li>
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
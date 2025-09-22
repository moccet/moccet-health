'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

export default function APIPlatformPage() {
  const [selectedAPI, setSelectedAPI] = useState('clinical');

  const apiEndpoints = {
    clinical: [
      { method: 'POST', path: '/v1/clinical/predict', description: 'Generate clinical predictions' },
      { method: 'POST', path: '/v1/clinical/diagnose', description: 'Diagnostic assistance' },
      { method: 'GET', path: '/v1/clinical/risk/:patientId', description: 'Get patient risk scores' },
      { method: 'POST', path: '/v1/clinical/recommendations', description: 'Treatment recommendations' }
    ],
    documentation: [
      { method: 'POST', path: '/v1/docs/generate', description: 'Generate clinical documentation' },
      { method: 'POST', path: '/v1/docs/transcribe', description: 'Transcribe medical audio' },
      { method: 'POST', path: '/v1/docs/summarize', description: 'Summarize medical records' },
      { method: 'POST', path: '/v1/docs/code', description: 'Medical coding assistance' }
    ],
    medications: [
      { method: 'POST', path: '/v1/meds/interactions', description: 'Check drug interactions' },
      { method: 'POST', path: '/v1/meds/dosage', description: 'Dosage recommendations' },
      { method: 'GET', path: '/v1/meds/alternatives/:drugId', description: 'Find alternatives' },
      { method: 'POST', path: '/v1/meds/adherence', description: 'Monitor adherence' }
    ],
    imaging: [
      { method: 'POST', path: '/v1/imaging/analyze', description: 'Analyze medical images' },
      { method: 'POST', path: '/v1/imaging/detect', description: 'Detect anomalies' },
      { method: 'POST', path: '/v1/imaging/segment', description: 'Image segmentation' },
      { method: 'POST', path: '/v1/imaging/compare', description: 'Compare images' }
    ]
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <button className={styles.contactSalesBtn}>
            Get Started Free
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>moccet API Platform</h1>
          <p className={styles.subtitle}>
            The most comprehensive healthcare AI APIs for developers
          </p>
        </section>

        {/* Platform Overview */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Enterprise-Ready Healthcare APIs</h2>
            <p>
              The moccet API Platform provides secure, scalable, and HIPAA-compliant APIs
              that power healthcare applications worldwide. From clinical decision support
              to medical documentation, our APIs handle the AI complexity so you can focus
              on building great healthcare solutions.
            </p>
          </div>
        </section>

        {/* Key Features */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Platform Features</h2>

            <div className={styles.platformFeatures}>
              <div className={styles.platformFeature}>
                <h3>Lightning Fast</h3>
                <p>Sub-100ms response times with global edge deployment</p>
              </div>
              <div className={styles.platformFeature}>
                <h3>HIPAA Compliant</h3>
                <p>Full HIPAA compliance with BAA available</p>
              </div>
              <div className={styles.platformFeature}>
                <h3>99.99% Uptime</h3>
                <p>Enterprise SLA with guaranteed availability</p>
              </div>
              <div className={styles.platformFeature}>
                <h3>Global Scale</h3>
                <p>Handle millions of requests across multiple regions</p>
              </div>
              <div className={styles.platformFeature}>
                <h3>Version Control</h3>
                <p>Backward compatible APIs with versioning</p>
              </div>
              <div className={styles.platformFeature}>
                <h3>Real-time Analytics</h3>
                <p>Monitor usage, performance, and costs in real-time</p>
              </div>
            </div>
          </div>
        </section>

        {/* API Reference */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>API Reference</h2>

            <div className={styles.apiReference}>
              <div className={styles.apiCategories}>
                <button
                  className={`${styles.apiCategory} ${selectedAPI === 'clinical' ? styles.apiCategoryActive : ''}`}
                  onClick={() => setSelectedAPI('clinical')}
                >
                  Clinical APIs
                </button>
                <button
                  className={`${styles.apiCategory} ${selectedAPI === 'documentation' ? styles.apiCategoryActive : ''}`}
                  onClick={() => setSelectedAPI('documentation')}
                >
                  Documentation APIs
                </button>
                <button
                  className={`${styles.apiCategory} ${selectedAPI === 'medications' ? styles.apiCategoryActive : ''}`}
                  onClick={() => setSelectedAPI('medications')}
                >
                  Medication APIs
                </button>
                <button
                  className={`${styles.apiCategory} ${selectedAPI === 'imaging' ? styles.apiCategoryActive : ''}`}
                  onClick={() => setSelectedAPI('imaging')}
                >
                  Imaging APIs
                </button>
              </div>

              <div className={styles.apiEndpoints}>
                {apiEndpoints[selectedAPI as keyof typeof apiEndpoints].map((endpoint, index) => (
                  <div key={index} className={styles.apiEndpoint}>
                    <div className={styles.endpointHeader}>
                      <span className={`${styles.methodBadge} ${styles[`method${endpoint.method}`]}`}>
                        {endpoint.method}
                      </span>
                      <code className={styles.endpointPath}>{endpoint.path}</code>
                    </div>
                    <p className={styles.endpointDescription}>{endpoint.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Integration Examples */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Easy Integration</h2>
            <p>Get started in minutes with our comprehensive SDKs and examples:</p>

            <div className={styles.integrationExample}>
              <h3>Example: Clinical Risk Prediction</h3>
              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>
                  <span>cURL</span>
                </div>
                <pre className={styles.code}>
{`curl -X POST https://api.moccet.com/v1/clinical/predict \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "patient": {
      "age": 65,
      "gender": "male",
      "conditions": ["diabetes", "hypertension"]
    },
    "vitals": {
      "bloodPressure": "140/90",
      "heartRate": 85,
      "temperature": 98.6
    }
  }'`}
                </pre>
              </div>

              <div className={styles.responseExample}>
                <h4>Response:</h4>
                <div className={styles.codeBlock}>
                  <pre className={styles.code}>
{`{
  "riskScore": 0.73,
  "riskLevel": "high",
  "factors": [
    {
      "name": "Hypertension",
      "contribution": 0.35
    },
    {
      "name": "Age",
      "contribution": 0.25
    }
  ],
  "recommendations": [
    "Immediate blood pressure management",
    "Cardiac monitoring recommended"
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Built for Every Healthcare Use Case</h2>

            <div className={styles.useCaseGrid}>
              <div className={styles.useCaseCard}>
                <h3>Hospital Systems</h3>
                <p>Integrate AI into EHR systems for real-time clinical decision support</p>
              </div>
              <div className={styles.useCaseCard}>
                <h3>Digital Therapeutics</h3>
                <p>Power personalized treatment apps with intelligent recommendations</p>
              </div>
              <div className={styles.useCaseCard}>
                <h3>Telemedicine</h3>
                <p>Enhance virtual consultations with AI-powered diagnostics</p>
              </div>
              <div className={styles.useCaseCard}>
                <h3>Health Apps</h3>
                <p>Add clinical intelligence to consumer health applications</p>
              </div>
              <div className={styles.useCaseCard}>
                <h3>Research Platforms</h3>
                <p>Accelerate clinical research with automated analysis</p>
              </div>
              <div className={styles.useCaseCard}>
                <h3>Health Insurance</h3>
                <p>Improve risk assessment and care management</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Simple, Transparent Pricing</h2>

            <div className={styles.apiPricingGrid}>
              <div className={styles.apiPricingCard}>
                <h3>Free Tier</h3>
                <div className={styles.apiPrice}>$0<span>/month</span></div>
                <ul className={styles.apiPricingFeatures}>
                  <li>1,000 API calls/month</li>
                  <li>10 requests/minute</li>
                  <li>Community support</li>
                  <li>Basic analytics</li>
                  <li>Test environment</li>
                </ul>
                <button className={styles.apiPricingBtn}>Start Free</button>
              </div>

              <div className={styles.apiPricingCard}>
                <div className={styles.popularBadge}>Most Popular</div>
                <h3>Professional</h3>
                <div className={styles.apiPrice}>$999<span>/month</span></div>
                <ul className={styles.apiPricingFeatures}>
                  <li>1M API calls/month</li>
                  <li>1,000 requests/minute</li>
                  <li>Priority support</li>
                  <li>Advanced analytics</li>
                  <li>Production environment</li>
                  <li>99.9% SLA</li>
                </ul>
                <button className={styles.apiPricingBtn}>Start Trial</button>
              </div>

              <div className={styles.apiPricingCard}>
                <h3>Enterprise</h3>
                <div className={styles.apiPrice}>Custom</div>
                <ul className={styles.apiPricingFeatures}>
                  <li>Unlimited API calls</li>
                  <li>Custom rate limits</li>
                  <li>Dedicated support</li>
                  <li>Custom analytics</li>
                  <li>Multiple environments</li>
                  <li>99.99% SLA</li>
                  <li>BAA available</li>
                </ul>
                <button className={styles.apiPricingBtn}>Contact Sales</button>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Compliance */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Enterprise Security & Compliance</h2>

            <div className={styles.complianceBadges}>
              <div className={styles.complianceBadge}>
                <h3>HIPAA</h3>
                <p>Fully HIPAA compliant with BAA</p>
              </div>
              <div className={styles.complianceBadge}>
                <h3>SOC 2</h3>
                <p>Type II certified</p>
              </div>
              <div className={styles.complianceBadge}>
                <h3>ISO 27001</h3>
                <p>Certified ISMS</p>
              </div>
              <div className={styles.complianceBadge}>
                <h3>GDPR</h3>
                <p>Full compliance</p>
              </div>
            </div>

            <div className={styles.securityFeatures}>
              <ul>
                <li>End-to-end encryption for all API calls</li>
                <li>OAuth 2.0 and API key authentication</li>
                <li>IP whitelisting and rate limiting</li>
                <li>Comprehensive audit logging</li>
                <li>Regular security audits and penetration testing</li>
                <li>24/7 security monitoring</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Developer Resources */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Developer Resources</h2>

            <div className={styles.resourceCards}>
              <div className={styles.resourceCard}>
                <h3>API Documentation</h3>
                <p>Complete reference with examples</p>
                <a href="#" className={styles.resourceLink}>View Docs →</a>
              </div>
              <div className={styles.resourceCard}>
                <h3>Quick Start Guide</h3>
                <p>Get up and running in 5 minutes</p>
                <a href="#" className={styles.resourceLink}>Start Tutorial →</a>
              </div>
              <div className={styles.resourceCard}>
                <h3>API Changelog</h3>
                <p>Stay updated with latest changes</p>
                <a href="#" className={styles.resourceLink}>View Changes →</a>
              </div>
              <div className={styles.resourceCard}>
                <h3>Developer Forum</h3>
                <p>Get help from the community</p>
                <a href="#" className={styles.resourceLink}>Join Forum →</a>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Start Building with moccet APIs</h2>
          <p className={styles.finalCtaSubtitle}>
            Get your API key and make your first call in minutes
          </p>
          <div className={styles.buttonRow}>
            <button className={styles.ctaBtn}>Get API Key</button>
            <Link href="/developers" className={styles.watchVideoBtn}>View Documentation</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Platform</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/api-platform">API Platform</Link></li>
                <li><Link href="/developers">Developers</Link></li>
                <li><a href="#">API Status</a></li>
                <li><a href="#">Changelog</a></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Company</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/careers">Careers</Link></li>
                <li><Link href="/news">News</Link></li>
                <li><Link href="/brand">Brand</Link></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Resources</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/research">Research</Link></li>
                <li><Link href="/safety">Safety</Link></li>
                <li><Link href="/business">Business</Link></li>
                <li><Link href="/solutions">Solutions</Link></li>
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
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState('quickstart');

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <Link href="/api-platform" className={styles.contactSalesBtn}>
            Get API Key
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Build with moccet</h1>
          <p className={styles.subtitle}>
            Powerful APIs and SDKs to integrate AI into your healthcare applications
          </p>
        </section>

        {/* Developer Overview */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Developer-First Healthcare AI</h2>
            <p>
              moccet provides comprehensive APIs, SDKs, and tools that enable developers to
              integrate advanced healthcare AI capabilities into their applications. Whether
              you&apos;re building a new healthcare platform or enhancing existing systems, our
              developer tools make it easy to add intelligent features.
            </p>
          </div>
        </section>

        {/* Quick Start Guide */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Quick Start</h2>

            <div className={styles.legalTabs}>
              <button
                className={`${styles.legalTab} ${activeTab === 'quickstart' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('quickstart')}
              >
                Installation
              </button>
              <button
                className={`${styles.legalTab} ${activeTab === 'authentication' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('authentication')}
              >
                Authentication
              </button>
              <button
                className={`${styles.legalTab} ${activeTab === 'firstcall' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('firstcall')}
              >
                First API Call
              </button>
              <button
                className={`${styles.legalTab} ${activeTab === 'examples' ? styles.legalTabActive : ''}`}
                onClick={() => setActiveTab('examples')}
              >
                Examples
              </button>
            </div>

            {activeTab === 'quickstart' && (
              <div className={styles.codeSection}>
                <h3>Install moccet SDK</h3>
                <div className={styles.codeBlock}>
                  <div className={styles.codeHeader}>
                    <span>Node.js</span>
                  </div>
                  <pre className={styles.code}>
{`npm install @moccet/sdk
# or
yarn add @moccet/sdk`}
                  </pre>
                </div>

                <div className={styles.codeBlock}>
                  <div className={styles.codeHeader}>
                    <span>Python</span>
                  </div>
                  <pre className={styles.code}>
{`pip install moccet
# or
poetry add moccet`}
                  </pre>
                </div>

                <div className={styles.codeBlock}>
                  <div className={styles.codeHeader}>
                    <span>Go</span>
                  </div>
                  <pre className={styles.code}>
{`go get github.com/moccet/moccet-go`}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'authentication' && (
              <div className={styles.codeSection}>
                <h3>API Authentication</h3>
                <p>All API requests require authentication using your API key:</p>
                <div className={styles.codeBlock}>
                  <div className={styles.codeHeader}>
                    <span>JavaScript</span>
                  </div>
                  <pre className={styles.code}>
{`import { Moccet } from '@moccet/sdk';

const moccet = new Moccet({
  apiKey: process.env.MOCCET_API_KEY,
  environment: 'production'
});`}
                  </pre>
                </div>

                <div className={styles.codeBlock}>
                  <div className={styles.codeHeader}>
                    <span>Python</span>
                  </div>
                  <pre className={styles.code}>
{`from moccet import Client

client = Client(
    api_key=os.environ["MOCCET_API_KEY"],
    environment="production"
)`}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'firstcall' && (
              <div className={styles.codeSection}>
                <h3>Your First API Call</h3>
                <p>Make a simple prediction using our Clinical Insights API:</p>
                <div className={styles.codeBlock}>
                  <div className={styles.codeHeader}>
                    <span>JavaScript</span>
                  </div>
                  <pre className={styles.code}>
{`const prediction = await moccet.clinical.predict({
  patientId: "12345",
  data: {
    age: 65,
    symptoms: ["chest pain", "shortness of breath"],
    vitals: {
      bloodPressure: "140/90",
      heartRate: 95
    }
  }
});

console.log(prediction.riskScore);
console.log(prediction.recommendations);`}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'examples' && (
              <div className={styles.codeSection}>
                <h3>Common Use Cases</h3>

                <h4>Risk Stratification</h4>
                <div className={styles.codeBlock}>
                  <pre className={styles.code}>
{`const risk = await moccet.risk.assess({
  patient: patientData,
  conditions: ['diabetes', 'hypertension'],
  timeframe: '30_days'
});`}
                  </pre>
                </div>

                <h4>Clinical Documentation</h4>
                <div className={styles.codeBlock}>
                  <pre className={styles.code}>
{`const note = await moccet.documentation.generate({
  encounter: encounterData,
  template: 'soap_note',
  style: 'comprehensive'
});`}
                  </pre>
                </div>

                <h4>Drug Interactions</h4>
                <div className={styles.codeBlock}>
                  <pre className={styles.code}>
{`const interactions = await moccet.medications.checkInteractions({
  current: ['metformin', 'lisinopril'],
  proposed: 'atorvastatin'
});`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* API Features */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>API Capabilities</h2>

            <div className={styles.apiFeatures}>
              <div className={styles.apiFeature}>
                <h3>Clinical Intelligence</h3>
                <ul>
                  <li>Risk prediction and stratification</li>
                  <li>Diagnosis assistance</li>
                  <li>Treatment recommendations</li>
                  <li>Clinical decision support</li>
                </ul>
              </div>

              <div className={styles.apiFeature}>
                <h3>Documentation</h3>
                <ul>
                  <li>Automated clinical note generation</li>
                  <li>Voice-to-text transcription</li>
                  <li>Medical coding assistance</li>
                  <li>Report summarization</li>
                </ul>
              </div>

              <div className={styles.apiFeature}>
                <h3>Medication Management</h3>
                <ul>
                  <li>Drug interaction checking</li>
                  <li>Dosage optimization</li>
                  <li>Adherence monitoring</li>
                  <li>Alternative recommendations</li>
                </ul>
              </div>

              <div className={styles.apiFeature}>
                <h3>Lab & Imaging</h3>
                <ul>
                  <li>Lab result interpretation</li>
                  <li>Anomaly detection</li>
                  <li>Trend analysis</li>
                  <li>Image analysis APIs</li>
                </ul>
              </div>

              <div className={styles.apiFeature}>
                <h3>Population Health</h3>
                <ul>
                  <li>Cohort analysis</li>
                  <li>Outbreak detection</li>
                  <li>Resource optimization</li>
                  <li>Quality metrics</li>
                </ul>
              </div>

              <div className={styles.apiFeature}>
                <h3>Compliance & Security</h3>
                <ul>
                  <li>HIPAA-compliant endpoints</li>
                  <li>Audit logging</li>
                  <li>Data encryption</li>
                  <li>Access controls</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SDKs & Libraries */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>SDKs & Libraries</h2>
            <p>
              Official SDKs available for all major programming languages and frameworks:
            </p>

            <div className={styles.sdkGrid}>
              <div className={styles.sdkCard}>
                <h3>JavaScript/TypeScript</h3>
                <p>Full TypeScript support with type definitions</p>
                <div className={styles.sdkLinks}>
                  <a href="#" className={styles.sdkLink}>npm Package</a>
                  <a href="#" className={styles.sdkLink}>GitHub</a>
                  <a href="#" className={styles.sdkLink}>Docs</a>
                </div>
              </div>

              <div className={styles.sdkCard}>
                <h3>Python</h3>
                <p>Async support with comprehensive type hints</p>
                <div className={styles.sdkLinks}>
                  <a href="#" className={styles.sdkLink}>PyPI Package</a>
                  <a href="#" className={styles.sdkLink}>GitHub</a>
                  <a href="#" className={styles.sdkLink}>Docs</a>
                </div>
              </div>

              <div className={styles.sdkCard}>
                <h3>Go</h3>
                <p>Idiomatic Go with full concurrency support</p>
                <div className={styles.sdkLinks}>
                  <a href="#" className={styles.sdkLink}>Go Package</a>
                  <a href="#" className={styles.sdkLink}>GitHub</a>
                  <a href="#" className={styles.sdkLink}>Docs</a>
                </div>
              </div>

              <div className={styles.sdkCard}>
                <h3>Java</h3>
                <p>Compatible with Java 8+ and Spring Boot</p>
                <div className={styles.sdkLinks}>
                  <a href="#" className={styles.sdkLink}>Maven</a>
                  <a href="#" className={styles.sdkLink}>GitHub</a>
                  <a href="#" className={styles.sdkLink}>Docs</a>
                </div>
              </div>

              <div className={styles.sdkCard}>
                <h3>.NET</h3>
                <p>C# SDK with .NET Core and Framework support</p>
                <div className={styles.sdkLinks}>
                  <a href="#" className={styles.sdkLink}>NuGet</a>
                  <a href="#" className={styles.sdkLink}>GitHub</a>
                  <a href="#" className={styles.sdkLink}>Docs</a>
                </div>
              </div>

              <div className={styles.sdkCard}>
                <h3>Ruby</h3>
                <p>Ruby gem with Rails integration</p>
                <div className={styles.sdkLinks}>
                  <a href="#" className={styles.sdkLink}>RubyGems</a>
                  <a href="#" className={styles.sdkLink}>GitHub</a>
                  <a href="#" className={styles.sdkLink}>Docs</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Developer Tools */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Developer Tools</h2>

            <div className={styles.devTools}>
              <div className={styles.devTool}>
                <h3>API Playground</h3>
                <p>Test API endpoints directly in your browser with our interactive playground</p>
                <button className={styles.toolBtn}>Open Playground</button>
              </div>

              <div className={styles.devTool}>
                <h3>Documentation</h3>
                <p>Comprehensive API reference with examples in multiple languages</p>
                <button className={styles.toolBtn}>View Docs</button>
              </div>

              <div className={styles.devTool}>
                <h3>API Explorer</h3>
                <p>Browse and search all available endpoints with live examples</p>
                <button className={styles.toolBtn}>Explore APIs</button>
              </div>

              <div className={styles.devTool}>
                <h3>Dashboard</h3>
                <p>Monitor API usage, performance metrics, and manage API keys</p>
                <button className={styles.toolBtn}>Open Dashboard</button>
              </div>

              <div className={styles.devTool}>
                <h3>CLI Tool</h3>
                <p>Command-line interface for API testing and automation</p>
                <button className={styles.toolBtn}>Install CLI</button>
              </div>

              <div className={styles.devTool}>
                <h3>Postman Collection</h3>
                <p>Pre-configured Postman collection with all API endpoints</p>
                <button className={styles.toolBtn}>Download Collection</button>
              </div>
            </div>
          </div>
        </section>

        {/* Rate Limits & Pricing */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Rate Limits & Pricing</h2>

            <table className={styles.pricingTable}>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Rate Limit</th>
                  <th>Monthly Requests</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Free</td>
                  <td>10 req/min</td>
                  <td>1,000</td>
                  <td>$0</td>
                </tr>
                <tr>
                  <td>Starter</td>
                  <td>100 req/min</td>
                  <td>100,000</td>
                  <td>$99/mo</td>
                </tr>
                <tr>
                  <td>Professional</td>
                  <td>1,000 req/min</td>
                  <td>1,000,000</td>
                  <td>$999/mo</td>
                </tr>
                <tr>
                  <td>Enterprise</td>
                  <td>Custom</td>
                  <td>Unlimited</td>
                  <td>Contact Sales</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Community */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Developer Community</h2>

            <div className={styles.communityLinks}>
              <div className={styles.communityLink}>
                <h3>Discord</h3>
                <p>Join 5,000+ developers building with moccet</p>
                <button className={styles.joinBtn}>Join Discord</button>
              </div>

              <div className={styles.communityLink}>
                <h3>GitHub</h3>
                <p>Contribute to our open-source projects</p>
                <button className={styles.joinBtn}>View Repos</button>
              </div>

              <div className={styles.communityLink}>
                <h3>YouTube</h3>
                <p>Tutorials, demos, and technical deep-dives</p>
                <button className={styles.joinBtn}>Watch Videos</button>
              </div>

              <div className={styles.communityLink}>
                <h3>Newsletter</h3>
                <p>API updates, new features, and best practices</p>
                <button className={styles.joinBtn}>Subscribe</button>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Start Building Today</h2>
          <p className={styles.finalCtaSubtitle}>
            Get your API key and build the future of healthcare
          </p>
          <div className={styles.buttonRow}>
            <Link href="/api-platform" className={styles.ctaBtn}>Get API Key</Link>
            <a href="#" className={styles.watchVideoBtn}>View Documentation</a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Developers</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/developers">Overview</Link></li>
                <li><Link href="/api-platform">API Platform</Link></li>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">SDKs</a></li>
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
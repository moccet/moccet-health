'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

interface Solution {
  id: string;
  title: string;
  category: string;
  description: string;
  features: string[];
  benefits: string[];
  icon: string;
}

export default function SolutionsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const solutions: Solution[] = [
    {
      id: 'clinical-insights',
      title: 'Clinical Insights Platform',
      category: 'Healthcare',
      description: 'Real-time clinical decision support powered by AI analysis of patient data, medical literature, and treatment outcomes.',
      features: [
        'Predictive risk scoring',
        'Treatment recommendation engine',
        'Drug interaction analysis',
        'Clinical pathway optimization'
      ],
      benefits: [
        'Reduce diagnostic errors by 45%',
        'Improve treatment outcomes by 32%',
        'Save 2+ hours per clinician daily'
      ],
      icon: ''
    },
    {
      id: 'operational-excellence',
      title: 'Operational Excellence Suite',
      category: 'Operations',
      description: 'Optimize workflows, reduce costs, and improve efficiency across your entire organization.',
      features: [
        'Resource allocation optimization',
        'Predictive maintenance',
        'Supply chain management',
        'Capacity planning'
      ],
      benefits: [
        'Cut operational costs by 30%',
        'Reduce downtime by 50%',
        'Improve resource utilization by 40%'
      ],
      icon: ''
    },
    {
      id: 'customer-intelligence',
      title: 'Customer Intelligence Platform',
      category: 'Customer Experience',
      description: 'Understand and predict customer behavior to deliver personalized experiences at scale.',
      features: [
        'Behavioral analytics',
        'Churn prediction',
        'Personalization engine',
        'Sentiment analysis'
      ],
      benefits: [
        'Increase retention by 25%',
        'Boost conversion rates by 35%',
        'Improve NPS scores by 20 points'
      ],
      icon: ''
    },
    {
      id: 'risk-management',
      title: 'Risk Management System',
      category: 'Risk & Compliance',
      description: 'Identify, assess, and mitigate risks across your organization with AI-powered analytics.',
      features: [
        'Real-time risk monitoring',
        'Fraud detection',
        'Compliance automation',
        'Audit trail management'
      ],
      benefits: [
        'Reduce fraud losses by 60%',
        'Cut compliance costs by 40%',
        'Improve audit readiness by 80%'
      ],
      icon: ''
    },
    {
      id: 'data-analytics',
      title: 'Advanced Analytics Platform',
      category: 'Analytics',
      description: 'Turn your data into actionable insights with powerful AI-driven analytics and visualization.',
      features: [
        'Predictive analytics',
        'Real-time dashboards',
        'Natural language queries',
        'Automated reporting'
      ],
      benefits: [
        'Accelerate insights by 10x',
        'Reduce analysis time by 75%',
        'Improve decision accuracy by 40%'
      ],
      icon: ''
    },
    {
      id: 'workforce-optimization',
      title: 'Workforce Optimization',
      category: 'Human Resources',
      description: 'Enhance productivity and employee satisfaction with AI-powered workforce management.',
      features: [
        'Skill gap analysis',
        'Performance prediction',
        'Scheduling optimization',
        'Employee engagement analytics'
      ],
      benefits: [
        'Increase productivity by 30%',
        'Reduce turnover by 25%',
        'Improve satisfaction scores by 35%'
      ],
      icon: ''
    },
    {
      id: 'research-acceleration',
      title: 'Research Acceleration Platform',
      category: 'Research & Development',
      description: 'Speed up research and development with AI-powered discovery and analysis tools.',
      features: [
        'Literature analysis',
        'Hypothesis generation',
        'Experiment optimization',
        'Collaboration tools'
      ],
      benefits: [
        'Reduce research time by 50%',
        'Increase discovery rate by 3x',
        'Cut development costs by 35%'
      ],
      icon: ''
    },
    {
      id: 'financial-intelligence',
      title: 'Financial Intelligence Suite',
      category: 'Finance',
      description: 'Optimize financial operations with AI-powered forecasting, analysis, and automation.',
      features: [
        'Revenue forecasting',
        'Expense optimization',
        'Cash flow management',
        'Investment analysis'
      ],
      benefits: [
        'Improve forecast accuracy by 40%',
        'Reduce financial close time by 50%',
        'Optimize working capital by 25%'
      ],
      icon: ''
    }
  ];

  const categories = [
    'all',
    'Healthcare',
    'Operations',
    'Customer Experience',
    'Risk & Compliance',
    'Analytics',
    'Human Resources',
    'Research & Development',
    'Finance'
  ];

  const filteredSolutions = selectedCategory === 'all'
    ? solutions
    : solutions.filter(solution => solution.category === selectedCategory);

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
          <h1>AI Solutions for Every Challenge</h1>
          <p className={styles.subtitle}>
            Pre-built, customizable solutions that deliver immediate value
          </p>
        </section>

        {/* Solution Categories */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Explore Our Solutions</h2>
            <p>
              Choose from our comprehensive suite of AI solutions designed to address
              specific business challenges and deliver measurable results.
            </p>

            {/* Category Filter */}
            <div className={styles.filterContainer}>
              {categories.map(category => (
                <button
                  key={category}
                  className={`${styles.filterBtn} ${selectedCategory === category ? styles.filterBtnActive : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === 'all' ? 'All Solutions' : category}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Solutions Grid */}
        <section className={styles.contentSection}>
          <div className={styles.solutionsGrid}>
            {filteredSolutions.map(solution => (
              <div key={solution.id} className={styles.solutionCard}>
                <div className={styles.solutionHeader}>
                  <span className={styles.solutionIcon}>{solution.icon}</span>
                  <h3>{solution.title}</h3>
                  <span className={styles.solutionCategory}>{solution.category}</span>
                </div>

                <p className={styles.solutionDescription}>
                  {solution.description}
                </p>

                <div className={styles.solutionFeatures}>
                  <h4>Key Features:</h4>
                  <ul>
                    {solution.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className={styles.solutionBenefits}>
                  <h4>Expected Results:</h4>
                  <ul>
                    {solution.benefits.map((benefit, index) => (
                      <li key={index}>{benefit}</li>
                    ))}
                  </ul>
                </div>

                <div className={styles.solutionActions}>
                  <Link href="/contact" className={styles.learnMoreBtn}>
                    Learn More
                  </Link>
                  <Link href="/contact" className={styles.requestDemoBtn}>
                    Request Demo
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Custom Solutions */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Need a Custom Solution?</h2>
            <p>
              Our team of AI experts can design and build custom solutions tailored to
              your unique business challenges and requirements.
            </p>

            <div className={styles.customSolutionFeatures}>
              <div className={styles.customFeature}>
                <h3>Tailored to Your Needs</h3>
                <p>Solutions designed specifically for your use cases and workflows</p>
              </div>
              <div className={styles.customFeature}>
                <h3>Full Integration</h3>
                <p>Seamless integration with your existing systems and processes</p>
              </div>
              <div className={styles.customFeature}>
                <h3>Scalable Architecture</h3>
                <p>Built to grow with your business and handle enterprise scale</p>
              </div>
              <div className={styles.customFeature}>
                <h3>Expert Support</h3>
                <p>Dedicated team to ensure successful implementation and adoption</p>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <Link href="/contact" className={styles.ctaBtn}>
                Discuss Custom Solution
              </Link>
            </div>
          </div>
        </section>

        {/* Success Metrics */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Proven Success Across Industries</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <h3>500+</h3>
                <p>Solutions Deployed</p>
              </div>
              <div className={styles.statCard}>
                <h3>95%</h3>
                <p>Customer Satisfaction</p>
              </div>
              <div className={styles.statCard}>
                <h3>3.8x</h3>
                <p>Average ROI</p>
              </div>
              <div className={styles.statCard}>
                <h3>60 days</h3>
                <p>Average Time to Value</p>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Partners */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Integrates with Your Tech Stack</h2>
            <p>
              Our solutions work seamlessly with the tools and platforms you already use.
            </p>
            <div className={styles.integrationLogos}>
              <p className={styles.logoPlaceholder}>
                [Salesforce] [SAP] [Oracle] [Microsoft] [AWS] [Google Cloud] [Epic] [Cerner]
              </p>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Why Choose moccet Solutions?</h2>

            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>moccet</th>
                  <th>Traditional Software</th>
                  <th>Build In-House</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Time to Deploy</td>
                  <td>30-60 days</td>
                  <td>3-6 months</td>
                  <td>12-18 months</td>
                </tr>
                <tr>
                  <td>AI Capabilities</td>
                  <td>Advanced, Pre-trained</td>
                  <td>Basic or None</td>
                  <td>Requires Development</td>
                </tr>
                <tr>
                  <td>Customization</td>
                  <td>Fully Customizable</td>
                  <td>Limited</td>
                  <td>Full Control</td>
                </tr>
                <tr>
                  <td>Maintenance</td>
                  <td>Managed by moccet</td>
                  <td>Vendor Dependent</td>
                  <td>Your Responsibility</td>
                </tr>
                <tr>
                  <td>Total Cost</td>
                  <td>Predictable</td>
                  <td>Hidden Costs</td>
                  <td>High & Variable</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Resources */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Solution Resources</h2>

            <div className={styles.resourceGrid}>
              <div className={styles.resourceCard}>
                <h3>Solution Catalog</h3>
                <p>Complete guide to all moccet solutions</p>
                <button className={styles.downloadBtn}>Download PDF</button>
              </div>
              <div className={styles.resourceCard}>
                <h3>Demo Library</h3>
                <p>Watch our solutions in action</p>
                <button className={styles.downloadBtn}>View Demos</button>
              </div>
              <div className={styles.resourceCard}>
                <h3>ROI Calculator</h3>
                <p>Calculate your potential savings</p>
                <button className={styles.downloadBtn}>Calculate ROI</button>
              </div>
              <div className={styles.resourceCard}>
                <h3>Implementation Guide</h3>
                <p>Best practices for deployment</p>
                <button className={styles.downloadBtn}>Access Guide</button>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Find Your Perfect Solution</h2>
          <p className={styles.finalCtaSubtitle}>
            Let our experts help you identify the right solutions for your organization
          </p>
          <div className={styles.buttonRow}>
            <Link href="/contact" className={styles.ctaBtn}>Get Solution Recommendation</Link>
            <Link href="/business" className={styles.watchVideoBtn}>Learn About Enterprise</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Solutions</h4>
              <ul className={styles.footerLinks}>
                <li><a href="#clinical-insights">Clinical Insights</a></li>
                <li><a href="#operational-excellence">Operational Excellence</a></li>
                <li><a href="#customer-intelligence">Customer Intelligence</a></li>
                <li><a href="#risk-management">Risk Management</a></li>
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
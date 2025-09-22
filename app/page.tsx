'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './landing.module.css';
import ContactSalesPage from './components/ContactSalesPage';
import VideoModal from './components/VideoModal';
import WaitlistModal from './components/WaitlistModal';
import ResearchModal from './components/ResearchModal';

export default function Home() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showContactSales, setShowContactSales] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showResearch, setShowResearch] = useState(false);

  useEffect(() => {
    // Set sidebar to open on desktop by default on initial load only
    if (window.innerWidth > 768) {
      setSidebarActive(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const showSection = (section: string) => {
    setActiveSection(section);
  };


  // Simulate data flow on mount - COMMENTED OUT SINCE INFRASTRUCTURE SECTION IS HIDDEN
  // useEffect(() => {
  //   const simulateDataFlow = async () => {
  //     // Initial metrics animation
  //     await new Promise(resolve => setTimeout(resolve, 500));
  //     animateValue(setInsightCount, 0, 847, 2000);
  //     animateValue(setRevenueTotal, 0, 42.3, 2000);
  //     animateValue(setProcessingSpeed, 0, 8.5, 2000);

  //     // Add insights
  //     await new Promise(resolve => setTimeout(resolve, 2500));
  //     addInsight(
  //       'Customer Churn Pattern Detected',
  //       'Machine learning models identified 2,300 at-risk customers with 92% accuracy based on behavioral patterns',
  //       850,
  //       92
  //     );

  //     await new Promise(resolve => setTimeout(resolve, 1500));
  //     addInsight(
  //       'Supply Chain Optimization Opportunity',
  //       'AI discovered inefficiencies in distribution network that could reduce costs by 15% through route optimization',
  //       1200,
  //       88
  //     );

  //     await new Promise(resolve => setTimeout(resolve, 1500));
  //     addInsight(
  //       'Fraud Ring Identified',
  //       'Quantum-enhanced analysis revealed coordinated fraudulent activity across 47 accounts in Southeast region',
  //       2100,
  //       96
  //     );

  //     // Add actions
  //     await new Promise(resolve => setTimeout(resolve, 1000));
  //     addAction(
  //       'Deploy Retention Campaign',
  //       'Target 2,300 at-risk customers with personalized retention offers',
  //       'Active'
  //     );

  //     await new Promise(resolve => setTimeout(resolve, 500));
  //     addAction(
  //       'Optimize Distribution Routes',
  //       'Implement AI-recommended routing changes across 12 warehouses',
  //       'Pending'
  //     );

  //     await new Promise(resolve => setTimeout(resolve, 500));
  //     addAction(
  //       'Freeze Suspicious Accounts',
  //       'Immediate action on 47 accounts flagged by fraud detection system',
  //       'Processing'
  //     );
  //   };

  //   simulateDataFlow();
  // }, [animateValue, addInsight, addAction]);

  // Handle click outside sidebar on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const menuIcon = document.querySelector(`.${styles.menuIcon}`);

      if (window.innerWidth <= 768 &&
          sidebar && menuIcon &&
          !sidebar.contains(event.target as Node) &&
          !menuIcon.contains(event.target as Node) &&
          sidebarActive) {
        setSidebarActive(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [sidebarActive]);


  const handleContactSales = () => {
    setShowContactSales(true);
  };

  const handleCloseContactSales = () => {
    setShowContactSales(false);
  };

  const handleWatchVideo = () => {
    setShowVideo(true);
  };

  const handleCloseVideo = () => {
    setShowVideo(false);
  };

  const handleEarlyAccess = () => {
    setShowWaitlist(true);
  };

  const handleCloseWaitlist = () => {
    setShowWaitlist(false);
  };

  const handleResearch = () => {
    setShowResearch(true);
  };

  const handleCloseResearch = () => {
    setShowResearch(false);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button className={styles.menuIcon} onClick={toggleSidebar}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 7.5H17.5M2.5 12.5H17.5" strokeLinecap="round"/>
              </svg>
            </button>
            <span className={styles.logo}>moccet</span>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.contactSalesBtn} onClick={handleContactSales}>Contact Sales</button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <nav className={`${styles.sidebar} ${sidebarActive ? styles.sidebarActive : ''}`} id="sidebar">
        <Link href="/research" className={styles.navItem}>Research</Link>
        <Link href="/safety" className={styles.navItem}>Safety</Link>
        <Link href="/business" className={styles.navItem}>For Business</Link>
        <Link href="/developers" className={styles.navItem}>For Developers</Link>
        <Link href="/api-platform" className={styles.navItem}>API Platform</Link>
        <Link href="/solutions" className={styles.navItem}>Solutions</Link>
        <Link href="/company" className={styles.navItem}>Company</Link>
        <Link href="/news" className={styles.navItem}>News</Link>
      </nav>

      {/* Main Content */}
      <main className={`${styles.main} ${sidebarActive ? styles.mainWithSidebar : ''}`}>
        {/* Dashboard View */}
        {activeSection === 'dashboard' && (
          <div id="dashboard-view">
            {/* Hero */}
            <section className={styles.hero}>
              <h1>AI that discovers.<br />Experts who execute.</h1>
              <p className={styles.subtitle}>Autonomous intelligence embeds in your infrastructure, discovers insights without prompting,<br />and deploys world-class operators to execute discoveries.</p>

              <div className={styles.buttonRow}>
                <button className={styles.ctaBtn} onClick={handleEarlyAccess}>Get early access →</button>
                <button className={styles.watchVideoBtn} onClick={handleWatchVideo}>Watch video ↗</button>
              </div>
            </section>

            {/* Moccet Suite Section */}
            <section className={styles.suiteSection}>
              <div className={styles.suiteContainer}>
                {/* Main Content */}
                <div className={styles.suiteMain}>
                  <div className={styles.suiteHero}>
                    <img
                      src="/images/big feature.jpg"
                      alt="Abstract visualization"
                      className={styles.suiteHeroImage}
                    />
                    <div className={styles.suiteHeroContent}>
                      <h2 className={styles.suiteLogo}>moccet</h2>
                      <p className={styles.suiteTagline}>Our fastest, most intelligent suite yet.</p>
                    </div>
                  </div>
                </div>

                {/* Right Cards */}
                <div className={styles.suiteCards}>
                  <div className={styles.suiteCard} onClick={() => window.location.href = '/health'} style={{ cursor: 'pointer' }}>
                    <div className={styles.cardImage} style={{ background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' }}></div>
                    <div className={styles.cardContent}>
                      <h3>Upgrades to moccet-h suite</h3>
                      <div className={styles.cardMeta}>
                        <span>New release</span>
                        <span>5 min read</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.suiteCard} onClick={() => window.open('https://scribe.moccet.com', '_blank')} style={{ cursor: 'pointer' }}>
                    <div className={styles.cardImage} style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}></div>
                    <div className={styles.cardContent}>
                      <h3>Introducing upgrades to m-scribe</h3>
                      <div className={styles.cardMeta}>
                        <span>New release</span>
                        <span>8 min read</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.suitePricing}>
                    <h3>Simple Pricing</h3>
                    <p>Pay as you go, cancel anytime</p>
                    <button
                      className={styles.pricingButton}
                      onClick={() => window.location.href = '/health#pricing'}
                    >
                      View pricing →
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Pricing Section */}
            <section className={styles.pricingSection}>
              <div className={styles.pricingContainer}>
                <h2 className={styles.pricingTitle}>Simple Pricing</h2>

                <div className={styles.pricingContent}>
                  <div className={styles.pricingLeft}>
                    <div className={styles.pilotPlan}>
                      <h3 className={styles.planName}>Pilot</h3>
                      <div className={styles.planPrice}>$50K</div>
                      <p className={styles.planDescription}>30-day proof of value</p>

                      <ul className={styles.planFeatures}>
                        <li>Full deployment</li>
                        <li>5 data sources</li>
                        <li>Weekly consultations</li>
                        <li>ROI analysis</li>
                        <li>Money-back guarantee</li>
                      </ul>

                      <button className={styles.startPilotBtn} onClick={handleContactSales}>Start pilot</button>
                    </div>
                  </div>

                  <div className={styles.pricingRight}>
                    <img
                      src="/images/pricing-pilot.jpg"
                      alt="Pricing pilot"
                      className={styles.pricingImage}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Enterprise Custom Section */}
            <section className={styles.enterpriseSection}>
              <div className={styles.enterpriseContainer}>
                <div className={styles.enterpriseLeft}>
                  <img
                    src="/images/pricing-custom.jpg"
                    alt="Enterprise custom"
                    className={styles.enterpriseImage}
                  />
                </div>

                <div className={styles.enterpriseRight}>
                  <div className={styles.enterprisePlan}>
                    <span className={styles.enterpriseLabel}>Enterprise</span>
                    <h2 className={styles.enterpriseTitle}>Custom</h2>
                    <p className={styles.enterpriseDescription}>For organizations ready to scale</p>

                    <ul className={styles.enterpriseFeatures}>
                      <li>Unlimited data sources</li>
                      <li>Dedicated expert team</li>
                      <li>Custom model training</li>
                      <li>24/7 support</li>
                      <li>Air-gapped deployment</li>
                      <li>Full compliance suite</li>
                    </ul>

                    <button className={styles.talkToSalesBtn} onClick={handleContactSales}>Talk to sales</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Research Free Section */}
            <section className={styles.researchSection}>
              <div className={styles.researchContainer}>
                <div className={styles.researchLeft}>
                  <div className={styles.researchPlan}>
                    <span className={styles.researchLabel}>Research</span>
                    <h2 className={styles.researchTitle}>Free</h2>
                    <p className={styles.researchDescription}>For academic institutions</p>

                    <ul className={styles.researchFeatures}>
                      <li>Full platform access</li>
                      <li>Research license</li>
                      <li>Documentation</li>
                      <li>Community access</li>
                      <li>Conference invitation</li>
                    </ul>

                    <button className={styles.applyBtn} onClick={handleResearch}>Apply</button>
                  </div>
                </div>

                <div className={styles.researchRight}>
                  <img
                    src="/images/pricing-research.jpg"
                    alt="Research campus"
                    className={styles.researchImage}
                  />
                </div>
              </div>
            </section>

            {/* Philosophy Section */}
            <section className={styles.philosophySection}>
              <div className={styles.philosophyContainer}>
                <h2 className={styles.philosophyTitle}>Philosophy</h2>
                <button className={styles.showAllBtn}>Show all</button>

                <div className={styles.philosophyGrid}>
                  <div
                    className={styles.philosophyCard}
                    onClick={() => window.location.href = '/philosophy/machine-learning'}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src="/images/gradient4.jpg"
                      alt="Machine Learning"
                      className={styles.philosophyImage}
                    />
                    <div className={styles.philosophyContent}>
                      <h3>Machine Learning</h3>
                      <div className={styles.philosophyMeta}>
                        <span className={styles.philosophyTag}>Technical</span>
                        <span className={styles.philosophyDate}>13 Sept 2025</span>
                        <span className={styles.philosophyTime}>12 min read</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={styles.philosophyCard}
                    onClick={() => window.location.href = '/philosophy/safety-compliance'}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src="/images/painting2.jpg"
                      alt="Safety and Compliance"
                      className={styles.philosophyImage}
                    />
                    <div className={styles.philosophyContent}>
                      <h3>Safety and Compliance</h3>
                      <div className={styles.philosophyMeta}>
                        <span className={styles.philosophyTag}>Safety</span>
                        <span className={styles.philosophyDate}>13 Sept 2025</span>
                        <span className={styles.philosophyTime}>8 min read</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={styles.philosophyCard}
                    onClick={() => window.location.href = '/philosophy/brain-inspired'}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src="/images/painting4.jpg"
                      alt="Inspired by the brain"
                      className={styles.philosophyImage}
                    />
                    <div className={styles.philosophyContent}>
                      <h3>Inspired by the brain</h3>
                      <div className={styles.philosophyMeta}>
                        <span className={styles.philosophyTag}>Technical</span>
                        <span className={styles.philosophyDate}>13 Sept 2025</span>
                        <span className={styles.philosophyTime}>10 min read</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Research Section */}
            <section className={styles.researchArticlesSection}>
              <div className={styles.researchArticlesContainer}>
                <h2 className={styles.researchArticlesTitle}>Research</h2>
                <button className={styles.showAllBtn}>Show all</button>

                <div className={styles.researchArticlesGrid}>
                  <div
                    className={styles.researchArticleCard}
                    onClick={() => window.location.href = '/research/neural-connections'}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src="/images/research-neural.jpg"
                      alt="Neural connections"
                      className={styles.researchArticleImage}
                    />
                    <div className={styles.researchArticleContent}>
                      <h3>Neural connections</h3>
                      <div className={styles.researchArticleMeta}>
                        <span className={styles.researchArticleTag}>Technical</span>
                        <span className={styles.researchArticleDate}>15 Sept 2025</span>
                        <span className={styles.researchArticleTime}>15 min read</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={styles.researchArticleCard}
                    onClick={() => window.location.href = '/research/hierarchical-reasoning'}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src="/images/research-hrm.jpg"
                      alt="Hierarchical Reasoning"
                      className={styles.researchArticleImage}
                    />
                    <div className={styles.researchArticleContent}>
                      <h3>Hierarchical Reasoning</h3>
                      <div className={styles.researchArticleMeta}>
                        <span className={styles.researchArticleTag}>Technical</span>
                        <span className={styles.researchArticleDate}>14 Sept 2025</span>
                        <span className={styles.researchArticleTime}>10 min read</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Final CTA Section */}
            <section className={styles.finalCta}>
              <div className={styles.finalCtaContainer}>
                <h2 className={styles.finalCtaTitle}>The future of AI is autonomous</h2>
                <p className={styles.finalCtaSubtitle}>Stop prompting. Start discovering. Let experts execute.</p>

                <div className={styles.finalCtaButtons}>
                  <button className={styles.finalCtaPrimary} onClick={handleEarlyAccess}>Get early access</button>
                  <button className={styles.finalCtaSecondary} onClick={handleContactSales}>Talk to sales</button>
                </div>
              </div>
            </section>


          </div>
        )}

        {/* All Insights View */}
        {activeSection === 'all-insights' && (
          <div className={`${styles.expandedContent} ${styles.active}`}>
            <a className={styles.backLink} onClick={() => showSection('dashboard')}>
              ← Back to dashboard
            </a>
            <h2 style={{ fontSize: '48px', fontWeight: 600, marginBottom: '40px' }}>All insights</h2>
            <div className={`${styles.insightsList} ${styles.active}`}>
              <div className={styles.insightItem}>
                <div className={styles.insightHeader}>
                  <div className={styles.insightTitle}>Demo insight view</div>
                  <div className={styles.insightValue}>+0K</div>
                </div>
                <div className={styles.insightDescription}>This is a placeholder for the insights view</div>
                <div className={styles.confidenceBar}>
                  <div className={styles.confidenceFill} style={{ width: `0%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <div className={styles.footerTop}>
              <div className={styles.footerColumn}>
                <h4 className={styles.footerColumnTitle}>Safety</h4>
                <ul className={styles.footerLinks}>
                  <li><Link href="/safety">Safety Approach</Link></li>
                  <li><Link href="/security">Security and Privacy</Link></li>
                  <li><Link href="/trust">Trust and Transparency</Link></li>
                </ul>
              </div>

              <div className={styles.footerColumn}>
                <h4 className={styles.footerColumnTitle}>Our Research</h4>
                <ul className={styles.footerLinks}>
                  <li><Link href="/research">Research Index</Link></li>
                  <li><Link href="/research">Research Overview</Link></li>
                  <li><Link href="/research">Our Research</Link></li>
                  <li><Link href="/legal">Safety Approach</Link></li>
                </ul>
              </div>


              <div className={styles.footerColumn}>
                <h4 className={styles.footerColumnTitle}>For Business</h4>
                <ul className={styles.footerLinks}>
                  <li><Link href="/business">Business Overview</Link></li>
                  <li><Link href="/solutions">Solutions</Link></li>
                  <li><Link href="/contact">Contact Sales</Link></li>
                </ul>
                <h4 className={styles.footerColumnTitle} style={{marginTop: '32px'}}>For Health</h4>
                <ul className={styles.footerLinks}>
                  <li><Link href="/health">Personal</Link></li>
                  <li><Link href="/health">Professional</Link></li>
                </ul>
              </div>

              <div className={styles.footerColumn}>
                <h4 className={styles.footerColumnTitle}>Terms and Policies</h4>
                <ul className={styles.footerLinks}>
                  <li><Link href="/terms">Terms of Use</Link></li>
                  <li><Link href="/privacy">Privacy Policy</Link></li>
                  <li><Link href="/policies">Other Policies</Link></li>
                </ul>
                <h4 className={styles.footerColumnTitle} style={{marginTop: '32px'}}>Support</h4>
                <ul className={styles.footerLinks}>
                  <li><Link href="/contact">Contact Us</Link></li>
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
            </div>

            <div className={styles.footerBottom}>
              <div className={styles.footerBrand}>
                <h3 className={styles.footerLogo}>moccet</h3>
                <p className={styles.footerTagline}>
                  Autonomous intelligence imbeds in your infrastructure,<br />
                  discovers insights without prompting, and deploys world-<br />
                  class operators to execute discoveries.
                </p>
                <a href="tel:+17074005566" className={styles.footerPhone}>
                  📞 +1 (707) 400-5566
                </a>
              </div>
              <div className={styles.footerCopyright}>
                <p>© 2025 moccet Inc. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Contact Sales Modal */}
      {showContactSales && (
        <ContactSalesPage onClose={handleCloseContactSales} />
      )}

      {/* Video Modal */}
      {showVideo && (
        <VideoModal onClose={handleCloseVideo} />
      )}

      {/* Waitlist Modal */}
      {showWaitlist && (
        <WaitlistModal onClose={handleCloseWaitlist} />
      )}

      {/* Research Application Modal */}
      {showResearch && (
        <ResearchModal onClose={handleCloseResearch} />
      )}
    </div>
  );
}
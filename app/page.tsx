'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './landing.module.css';
import ContactSalesPage from './components/ContactSalesPage';
import VideoModal from './components/VideoModal';
import WaitlistModal from './components/WaitlistModal';
import ResearchModal from './components/ResearchModal';
import LandingHero from './components/LandingHero';
import BenefitsGrid from './components/BenefitsGrid';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

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

  // Force hero button styling as backup
  useEffect(() => {
    const heroBtn = document.querySelector('[data-button="hero-cta"]') as HTMLButtonElement;
    if (heroBtn) {
      heroBtn.style.cssText = `
        padding: 6px 16px !important;
        background: #000 !important;
        color: #fff !important;
        border: none !important;
        border-radius: 20px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        margin-right: 12px !important;
        cursor: pointer !important;
        transition: opacity 0.15s ease !important;
        font-family: var(--font-inter) !important;
      `;
    }
  }, []);

  // Optional: Suite section visibility tracking
  useEffect(() => {
    const suiteSection = document.querySelector(`.${styles.suiteSection}`);

    if (!suiteSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Optional: Add any visibility-based logic here
          // For now, this is just a placeholder for future enhancements
          if (entry.isIntersecting) {
            // Suite section is visible
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '-60px 0px 0px 0px' // Account for navbar
      }
    );

    observer.observe(suiteSection);

    return () => {
      observer.disconnect();
    };
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
      {/* Global Header */}
      <Header
        onToggleSidebar={toggleSidebar}
        onContactSales={handleContactSales}
        sidebarActive={sidebarActive}
      />

      {/* Global Sidebar */}
      <Sidebar isActive={sidebarActive} />

      {/* Main Content */}
      <main className={`${styles.main} ${sidebarActive ? styles.mainWithSidebar : ''}`}>
        {/* Dashboard View */}
        {activeSection === 'dashboard' && (
          <div id="dashboard-view">
            {/* Hero */}
            <LandingHero
              onEarlyAccess={handleEarlyAccess}
              onWatchVideo={handleWatchVideo}
            />

            {/* Benefits Grid Section */}
            <BenefitsGrid />

            {/* Moccet Suite Section */}
            <section className={styles.suiteSection}>
              <div className={styles.suiteContainer}>
                {/* Main Content */}
                <div className={styles.suiteMain}>
                  <div className={styles.suiteHero}>
                    <img
                      src="/images/big feature.jpg"
                      alt="Moccet AI platform visualization showcasing autonomous intelligence"
                      className={styles.suiteHeroImage}
                      loading="eager"
                    />
                    <div className={styles.suiteHeroContent}>
                      <h1 className={styles.footerLogo}>moccet</h1>
                      <p className={styles.suiteTagline}>Our fastest, most intelligent suite yet.</p>
                    </div>
                  </div>
                </div>

                {/* Right Cards */}
                <div className={styles.suiteCards}>
                  <div className={styles.suiteCard} onClick={() => window.location.href = '/health'} style={{ cursor: 'pointer' }}>
                    <img
                      src="/images/The Wellness-14.png"
                      alt="Moccet-h suite upgrades for wellness and health"
                      className={styles.cardImage}
                      loading="lazy"
                    />
                    <div className={styles.cardContent}>
                      <h3>Upgrades to moccet-h suite</h3>
                      <div className={styles.cardMeta}>
                        <span>New release</span>
                        <span>5 min read</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.suiteCard} onClick={() => window.open('https://scribe.moccet.com', '_blank')} style={{ cursor: 'pointer' }}>
                    <img
                      src="/images/wave4.jpg"
                      alt="M-scribe upgrades and enhancements"
                      className={styles.cardImage}
                      loading="lazy"
                    />
                    <div className={styles.cardContent}>
                      <h3>Introducing upgrades to m-scribe</h3>
                      <div className={styles.cardMeta}>
                        <span>New release</span>
                        <span>8 min read</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.suiteCard} onClick={() => window.location.href = '/business'} style={{ cursor: 'pointer' }}>
                    <img
                      src="/images/Enterprise-Healthcare.jpg"
                      alt="Enterprise solutions for healthcare and business"
                      className={styles.cardImage}
                      loading="lazy"
                    />
                    <div className={styles.cardContent}>
                      <h3>Enterprise solutions now available</h3>
                      <div className={styles.cardMeta}>
                        <span>New release</span>
                        <span>6 min read</span>
                      </div>
                    </div>
                  </div>
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
                      alt="Machine learning philosophy and approach visualization"
                      className={styles.philosophyImage}
                      loading="lazy"
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
                      alt="AI safety and compliance framework illustration"
                      className={styles.philosophyImage}
                      loading="lazy"
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
                      alt="Brain-inspired AI architecture and neural networks"
                      className={styles.philosophyImage}
                      loading="lazy"
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
                      alt="Neural network connections and AI research visualization"
                      className={styles.researchArticleImage}
                      loading="lazy"
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
                      alt="Hierarchical reasoning model research and development"
                      className={styles.researchArticleImage}
                      loading="lazy"
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
                      alt="Moccet pilot program pricing visualization"
                      className={styles.pricingImage}
                      loading="lazy"
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
                    alt="Enterprise custom solutions for AI implementation"
                    className={styles.enterpriseImage}
                    loading="lazy"
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
                    alt="Academic research campus for AI development"
                    className={styles.researchImage}
                    loading="lazy"
                  />
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
                  <li><Link href="/company">About Us</Link></li>
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
                <div className={styles.footerSocial}>
                  <a href="https://x.com/moccet/" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                  <a href="https://www.linkedin.com/company/105261965/" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                  <a href="https://instagram.com/moccetai" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                  <a href="https://www.tiktok.com/@moccet" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </a>
                </div>
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
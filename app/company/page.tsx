'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function CompanyPage() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <Link href="/careers" className={styles.contactSalesBtn}>
            Join Our Team
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Company</h1>
          <p className={styles.subtitle}>
            Building the future of healthcare with AI
          </p>
        </section>

        {/* Mission Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Mission</h2>
            <p className={styles.missionStatement}>
              To democratize access to advanced healthcare AI, empowering every healthcare
              provider with the tools to deliver exceptional patient care while reducing
              costs and improving outcomes globally.
            </p>
          </div>
        </section>

        {/* Company Stats */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>moccet by the Numbers</h2>
            <div className={styles.companyStats}>
              <div className={styles.companyStat}>
                <h3>2019</h3>
                <p>Founded</p>
              </div>
              <div className={styles.companyStat}>
                <h3>500+</h3>
                <p>Healthcare Organizations</p>
              </div>
              <div className={styles.companyStat}>
                <h3>10M+</h3>
                <p>Patient Lives Improved</p>
              </div>
              <div className={styles.companyStat}>
                <h3>50+</h3>
                <p>Countries Served</p>
              </div>
              <div className={styles.companyStat}>
                <h3>200+</h3>
                <p>Team Members</p>
              </div>
              <div className={styles.companyStat}>
                <h3>$250M</h3>
                <p>Total Funding</p>
              </div>
            </div>
          </div>
        </section>

        {/* Leadership Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Leadership Team</h2>
            <p>
              Our leadership team brings together decades of experience in healthcare,
              artificial intelligence, and enterprise technology.
            </p>

            <div className={styles.leadershipGrid}>
              <div className={styles.leaderCard}>
                <div className={styles.leaderImage}></div>
                <h3>Dr. Sarah Chen</h3>
                <p className={styles.leaderRole}>Chief Executive Officer</p>
                <p className={styles.leaderBio}>
                  Former Stanford AI Lab director, 20+ years in healthcare AI
                </p>
              </div>

              <div className={styles.leaderCard}>
                <div className={styles.leaderImage}></div>
                <h3>Michael Roberts</h3>
                <p className={styles.leaderRole}>Chief Technology Officer</p>
                <p className={styles.leaderBio}>
                  Ex-Google Health, led AI initiatives at Mayo Clinic
                </p>
              </div>

              <div className={styles.leaderCard}>
                <div className={styles.leaderImage}></div>
                <h3>Dr. Emily Zhang</h3>
                <p className={styles.leaderRole}>Chief Medical Officer</p>
                <p className={styles.leaderBio}>
                  Johns Hopkins Medicine, 15+ years clinical practice
                </p>
              </div>

              <div className={styles.leaderCard}>
                <div className={styles.leaderImage}></div>
                <h3>David Kim</h3>
                <p className={styles.leaderRole}>Chief Product Officer</p>
                <p className={styles.leaderBio}>
                  Previously CPO at Epic Systems, healthcare software veteran
                </p>
              </div>

              <div className={styles.leaderCard}>
                <div className={styles.leaderImage}></div>
                <h3>Lisa Thompson</h3>
                <p className={styles.leaderRole}>Chief Financial Officer</p>
                <p className={styles.leaderBio}>
                  Former CFO at multiple healthcare unicorns, IPO experience
                </p>
              </div>

              <div className={styles.leaderCard}>
                <div className={styles.leaderImage}></div>
                <h3>Dr. James Wilson</h3>
                <p className={styles.leaderRole}>Chief Research Officer</p>
                <p className={styles.leaderBio}>
                  MIT AI Lab, published 100+ papers on medical AI
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Investors Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Investors</h2>
            <p>
              Backed by leading venture capital firms and strategic healthcare investors
              who share our vision for transforming healthcare.
            </p>
            <div className={styles.investorLogos}>
              <p className={styles.logoPlaceholder}>
                [Andreessen Horowitz] [Google Ventures] [Sequoia Capital] [General Catalyst]
                [Founders Fund] [Khosla Ventures] [Mayo Clinic Ventures] [Kaiser Permanente]
              </p>
            </div>
          </div>
        </section>

        {/* Board Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Board of Directors</h2>

            <div className={styles.boardGrid}>
              <div className={styles.boardMember}>
                <h3>Dr. Sarah Chen</h3>
                <p>CEO & Founder, moccet</p>
              </div>
              <div className={styles.boardMember}>
                <h3>Marc Andreessen</h3>
                <p>Co-founder, Andreessen Horowitz</p>
              </div>
              <div className={styles.boardMember}>
                <h3>Dr. Robert Wachter</h3>
                <p>Chair, UCSF Department of Medicine</p>
              </div>
              <div className={styles.boardMember}>
                <h3>Mary Meeker</h3>
                <p>General Partner, Bond Capital</p>
              </div>
              <div className={styles.boardMember}>
                <h3>Dr. Eric Topol</h3>
                <p>Founder, Scripps Research Institute</p>
              </div>
              <div className={styles.boardMember}>
                <h3>Reid Hoffman</h3>
                <p>Co-founder, LinkedIn</p>
              </div>
            </div>
          </div>
        </section>

        {/* Advisory Board */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Medical Advisory Board</h2>
            <p>
              Our Medical Advisory Board includes leading physicians and healthcare
              executives who guide our product development and clinical strategy.
            </p>

            <div className={styles.advisorList}>
              <ul>
                <li><strong>Dr. Atul Gawande</strong> - Surgeon, Author, Public Health Researcher</li>
                <li><strong>Dr. Siddhartha Mukherjee</strong> - Oncologist, Author of &quot;The Emperor of All Maladies&quot;</li>
                <li><strong>Dr. Abraham Verghese</strong> - Professor of Medicine, Stanford University</li>
                <li><strong>Dr. Regina Benjamin</strong> - 18th U.S. Surgeon General</li>
                <li><strong>Dr. David Feinberg</strong> - Chairman, Oracle Health</li>
                <li><strong>Dr. Toby Cosgrove</strong> - Former CEO, Cleveland Clinic</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Culture & Values */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Culture & Values</h2>

            <div className={styles.valuesGrid}>
              <div className={styles.valueCard}>
                <h3>Patient First</h3>
                <p>Every decision starts with how it improves patient outcomes</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Bold Innovation</h3>
                <p>Push boundaries while maintaining safety and reliability</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Radical Collaboration</h3>
                <p>Break down silos and work together across disciplines</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Continuous Learning</h3>
                <p>Stay curious and embrace new knowledge every day</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Ethical Leadership</h3>
                <p>Do the right thing even when no one is watching</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Global Impact</h3>
                <p>Make healthcare better for everyone, everywhere</p>
              </div>
            </div>
          </div>
        </section>

        {/* Offices */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Global Presence</h2>
            <p>
              With offices worldwide, we&apos;re building a global team to solve
              healthcare&apos;s biggest challenges.
            </p>

            <div className={styles.officeGrid}>
              <div className={styles.officeLocation}>
                <h3>San Francisco (HQ)</h3>
                <p>555 California Street<br />San Francisco, CA 94104</p>
              </div>
              <div className={styles.officeLocation}>
                <h3>New York</h3>
                <p>350 Fifth Avenue<br />New York, NY 10118</p>
              </div>
              <div className={styles.officeLocation}>
                <h3>Boston</h3>
                <p>200 Clarendon Street<br />Boston, MA 02116</p>
              </div>
              <div className={styles.officeLocation}>
                <h3>Austin</h3>
                <p>600 Congress Avenue<br />Austin, TX 78701</p>
              </div>
              <div className={styles.officeLocation}>
                <h3>London</h3>
                <p>1 Canada Square<br />London E14 5AB, UK</p>
              </div>
              <div className={styles.officeLocation}>
                <h3>Singapore</h3>
                <p>1 Marina Boulevard<br />Singapore 018989</p>
              </div>
            </div>
          </div>
        </section>

        {/* Awards & Recognition */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Awards & Recognition</h2>

            <div className={styles.awardsGrid}>
              <div className={styles.awardCard}>
                <h3>TIME 100 Most Influential Companies</h3>
                <p>2024</p>
              </div>
              <div className={styles.awardCard}>
                <h3>Fast Company Most Innovative</h3>
                <p>Healthcare Category, 2024</p>
              </div>
              <div className={styles.awardCard}>
                <h3>Forbes Cloud 100</h3>
                <p>#12 Ranking, 2024</p>
              </div>
              <div className={styles.awardCard}>
                <h3>CNBC Disruptor 50</h3>
                <p>Top 10, 2024</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Join Us in Transforming Healthcare</h2>
          <p className={styles.finalCtaSubtitle}>
            Explore opportunities to work with moccet
          </p>
          <div className={styles.buttonRow}>
            <Link href="/careers" className={styles.ctaBtn}>View Open Positions</Link>
            <Link href="/about" className={styles.watchVideoBtn}>Learn More About Us</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Company</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/company">Overview</Link></li>
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/careers">Careers</Link></li>
                <li><Link href="/news">News</Link></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Products</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/api-platform">API Platform</Link></li>
                <li><Link href="/solutions">Solutions</Link></li>
                <li><Link href="/developers">Developers</Link></li>
                <li><Link href="/business">Business</Link></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Resources</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/research">Research</Link></li>
                <li><Link href="/safety">Safety</Link></li>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">Status</a></li>
              </ul>
            </div>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Legal</h4>
              <ul className={styles.footerLinks}>
                <li><Link href="/terms">Terms of Use</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/policies">Other Policies</Link></li>
                <li><Link href="/contact">Contact Us</Link></li>
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
'use client';

import Link from 'next/link';
import styles from '../landing.module.css';

export default function BrandPage() {
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
          <h1>Brand Guidelines</h1>
          <p className={styles.subtitle}>
            How we present moccet to the world
          </p>
        </section>

        {/* Brand Story Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Brand Story</h2>
            <p>
              moccet represents the intersection of human expertise and artificial
              intelligence in healthcare. Our brand embodies trust, innovation, and
              the promise of better health outcomes through intelligent technology.
            </p>
            <p>
              The name &quot;moccet&quot; is derived from the fusion of &quot;modern&quot; and &quot;cassette&quot; -
              representing how we package complex healthcare data into digestible,
              actionable insights, much like how cassettes made music portable and
              accessible.
            </p>
          </div>
        </section>

        {/* Logo Usage Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Logo Usage</h2>

            <h3>Primary Logo</h3>
            <div className={styles.logoShowcase}>
              <div className={styles.logoBox}>
                <div className={styles.logoDisplay}>moccet</div>
                <p>Standard wordmark - use on light backgrounds</p>
              </div>
              <div className={styles.logoBox} style={{background: '#000'}}>
                <div className={styles.logoDisplay} style={{color: '#fff'}}>moccet</div>
                <p style={{color: '#fff'}}>Inverted wordmark - use on dark backgrounds</p>
              </div>
            </div>

            <h3>Clear Space</h3>
            <p>
              Always maintain clear space around the logo equal to the height of
              the letter &quot;m&quot; in the wordmark. This ensures the logo remains
              visible and impactful.
            </p>

            <h3>Don&apos;ts</h3>
            <ul>
              <li>Don&apos;t alter the logo colors</li>
              <li>Don&apos;t stretch or distort the logo</li>
              <li>Don&apos;t add effects like shadows or gradients</li>
              <li>Don&apos;t place the logo on busy backgrounds</li>
              <li>Don&apos;t recreate or modify the logo</li>
            </ul>
          </div>
        </section>

        {/* Color Palette Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Color Palette</h2>

            <h3>Primary Colors</h3>
            <div className={styles.colorGrid}>
              <div className={styles.colorCard}>
                <div className={styles.colorSwatch} style={{background: '#000000'}}></div>
                <h4>moccet Black</h4>
                <p>#000000</p>
                <p>RGB: 0, 0, 0</p>
              </div>
              <div className={styles.colorCard}>
                <div className={styles.colorSwatch} style={{background: '#FFFFFF', border: '1px solid #e5e5e5'}}></div>
                <h4>Pure White</h4>
                <p>#FFFFFF</p>
                <p>RGB: 255, 255, 255</p>
              </div>
              <div className={styles.colorCard}>
                <div className={styles.colorSwatch} style={{background: '#10A37F'}}></div>
                <h4>moccet Green</h4>
                <p>#10A37F</p>
                <p>RGB: 16, 163, 127</p>
              </div>
            </div>

            <h3>Secondary Colors</h3>
            <div className={styles.colorGrid}>
              <div className={styles.colorCard}>
                <div className={styles.colorSwatch} style={{background: '#666666'}}></div>
                <h4>Neutral Gray</h4>
                <p>#666666</p>
                <p>RGB: 102, 102, 102</p>
              </div>
              <div className={styles.colorCard}>
                <div className={styles.colorSwatch} style={{background: '#F7F7F8'}}></div>
                <h4>Light Gray</h4>
                <p>#F7F7F8</p>
                <p>RGB: 247, 247, 248</p>
              </div>
              <div className={styles.colorCard}>
                <div className={styles.colorSwatch} style={{background: '#E5E5E5'}}></div>
                <h4>Border Gray</h4>
                <p>#E5E5E5</p>
                <p>RGB: 229, 229, 229</p>
              </div>
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Typography</h2>

            <h3>Primary Typeface</h3>
            <p style={{fontSize: '48px', fontWeight: 700, marginBottom: '8px'}}>
              Inter
            </p>
            <p>
              Inter is our primary typeface. It&apos;s clean, modern, and highly legible
              across all sizes and mediums. We use it for all brand communications.
            </p>

            <h3>Type Scale</h3>
            <div className={styles.typeScale}>
              <div style={{fontSize: '48px', fontWeight: 700}}>Heading 1 - 48px Bold</div>
              <div style={{fontSize: '36px', fontWeight: 600}}>Heading 2 - 36px Semibold</div>
              <div style={{fontSize: '24px', fontWeight: 600}}>Heading 3 - 24px Semibold</div>
              <div style={{fontSize: '18px', fontWeight: 500}}>Heading 4 - 18px Medium</div>
              <div style={{fontSize: '16px', fontWeight: 400}}>Body Text - 16px Regular</div>
              <div style={{fontSize: '14px', fontWeight: 400}}>Small Text - 14px Regular</div>
            </div>
          </div>
        </section>

        {/* Voice & Tone Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Voice & Tone</h2>

            <h3>Brand Voice</h3>
            <p>
              moccet speaks with clarity, confidence, and compassion. We&apos;re experts
              who make complex healthcare technology accessible without dumbing it down.
            </p>

            <h3>Tone Principles</h3>

            <h4>Clear, Not Complex</h4>
            <p>
              We explain sophisticated technology in straightforward terms. We avoid
              jargon unless necessary, and when we use technical terms, we explain them.
            </p>

            <h4>Confident, Not Arrogant</h4>
            <p>
              We&apos;re assured in our capabilities but always humble about the complexity
              of healthcare. We present facts and let results speak for themselves.
            </p>

            <h4>Human, Not Robotic</h4>
            <p>
              Despite being an AI company, we never forget the human element. We write
              like humans talking to humans, with warmth and understanding.
            </p>

            <h4>Optimistic, Not Unrealistic</h4>
            <p>
              We believe in the potential of technology to improve healthcare, but we&apos;re
              honest about challenges and limitations.
            </p>
          </div>
        </section>

        {/* Visual Style Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Visual Style</h2>

            <h3>Photography</h3>
            <p>
              Our photography should feel authentic and human. We prioritize real
              healthcare settings and genuine moments over staged shots. Images should
              reflect diversity in age, ethnicity, and healthcare roles.
            </p>

            <h3>Iconography</h3>
            <p>
              Icons should be simple, geometric, and functional. We use line icons
              with consistent stroke weights. Icons should enhance understanding,
              not decorate.
            </p>

            <h3>Data Visualization</h3>
            <p>
              Charts and graphs should be clean and easy to understand. Use our
              primary colors for emphasis, with gray tones for supporting information.
              Always prioritize clarity over aesthetics.
            </p>

            <h3>White Space</h3>
            <p>
              Generous white space is a key element of our visual identity. It creates
              breathing room, improves readability, and conveys sophistication.
            </p>
          </div>
        </section>

        {/* Applications Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Brand Applications</h2>

            <h3>Digital Presence</h3>
            <p>
              Our website and digital products should feel clean, professional, and
              approachable. Navigation should be intuitive, with clear hierarchy
              and purposeful interactions.
            </p>

            <h3>Marketing Materials</h3>
            <p>
              All marketing materials should maintain consistent brand elements.
              Lead with value propositions, support with evidence, and always
              include clear calls to action.
            </p>

            <h3>Product Interface</h3>
            <p>
              Our product UI follows the same principles: clarity, consistency,
              and clinical precision. Every element should have a purpose, and
              every interaction should feel intentional.
            </p>
          </div>
        </section>

        {/* Download Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Brand Assets</h2>
            <p>
              Download our complete brand guidelines, logo files, and other brand
              assets for use in approved applications.
            </p>
            <div className={styles.buttonRow}>
              <button className={styles.ctaBtn}>Download Brand Kit</button>
              <button className={styles.watchVideoBtn}>Request Custom Assets</button>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Questions?</h2>
            <p>
              For brand-related inquiries, custom asset requests, or partnership
              opportunities, please contact our brand team.
            </p>
            <p>
              <a href="mailto:brand@moccet.com" style={{color: '#10A37F'}}>
                brand@moccet.com
              </a>
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Build with moccet Brand</h2>
          <p className={styles.finalCtaSubtitle}>
            Use our brand assets to showcase your partnership with moccet
          </p>
          <div className={styles.buttonRow}>
            <button className={styles.ctaBtn}>Download Assets</button>
            <Link href="/about" className={styles.watchVideoBtn}>About moccet</Link>
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
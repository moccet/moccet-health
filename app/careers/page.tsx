'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

interface JobPosition {
  id: number;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
}

export default function CareersPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('All');

  const jobPositions: JobPosition[] = [
    {
      id: 1,
      title: 'Senior Machine Learning Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA / Remote',
      type: 'Full-time',
      description: 'Build and optimize ML models for healthcare prediction'
    },
    {
      id: 2,
      title: 'Healthcare Data Scientist',
      department: 'Data Science',
      location: 'New York, NY / Hybrid',
      type: 'Full-time',
      description: 'Analyze clinical data to drive product insights'
    },
    {
      id: 3,
      title: 'Product Manager - Clinical Solutions',
      department: 'Product',
      location: 'Boston, MA / Remote',
      type: 'Full-time',
      description: 'Lead product strategy for clinical workflow tools'
    },
    {
      id: 4,
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description: 'Build intuitive interfaces for healthcare professionals'
    },
    {
      id: 5,
      title: 'Clinical Implementation Specialist',
      department: 'Customer Success',
      location: 'Chicago, IL / Hybrid',
      type: 'Full-time',
      description: 'Support healthcare organizations in deploying moccet'
    },
    {
      id: 6,
      title: 'Security Engineer',
      department: 'Security',
      location: 'Remote',
      type: 'Full-time',
      description: 'Ensure HIPAA compliance and data security'
    }
  ];

  const departments = ['All', 'Engineering', 'Data Science', 'Product', 'Customer Success', 'Security'];

  const filteredPositions = selectedDepartment === 'All'
    ? jobPositions
    : jobPositions.filter(job => job.department === selectedDepartment);

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
          <h1>Join Our Mission</h1>
          <p className={styles.subtitle}>
            Help us transform healthcare with AI and make a difference in millions of lives
          </p>
        </section>

        {/* Why Join Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Why Join moccet?</h2>
            <p>
              At moccet, you&apos;ll work on challenging problems that matter. Every line of
              code, every analysis, every customer interaction directly impacts patient
              care and healthcare outcomes worldwide.
            </p>
          </div>
        </section>

        {/* Benefits Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Benefits & Perks</h2>
            <div className={styles.benefitsGrid}>
              <div className={styles.benefitCard}>
                <h3>Healthcare</h3>
                <p>100% premium coverage for you and your family, including dental and vision</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Flexible Work</h3>
                <p>Remote-first culture with optional access to offices in major cities</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Learning Budget</h3>
                <p>$5,000 annual budget for courses, conferences, and professional development</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Time Off</h3>
                <p>Unlimited PTO, parental leave, and sabbatical opportunities</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Equity</h3>
                <p>Competitive equity packages - own a piece of the future of healthcare</p>
              </div>
              <div className={styles.benefitCard}>
                <h3>Equipment</h3>
                <p>Top-tier equipment and $1,500 home office setup budget</p>
              </div>
            </div>
          </div>
        </section>

        {/* Culture Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Culture</h2>

            <h3>Mission-Driven</h3>
            <p>
              We&apos;re united by our mission to improve healthcare outcomes. Every team
              member, regardless of role, contributes to this goal.
            </p>

            <h3>Collaborative Innovation</h3>
            <p>
              The best ideas come from diverse perspectives. We foster an environment
              where everyone&apos;s voice is heard and valued.
            </p>

            <h3>Continuous Growth</h3>
            <p>
              We invest in our people&apos;s growth through mentorship, learning opportunities,
              and challenging projects that push boundaries.
            </p>

            <h3>Work-Life Harmony</h3>
            <p>
              We believe great work comes from well-rested, fulfilled people. We support
              flexible schedules and respect personal time.
            </p>
          </div>
        </section>

        {/* Open Positions Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Open Positions</h2>

            {/* Department Filter */}
            <div className={styles.filterContainer}>
              {departments.map(dept => (
                <button
                  key={dept}
                  className={`${styles.filterBtn} ${selectedDepartment === dept ? styles.filterBtnActive : ''}`}
                  onClick={() => setSelectedDepartment(dept)}
                >
                  {dept}
                </button>
              ))}
            </div>

            {/* Job Listings */}
            <div className={styles.jobListings}>
              {filteredPositions.map(job => (
                <div key={job.id} className={styles.jobCard}>
                  <div className={styles.jobHeader}>
                    <h3>{job.title}</h3>
                    <span className={styles.jobType}>{job.type}</span>
                  </div>
                  <p className={styles.jobDescription}>{job.description}</p>
                  <div className={styles.jobMeta}>
                    <span className={styles.jobDepartment}>{job.department}</span>
                    <span className={styles.jobLocation}>{job.location}</span>
                  </div>
                  <button className={styles.applyBtn}>Apply Now</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Hiring Process</h2>

            <div className={styles.processSteps}>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>1</div>
                <h3>Application Review</h3>
                <p>We review every application carefully, typically within 3-5 business days</p>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>2</div>
                <h3>Initial Call</h3>
                <p>30-minute conversation with our recruiting team to discuss your background and interests</p>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>3</div>
                <h3>Technical Interview</h3>
                <p>Role-specific assessment with team members (1-2 sessions)</p>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>4</div>
                <h3>Team Fit</h3>
                <p>Meet potential teammates and leadership to ensure mutual fit</p>
              </div>
              <div className={styles.processStep}>
                <div className={styles.stepNumber}>5</div>
                <h3>Offer</h3>
                <p>Competitive offer with full transparency on compensation and benefits</p>
              </div>
            </div>
          </div>
        </section>

        {/* Diversity Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Diversity & Inclusion</h2>
            <p>
              Healthcare is diverse, and so should be the teams building its future.
              We&apos;re committed to creating an inclusive environment where people from all
              backgrounds can thrive.
            </p>
            <p>
              We actively seek diverse perspectives and experiences, knowing that our
              differences make us stronger and our products better. We provide equal
              opportunities regardless of race, color, ancestry, religion, sex, national
              origin, sexual orientation, age, citizenship, marital status, disability,
              gender identity, or veteran status.
            </p>
          </div>
        </section>

        {/* Don't See a Fit Section */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Don&apos;t See a Perfect Fit?</h2>
            <p>
              We&apos;re always looking for exceptional talent. If you&apos;re passionate about
              our mission but don&apos;t see a role that matches your skills, we&apos;d still
              love to hear from you.
            </p>
            <button className={styles.ctaBtn}>Send Us Your Resume</button>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Ready to Make an Impact?</h2>
          <p className={styles.finalCtaSubtitle}>
            Join us in transforming healthcare through intelligent technology
          </p>
          <div className={styles.buttonRow}>
            <button className={styles.ctaBtn}>View All Positions</button>
            <Link href="/about" className={styles.watchVideoBtn}>Learn About Us</Link>
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
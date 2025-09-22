'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

interface ResearchPaper {
  id: string;
  title: string;
  category: string;
  date: string;
  authors: string[];
  abstract: string;
  citations: number;
  tags: string[];
}

export default function ResearchPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const researchPapers: ResearchPaper[] = [
    {
      id: '1',
      title: 'Transformer-Based Clinical Decision Support: A Novel Approach to Healthcare AI',
      category: 'Machine Learning',
      date: 'December 2024',
      authors: ['Dr. Sarah Chen', 'Dr. Michael Roberts', 'Dr. Emily Zhang'],
      abstract: 'We present a novel transformer-based architecture specifically designed for clinical decision support, achieving 94% accuracy in diagnostic predictions while maintaining interpretability for healthcare practitioners.',
      citations: 145,
      tags: ['Transformers', 'Healthcare AI', 'Clinical Decision Support']
    },
    {
      id: '2',
      title: 'Predictive Analytics in Population Health: Large-Scale Implementation Study',
      category: 'Healthcare',
      date: 'November 2024',
      authors: ['Dr. James Wilson', 'Dr. Maria Garcia', 'Dr. David Lee'],
      abstract: 'This study examines the implementation of predictive analytics across 500 healthcare facilities, demonstrating a 32% reduction in hospital readmissions through early intervention strategies.',
      citations: 89,
      tags: ['Population Health', 'Predictive Analytics', 'Healthcare Outcomes']
    },
    {
      id: '3',
      title: 'Federated Learning for Privacy-Preserving Healthcare AI',
      category: 'Privacy & Security',
      date: 'October 2024',
      authors: ['Dr. Alex Kumar', 'Dr. Jennifer Park', 'Dr. Thomas Brown'],
      abstract: 'We introduce a federated learning framework that enables collaborative AI model training across healthcare institutions while maintaining HIPAA compliance and patient privacy.',
      citations: 112,
      tags: ['Federated Learning', 'Privacy', 'HIPAA Compliance']
    },
    {
      id: '4',
      title: 'Real-Time Anomaly Detection in Medical Imaging Using Deep Learning',
      category: 'Computer Vision',
      date: 'September 2024',
      authors: ['Dr. Lisa Anderson', 'Dr. Robert Taylor', 'Dr. Michelle Wong'],
      abstract: 'Our deep learning model achieves 97% sensitivity in detecting anomalies in medical imaging, with real-time processing capabilities suitable for clinical deployment.',
      citations: 203,
      tags: ['Medical Imaging', 'Deep Learning', 'Anomaly Detection']
    },
    {
      id: '5',
      title: 'Natural Language Processing for Clinical Documentation: Reducing Physician Burnout',
      category: 'NLP',
      date: 'August 2024',
      authors: ['Dr. Kevin Martinez', 'Dr. Rachel Green', 'Dr. Steven Kim'],
      abstract: 'Implementation of our NLP system reduced clinical documentation time by 45%, directly addressing physician burnout while maintaining documentation quality and compliance.',
      citations: 167,
      tags: ['NLP', 'Clinical Documentation', 'Physician Burnout']
    },
    {
      id: '6',
      title: 'Reinforcement Learning for Treatment Optimization in Chronic Disease Management',
      category: 'Machine Learning',
      date: 'July 2024',
      authors: ['Dr. Patricia Davis', 'Dr. Christopher Lee', 'Dr. Amanda Johnson'],
      abstract: 'Using reinforcement learning to optimize treatment plans for chronic disease patients, we achieved 28% better outcomes compared to standard care protocols.',
      citations: 134,
      tags: ['Reinforcement Learning', 'Chronic Disease', 'Treatment Optimization']
    }
  ];

  const categories = [
    'all',
    'Machine Learning',
    'Healthcare',
    'Privacy & Security',
    'Computer Vision',
    'NLP',
    'Ethics & Safety'
  ];

  const filteredPapers = researchPapers.filter(paper => {
    const matchesCategory = selectedCategory === 'all' || paper.category === selectedCategory;
    const matchesSearch = paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          paper.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          paper.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            moccet
          </Link>
          <Link href="/contact" className={styles.contactSalesBtn}>
            Contact Us
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>moccet Research</h1>
          <p className={styles.subtitle}>
            Advancing the frontiers of AI in healthcare and beyond
          </p>
        </section>

        {/* Research Overview */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Our Research Mission</h2>
            <p>
              At moccet Research, we&apos;re dedicated to pushing the boundaries of artificial
              intelligence to solve humanity&apos;s most pressing challenges. Our interdisciplinary
              team of researchers, engineers, and domain experts work together to develop
              breakthrough technologies that are safe, beneficial, and accessible.
            </p>
            <p>
              We believe in open collaboration and regularly publish our findings to advance
              the field and benefit the global research community. Our work spans fundamental
              AI research, applied healthcare solutions, and the critical areas of AI safety
              and ethics.
            </p>
          </div>
        </section>

        {/* Research Areas */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Research Areas</h2>

            <div className={styles.researchAreasGrid}>
              <div className={styles.researchAreaCard}>
                <h3>Machine Learning & AI</h3>
                <p>
                  Developing next-generation architectures for deep learning, including
                  transformer models, reinforcement learning, and neural architecture search.
                </p>
              </div>
              <div className={styles.researchAreaCard}>
                <h3>Healthcare AI</h3>
                <p>
                  Creating AI systems that enhance clinical decision-making, improve patient
                  outcomes, and make healthcare more accessible and efficient.
                </p>
              </div>
              <div className={styles.researchAreaCard}>
                <h3>Privacy & Security</h3>
                <p>
                  Pioneering privacy-preserving AI techniques including federated learning,
                  differential privacy, and secure multi-party computation.
                </p>
              </div>
              <div className={styles.researchAreaCard}>
                <h3>Computer Vision</h3>
                <p>
                  Advancing medical imaging analysis, diagnostic assistance, and real-time
                  visual understanding for healthcare applications.
                </p>
              </div>
              <div className={styles.researchAreaCard}>
                <h3>Natural Language Processing</h3>
                <p>
                  Building language models that understand medical terminology, clinical
                  context, and can assist with documentation and communication.
                </p>
              </div>
              <div className={styles.researchAreaCard}>
                <h3>AI Ethics & Safety</h3>
                <p>
                  Ensuring AI systems are fair, transparent, interpretable, and aligned
                  with human values and medical ethics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Publications */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Recent Publications</h2>

            {/* Search and Filter */}
            <div className={styles.researchControls}>
              <input
                type="text"
                placeholder="Search papers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.researchSearch}
              />
              <div className={styles.filterContainer}>
                {categories.map(category => (
                  <button
                    key={category}
                    className={`${styles.filterBtn} ${selectedCategory === category ? styles.filterBtnActive : ''}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category === 'all' ? 'All Papers' : category}
                  </button>
                ))}
              </div>
            </div>

            {/* Papers List */}
            <div className={styles.papersList}>
              {filteredPapers.map(paper => (
                <div key={paper.id} className={styles.paperCard}>
                  <div className={styles.paperHeader}>
                    <h3>{paper.title}</h3>
                    <span className={styles.paperCategory}>{paper.category}</span>
                  </div>
                  <div className={styles.paperAuthors}>
                    {paper.authors.join(', ')}
                  </div>
                  <p className={styles.paperAbstract}>{paper.abstract}</p>
                  <div className={styles.paperTags}>
                    {paper.tags.map(tag => (
                      <span key={tag} className={styles.paperTag}>{tag}</span>
                    ))}
                  </div>
                  <div className={styles.paperFooter}>
                    <span className={styles.paperDate}>{paper.date}</span>
                    <span className={styles.paperCitations}>{paper.citations} citations</span>
                    <div className={styles.paperActions}>
                      <button className={styles.readPaperBtn}>Read Paper</button>
                      <button className={styles.citePaperBtn}>Cite</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Research Impact */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Research Impact</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <h3>150+</h3>
                <p>Published Papers</p>
              </div>
              <div className={styles.statCard}>
                <h3>50+</h3>
                <p>Research Partners</p>
              </div>
              <div className={styles.statCard}>
                <h3>10,000+</h3>
                <p>Citations</p>
              </div>
              <div className={styles.statCard}>
                <h3>25</h3>
                <p>Patents Filed</p>
              </div>
            </div>
          </div>
        </section>

        {/* Collaborations */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Research Collaborations</h2>
            <p>
              We collaborate with leading academic institutions, research labs, and healthcare
              organizations worldwide to advance the state of AI research.
            </p>
            <div className={styles.collaborationLogos}>
              <p className={styles.logoPlaceholder}>
                [Stanford] [MIT] [Harvard Medical] [Johns Hopkins] [Oxford] [Mayo Clinic] [NIH] [DeepMind]
              </p>
            </div>
          </div>
        </section>

        {/* Open Source */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Open Source Contributions</h2>
            <p>
              We believe in giving back to the community. Many of our research projects
              are open source, allowing researchers worldwide to build upon our work.
            </p>

            <div className={styles.openSourceGrid}>
              <div className={styles.openSourceCard}>
                <h3>moccet-transformer</h3>
                <p>State-of-the-art transformer models for healthcare applications</p>
                <div className={styles.openSourceStats}>
                  <span>3.2k stars</span>
                  <span>450 forks</span>
                </div>
                <button className={styles.viewRepoBtn}>View on GitHub</button>
              </div>
              <div className={styles.openSourceCard}>
                <h3>clinical-ml-toolkit</h3>
                <p>Comprehensive toolkit for machine learning in clinical settings</p>
                <div className={styles.openSourceStats}>
                  <span>2.8k stars</span>
                  <span>380 forks</span>
                </div>
                <button className={styles.viewRepoBtn}>View on GitHub</button>
              </div>
              <div className={styles.openSourceCard}>
                <h3>federated-health</h3>
                <p>Framework for federated learning in healthcare</p>
                <div className={styles.openSourceStats}>
                  <span>1.9k stars</span>
                  <span>220 forks</span>
                </div>
                <button className={styles.viewRepoBtn}>View on GitHub</button>
              </div>
              <div className={styles.openSourceCard}>
                <h3>medical-nlp</h3>
                <p>NLP models trained on medical literature and clinical notes</p>
                <div className={styles.openSourceStats}>
                  <span>4.1k stars</span>
                  <span>560 forks</span>
                </div>
                <button className={styles.viewRepoBtn}>View on GitHub</button>
              </div>
            </div>
          </div>
        </section>

        {/* Research Team */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Research Team</h2>
            <p>
              Our research team includes world-class scientists and engineers from diverse
              backgrounds, united by a passion for using AI to improve lives.
            </p>

            <div className={styles.teamHighlights}>
              <div className={styles.teamHighlight}>
                <h3>Dr. Sarah Chen</h3>
                <p className={styles.teamRole}>Chief Research Officer</p>
                <p className={styles.teamBio}>
                  Former Stanford AI Lab director with 20+ years in machine learning research
                </p>
              </div>
              <div className={styles.teamHighlight}>
                <h3>Dr. Michael Roberts</h3>
                <p className={styles.teamRole}>Head of Healthcare AI</p>
                <p className={styles.teamBio}>
                  Previously led clinical AI research at Johns Hopkins Medicine
                </p>
              </div>
              <div className={styles.teamHighlight}>
                <h3>Dr. Emily Zhang</h3>
                <p className={styles.teamRole}>Director of AI Safety</p>
                <p className={styles.teamBio}>
                  Pioneer in AI alignment and safety research, formerly at DeepMind
                </p>
              </div>
            </div>

            <button className={styles.viewAllTeamBtn}>View Full Team</button>
          </div>
        </section>

        {/* Join Our Research */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Join Our Research</h2>

            <div className={styles.researchOpportunities}>
              <div className={styles.opportunityCard}>
                <h3>Research Internships</h3>
                <p>
                  3-6 month programs for graduate students to work on cutting-edge
                  AI research projects alongside our team.
                </p>
                <button className={styles.applyBtn}>Apply Now</button>
              </div>
              <div className={styles.opportunityCard}>
                <h3>Research Scientist Positions</h3>
                <p>
                  Full-time positions for PhD-level researchers to lead groundbreaking
                  research initiatives.
                </p>
                <button className={styles.applyBtn}>View Openings</button>
              </div>
              <div className={styles.opportunityCard}>
                <h3>Academic Collaborations</h3>
                <p>
                  Partner with us on research projects, share resources, and co-author
                  publications.
                </p>
                <button className={styles.applyBtn}>Get in Touch</button>
              </div>
              <div className={styles.opportunityCard}>
                <h3>Research Grants</h3>
                <p>
                  We provide funding for external research that aligns with our mission
                  to advance AI for good.
                </p>
                <button className={styles.applyBtn}>Learn More</button>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className={styles.contentSection}>
          <div className={styles.articleContent}>
            <h2>Stay Updated</h2>
            <p>
              Subscribe to our research newsletter for the latest publications, breakthrough
              announcements, and research opportunities.
            </p>
            <form className={styles.newsletterForm}>
              <input
                type="email"
                placeholder="Enter your email"
                className={styles.newsletterInput}
              />
              <button type="submit" className={styles.newsletterBtn}>
                Subscribe
              </button>
            </form>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalCtaTitle}>Explore Our Research</h2>
          <p className={styles.finalCtaSubtitle}>
            Dive deeper into our publications and research initiatives
          </p>
          <div className={styles.buttonRow}>
            <button className={styles.ctaBtn}>View All Publications</button>
            <Link href="/contact" className={styles.watchVideoBtn}>Contact Research Team</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerColumn}>
              <h4 className={styles.footerColumnTitle}>Research</h4>
              <ul className={styles.footerLinks}>
                <li><a href="#publications">Publications</a></li>
                <li><a href="#areas">Research Areas</a></li>
                <li><a href="#team">Research Team</a></li>
                <li><a href="#opensource">Open Source</a></li>
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
                <li><Link href="/business">Business</Link></li>
                <li><Link href="/solutions">Solutions</Link></li>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Reference</a></li>
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
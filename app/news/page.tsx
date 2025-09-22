'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';

interface NewsItem {
  id: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  readTime: string;
  featured?: boolean;
}

export default function NewsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const newsItems: NewsItem[] = [
    {
      id: '1',
      title: 'Moccet Health Announces Revolutionary AI-Powered Diagnostic Platform',
      date: '2024-01-15',
      category: 'Product Launch',
      excerpt: 'Our latest diagnostic platform leverages advanced machine learning to provide 99.9% accurate health assessments in under 60 seconds.',
      readTime: '5 min read',
      featured: true
    },
    {
      id: '2',
      title: 'Partnership with Major Healthcare Network Expands Access to 50 Million Patients',
      date: '2024-01-12',
      category: 'Partnership',
      excerpt: 'Strategic collaboration with HealthNet Global brings Moccet technology to underserved communities across three continents.',
      readTime: '3 min read'
    },
    {
      id: '3',
      title: 'FDA Grants Breakthrough Device Designation to Moccet Cancer Detection System',
      date: '2024-01-10',
      category: 'Regulatory',
      excerpt: 'Recognition accelerates the path to market for our early-stage cancer detection technology, potentially saving millions of lives.',
      readTime: '4 min read',
      featured: true
    },
    {
      id: '4',
      title: 'Research Breakthrough: AI Model Predicts Rare Diseases with 95% Accuracy',
      date: '2024-01-08',
      category: 'Research',
      excerpt: 'Published findings demonstrate unprecedented accuracy in identifying rare genetic conditions from standard medical imaging.',
      readTime: '6 min read'
    },
    {
      id: '5',
      title: 'Moccet Health Raises $500M Series C to Accelerate Global Expansion',
      date: '2024-01-05',
      category: 'Funding',
      excerpt: 'Investment round led by leading healthcare investors will fund expansion into new markets and accelerate R&D initiatives.',
      readTime: '4 min read'
    },
    {
      id: '6',
      title: 'New Clinical Trial Shows 40% Reduction in Diagnostic Errors',
      date: '2023-12-28',
      category: 'Clinical',
      excerpt: 'Multi-center study validates the effectiveness of our AI-assisted diagnostic tools in real-world clinical settings.',
      readTime: '5 min read'
    }
  ];

  const categories = ['all', 'Product Launch', 'Partnership', 'Regulatory', 'Research', 'Funding', 'Clinical'];

  const filteredNews = newsItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}></span>
            <span className={styles.logoText}>Moccet</span>
          </Link>
          <nav className={styles.headerNav}>
            <Link href="/research">Research</Link>
            <Link href="/safety">Safety</Link>
            <Link href="/business">For Business</Link>
            <Link href="/developers">For Developers</Link>
            <Link href="/api-platform">API Platform</Link>
            <Link href="/solutions">Solutions</Link>
            <Link href="/company">Company</Link>
            <Link href="/news" className={styles.active}>News</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.newsMain}>
        <div className={styles.newsHero}>
          <h1>News & Updates</h1>
          <p>Stay informed about the latest developments, partnerships, and breakthroughs from Moccet Health</p>
        </div>

        {/* Search and Filter Bar */}
        <div className={styles.newsControls}>
          <div className={styles.newsSearch}>
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.newsCategories}>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`${styles.categoryButton} ${selectedCategory === category ? styles.active : ''}`}
              >
                {category === 'all' ? 'All News' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Featured News */}
        <div className={styles.featuredNews}>
          <h2>Featured Stories</h2>
          <div className={styles.featuredGrid}>
            {filteredNews.filter(item => item.featured).map(item => (
              <article key={item.id} className={styles.featuredCard}>
                <div className={styles.featuredBadge}>Featured</div>
                <span className={styles.newsCategory}>{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
                <div className={styles.newsMeta}>
                  <span>{item.date}</span>
                  <span>•</span>
                  <span>{item.readTime}</span>
                </div>
                <button className={styles.readMore}>Read Full Story →</button>
              </article>
            ))}
          </div>
        </div>

        {/* All News */}
        <div className={styles.allNews}>
          <h2>Latest Updates</h2>
          <div className={styles.newsList}>
            {filteredNews.map(item => (
              <article key={item.id} className={styles.newsItem}>
                <div className={styles.newsContent}>
                  <span className={styles.newsCategory}>{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.excerpt}</p>
                  <div className={styles.newsMeta}>
                    <span>{item.date}</span>
                    <span>•</span>
                    <span>{item.readTime}</span>
                  </div>
                </div>
                <button className={styles.readMore}>Read More →</button>
              </article>
            ))}
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className={styles.newsletter}>
          <div className={styles.newsletterContent}>
            <h2>Stay Updated</h2>
            <p>Subscribe to our newsletter for the latest news and insights from Moccet Health</p>
            <form className={styles.newsletterForm}>
              <input
                type="email"
                placeholder="Enter your email address"
                className={styles.emailInput}
              />
              <button type="submit" className={styles.subscribeButton}>
                Subscribe
              </button>
            </form>
            <p className={styles.newsletterNote}>
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerSection}>
            <h4>Platform</h4>
            <ul className={styles.footerLinks}>
              <li><Link href="/safety">Safety Approach</Link></li>
              <li><Link href="/security">Security and Privacy</Link></li>
            </ul>
          </div>
          <div className={styles.footerSection}>
            <h4>Research</h4>
            <ul className={styles.footerLinks}>
              <li><Link href="/research">Research Index</Link></li>
              <li><Link href="/research">Research Overview</Link></li>
              <li><Link href="/research">Our Research</Link></li>
              <li><Link href="/legal">Safety Approach</Link></li>
            </ul>
          </div>
          <div className={styles.footerSection}>
            <h4>Business</h4>
            <ul className={styles.footerLinks}>
              <li><Link href="/business">Business Overview</Link></li>
              <li><Link href="/solutions">Solutions</Link></li>
              <li><Link href="/contact">Contact Sales</Link></li>
            </ul>
          </div>
          <div className={styles.footerSection}>
            <h4>Company</h4>
            <ul className={styles.footerLinks}>
              <li><Link href="/about">About Moccet</Link></li>
              <li><Link href="/careers">Careers</Link></li>
              <li><Link href="/company">Company Overview</Link></li>
              <li><Link href="/philosophy">Our Philosophy</Link></li>
              <li><Link href="/brand">Brand Guidelines</Link></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>© 2024 Moccet Health. All rights reserved.</p>
          <div className={styles.footerBottomLinks}>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/legal">Legal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
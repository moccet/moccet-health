'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './news.css';

interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  image?: string;
}

export default function NewsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch('/api/substack-feed');
        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          setPosts(data.posts || []);
        }
      } catch (err) {
        console.error('Error fetching posts:', err);
        setError('Failed to load blog posts');
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  return (
    <main className="news-page">
      {/* Navigation */}
      <nav className="news-nav">
        <Link href="/" className="nav-logo" role="img" aria-label="Moccet logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </Link>
        <div className="nav-menu">
          <Link href="/sage" className="nav-link">Sage</Link>
          <Link href="/forge" className="nav-link">Forge</Link>
          <Link href="/news" className="nav-link">Stories</Link>
          <Link href="/#waitlist" className="nav-link">
            Join the waitlist
            <svg className="nav-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
              <Link href="/sage" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Sage
              </Link>
              <Link href="/forge" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Forge
              </Link>
              <Link href="/news" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Stories
              </Link>
              <Link href="/#waitlist" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Join the waitlist
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="news-container">
        {loading ? (
          <div className="loading-state">
            <p>Loading posts...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Unable to load posts</h3>
            <p>{error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <h3>Coming Soon</h3>
            <p>
              We&apos;re getting ready to share insights on health data, metabolic science, and product development.
              Follow us on <a href="https://substack.com/@moccetai" target="_blank" rel="noopener noreferrer">Substack</a> to be notified when we publish our first post.
            </p>
          </div>
        ) : (
          <>
            {/* Featured Post */}
            {featuredPost && (
              <section className="featured-post">
                <Link href={`/news/${generateSlug(featuredPost.title)}`} className="featured-post-link">
                  {featuredPost.image && (
                    <div className="featured-post-image-wrapper">
                      <img
                        src={featuredPost.image}
                        alt={featuredPost.title}
                        className="featured-post-image"
                      />
                    </div>
                  )}
                  <div className="featured-post-content">
                    <h2 className="featured-post-title">{featuredPost.title}</h2>
                    <p className="featured-post-description">{featuredPost.description}</p>
                    <button className="featured-post-button">READ MORE →</button>
                  </div>
                </Link>
              </section>
            )}

            {/* Blog Grid */}
            {remainingPosts.length > 0 && (
              <section className="blog-grid-section">
                <div className="blog-grid">
                  {remainingPosts.map((post, index) => (
                    <Link
                      key={index}
                      href={`/news/${generateSlug(post.title)}`}
                      className="blog-card"
                    >
                      {post.image && (
                        <div className="blog-card-image-wrapper">
                          <img
                            src={post.image}
                            alt={post.title}
                            className="blog-card-image"
                          />
                        </div>
                      )}
                      <div className="blog-card-content">
                        <h3 className="blog-card-title">{post.title}</h3>
                        <p className="blog-card-date">
                          {new Date(post.pubDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

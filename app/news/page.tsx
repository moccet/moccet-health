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

  function formatDate(dateString: string): string {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  return (
    <main className="landing-page-moccet">
      <section
        className="first-page"
        style={{
          backgroundImage: "url('https://c.animaapp.com/EVbz3TeZ/img/susan-wilkinson-eo76daedyim-unsplash.jpg')"
        }}
      >
        <Link href="/" className="product-link product-link-left">moccet</Link>
        <div className="logo" role="img" aria-label="News logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </div>
        <Link href="/sage" className="product-link product-link-right">sage</Link>
        <header className="title-centered">
          <h1 className="news-title">news</h1>
        </header>
      </section>

      {/* Blog Section */}
      <section className="blog-section">
        <div className="blog-container">
          <div className="blog-header">
            <h2>Latest Updates</h2>
            <p>Stay informed with insights from moccet on health data, metabolic science, and building better products.</p>
          </div>

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
                We're getting ready to share insights on health data, metabolic science, and product development.
                Follow us on <a href="https://substack.com/@moccetai" target="_blank" rel="noopener noreferrer">Substack</a> to be notified when we publish our first post.
              </p>
            </div>
          ) : (
            <div className="blog-grid">
              {posts.map((post, index) => (
                <Link
                  key={index}
                  href={`/news/${generateSlug(post.title)}`}
                  className="blog-card"
                >
                  {post.image && (
                    <img
                      src={post.image}
                      alt={post.title}
                      className="blog-card-image"
                    />
                  )}
                  <div className="blog-card-content">
                    <div className="blog-card-date">{formatDate(post.pubDate)}</div>
                    <h3 className="blog-card-title">{post.title}</h3>
                    <p className="blog-card-description">{post.description}</p>
                    <span className="blog-card-link">Read more →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

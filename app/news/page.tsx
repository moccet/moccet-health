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

  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  return (
    <main className="news-page">
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
                        <img
                          src={post.image}
                          alt={post.title}
                          className="blog-card-image"
                        />
                      )}
                      <div className="blog-card-content">
                        <h3 className="blog-card-title">{post.title}</h3>
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

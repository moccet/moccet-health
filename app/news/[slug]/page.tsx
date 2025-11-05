'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import './blog-detail.css';

interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  image?: string;
}

export default function BlogDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  useEffect(() => {
    async function fetchPost() {
      try {
        const response = await fetch('/api/substack-feed');
        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          const posts = data.posts || [];
          // Find post by slug
          const foundPost = posts.find((p: BlogPost) =>
            generateSlug(p.title) === slug || generateSlug(p.link) === slug
          );

          if (foundPost) {
            setPost(foundPost);
          } else {
            setError('Blog post not found');
          }
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load blog post');
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [slug]);

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

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

  return (
    <main className="blog-detail-page">
      <nav className="blog-detail-nav">
        <Link href="/" className="nav-link">moccet</Link>
        <Link href="/news" className="nav-link nav-link-back">← Back to News</Link>
        <Link href="/sage" className="nav-link">sage</Link>
      </nav>

      {loading ? (
        <div className="blog-detail-content">
          <div className="loading-state">
            <p>Loading post...</p>
          </div>
        </div>
      ) : error || !post ? (
        <div className="blog-detail-content">
          <div className="error-state">
            <h1>Post Not Found</h1>
            <p>{error || 'The blog post you are looking for does not exist.'}</p>
            <Link href="/news" className="back-link">← Back to News</Link>
          </div>
        </div>
      ) : (
        <article>
          {post.image && (
            <div className="blog-detail-image-container">
              <img
                src={post.image}
                alt={post.title}
                className="blog-detail-image"
              />
            </div>
          )}

          <div className="blog-detail-content">
            <header className="blog-detail-header">
              <div className="blog-detail-meta">
                <div className="blog-detail-meta-info">
                  <div className="blog-detail-meta-item">
                    <span className="blog-detail-meta-label">Written by</span>
                    <span className="blog-detail-meta-value">moccet Team</span>
                  </div>
                  <div className="blog-detail-meta-item">
                    <span className="blog-detail-meta-label">Published on</span>
                    <time className="blog-detail-meta-value">{formatDate(post.pubDate)}</time>
                  </div>
                </div>
                <div className="blog-detail-social-buttons">
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl || post.link)}&text=${encodeURIComponent(post.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="blog-detail-social-button"
                    aria-label="Share on X (Twitter)"
                  >
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(currentUrl || post.link)}&title=${encodeURIComponent(post.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="blog-detail-social-button"
                    aria-label="Share on LinkedIn"
                  >
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                </div>
              </div>
              <h1 className="blog-detail-title">{post.title}</h1>
            </header>

            <div className="blog-detail-body">
              <div
                className="blog-content"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>

            <footer className="blog-detail-footer">
              <a
                href={post.link}
                target="_blank"
                rel="noopener noreferrer"
                className="original-link"
              >
                Read original on Substack →
              </a>
              <Link href="/news" className="back-link">← Back to News</Link>
            </footer>
          </div>
        </article>
      )}
    </main>
  );
}

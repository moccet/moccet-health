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

      <article className="blog-detail-content">
        {loading ? (
          <div className="loading-state">
            <p>Loading post...</p>
          </div>
        ) : error || !post ? (
          <div className="error-state">
            <h1>Post Not Found</h1>
            <p>{error || 'The blog post you are looking for does not exist.'}</p>
            <Link href="/news" className="back-link">← Back to News</Link>
          </div>
        ) : (
          <>
            <header className="blog-detail-header">
              <div className="blog-detail-meta">
                <time className="blog-detail-date">{formatDate(post.pubDate)}</time>
              </div>
              <h1 className="blog-detail-title">{post.title}</h1>
            </header>

            {post.image && (
              <div className="blog-detail-image-container">
                <img
                  src={post.image}
                  alt={post.title}
                  className="blog-detail-image"
                />
              </div>
            )}

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
          </>
        )}
      </article>
    </main>
  );
}

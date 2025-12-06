import Link from 'next/link';
import NewsNavigation from './NewsNavigation';
import { createClient } from '@/lib/supabase/server';
import './news.css';

interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  image?: string;
}

const CACHE_KEY = 'substack_posts_cache';

async function getPosts(): Promise<BlogPost[]> {
  try {
    // Try to get from Supabase cache first
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('cache_store')
      .select('value')
      .eq('key', CACHE_KEY)
      .single();

    if (!error && data?.value) {
      console.log('[News Page] Serving posts from cache');
      return data.value as BlogPost[];
    }

    console.log('[News Page] No cache found, fetching from Substack');

    // Fallback to fetching from Substack if no cache
    const response = await fetch('https://moccetai.substack.com/feed', {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error('Failed to fetch RSS feed');
    }

    const xmlText = await response.text();
    const posts = parseRSSFeed(xmlText);

    return posts;
  } catch (err) {
    console.error('[News Page] Error fetching posts:', err);
    return [];
  }
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseRSSFeed(xmlText: string): BlogPost[] {
  const items: BlogPost[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const matches = xmlText.matchAll(itemRegex);

  for (const match of matches) {
    const itemContent = match[1];

    const title = extractTag(itemContent, 'title');
    const link = extractTag(itemContent, 'link');
    const pubDate = extractTag(itemContent, 'pubDate');
    const description = extractTag(itemContent, 'description');
    const content = extractTag(itemContent, 'content:encoded') || description;

    const imageMatch = content.match(/<img[^>]+src="([^">]+)"/);
    const image = imageMatch ? imageMatch[1] : undefined;

    const contentWithoutFirstImage = image
      ? content.replace(/<img[^>]*src="[^"]*"[^>]*>/, '')
      : content;

    const cleanTitle = stripHTML(title);
    const cleanDesc = stripHTML(description);

    if (
      title &&
      link &&
      cleanTitle.toLowerCase() !== 'coming soon' &&
      !cleanDesc.toLowerCase().includes('this is moccet\'s substack') &&
      !cleanDesc.toLowerCase().includes('your body generates data')
    ) {
      items.push({
        title: cleanTitle,
        link: cleanHTML(link),
        pubDate: pubDate || '',
        description: stripHTML(description),
        content: cleanHTML(contentWithoutFirstImage),
        image
      });
    }
  }

  return items;
}

function extractTag(text: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:[^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function cleanHTML(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripHTML(text: string): string {
  return cleanHTML(text).replace(/<[^>]+>/g, '');
}

export default async function NewsPage() {
  const posts = await getPosts();
  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  return (
    <main className="news-page">
      <NewsNavigation />

      <div className="news-container">
        {posts.length === 0 ? (
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

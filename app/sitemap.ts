import { MetadataRoute } from 'next'

interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  image?: string;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.moccet.ai';

  // Fetch blog posts
  let blogPosts: BlogPost[] = [];
  try {
    const response = await fetch('https://moccetai.substack.com/feed', {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (response.ok) {
      const xmlText = await response.text();
      blogPosts = parseRSSFeed(xmlText);
    }
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
  }

  // Static pages - prioritized for health/fitness SEO
  const staticPages = [
    // Core pages
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    // Product pages - high priority for SEO
    {
      url: `${baseUrl}/sage`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.95,
    },
    {
      url: `${baseUrl}/forge`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.95,
    },
    // Onboarding pages
    {
      url: `${baseUrl}/sage/onboarding`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/forge/onboarding`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    // Content pages
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    // Legal pages
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-use`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
  ];

  // Blog post pages
  const blogPages = blogPosts.map((post) => ({
    url: `${baseUrl}/news/${generateSlug(post.title)}`,
    lastModified: new Date(post.pubDate),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages];
}

// RSS feed parsing functions
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
        description: stripHTML(description).substring(0, 200) + '...',
        content: cleanHTML(content),
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

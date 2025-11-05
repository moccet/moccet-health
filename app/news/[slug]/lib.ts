export interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  image?: string;
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const response = await fetch('https://moccetai.substack.com/feed', {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      return [];
    }

    const xmlText = await response.text();
    return parseRSSFeed(xmlText);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await getBlogPosts();
  return posts.find(p => generateSlug(p.title) === slug) || null;
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

    // Remove the first image from content to avoid duplication
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
        description: stripHTML(description).substring(0, 200) + '...',
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

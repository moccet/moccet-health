import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const CACHE_KEY = 'substack_posts_cache';

interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  image?: string;
}

export async function POST() {
  try {
    console.log('[Refresh Cache] Starting manual cache refresh...');

    // Fetch fresh data from Substack
    const response = await fetch('https://moccetai.substack.com/feed', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch RSS feed from Substack');
    }

    const xmlText = await response.text();
    const posts = parseRSSFeed(xmlText);

    console.log(`[Refresh Cache] Parsed ${posts.length} posts from Substack`);

    // Cache the posts in Supabase
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('cache_store')
      .upsert({
        key: CACHE_KEY,
        value: posts,
        updated_at: now
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('[Refresh Cache] Error saving to Supabase:', error);
      throw new Error(`Failed to cache posts: ${error.message}`);
    }

    console.log(`[Refresh Cache] ✅ Successfully cached ${posts.length} posts`);

    return NextResponse.json({
      success: true,
      message: 'Blog cache refreshed successfully',
      postsCount: posts.length,
      fromCache: false
    });
  } catch (error) {
    console.error('[Refresh Cache] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh cache'
    }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}

// RSS parsing functions (copied from substack-feed route)
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

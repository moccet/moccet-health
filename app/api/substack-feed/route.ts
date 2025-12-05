import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const CACHE_KEY = 'substack_posts_cache';
const CACHE_DURATION_MS = 3600000; // 1 hour in milliseconds

// In-memory cache to make it super fast
let memoryCache: { posts: BlogPost[], timestamp: number } | null = null;

export async function GET() {
  try {
    // Check in-memory cache first (instant!)
    if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION_MS) {
      console.log('[Substack Feed] Serving from memory cache (instant)');
      return NextResponse.json({ posts: memoryCache.posts, fromCache: true }, { status: 200 });
    }

    // Check Supabase cache (fast)
    const supabase = await createClient();
    const cachedData = await getCachedFromSupabase(supabase);

    if (cachedData) {
      const cacheAge = Date.now() - cachedData.timestamp;

      if (cacheAge < CACHE_DURATION_MS) {
        // Cache is fresh - update memory cache and return
        console.log('[Substack Feed] Serving from Supabase cache');
        memoryCache = cachedData;
        return NextResponse.json({ posts: cachedData.posts, fromCache: true }, { status: 200 });
      } else {
        // Cache is stale, but return it while we refresh in the background
        console.log('[Substack Feed] Cache stale, returning cached data while refreshing');
        memoryCache = cachedData;
        refreshCacheInBackground();
        return NextResponse.json({ posts: cachedData.posts, fromCache: true }, { status: 200 });
      }
    }

    // No cache available, fetch fresh data
    console.log('[Substack Feed] No cache, fetching fresh data');
    const freshPosts = await fetchAndCachePosts();
    return NextResponse.json({ posts: freshPosts }, { status: 200 });

  } catch (error) {
    console.error('Error in substack feed route:', error);

    // Try to return memory cache as last resort
    if (memoryCache) {
      console.log('[Substack Feed] Error occurred, serving stale memory cache');
      return NextResponse.json({ posts: memoryCache.posts, fromCache: true }, { status: 200 });
    }

    // Try Supabase cache as fallback
    try {
      const supabaseFallback = await createClient();
      const cachedData = await getCachedFromSupabase(supabaseFallback);
      if (cachedData) {
        console.log('[Substack Feed] Error occurred, serving stale Supabase cache');
        return NextResponse.json({ posts: cachedData.posts, fromCache: true }, { status: 200 });
      }
    } catch (cacheError) {
      console.error('Failed to retrieve cache fallback:', cacheError);
    }

    return NextResponse.json({ posts: [], error: 'Failed to fetch blog posts' }, { status: 200 });
  }
}

async function getCachedFromSupabase(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data, error } = await supabase
      .from('cache_store')
      .select('value, updated_at')
      .eq('key', CACHE_KEY)
      .single();

    if (error || !data) return null;

    return {
      posts: data.value as BlogPost[],
      timestamp: new Date(data.updated_at).getTime()
    };
  } catch (error) {
    console.error('Error getting cached posts from Supabase:', error);
    return null;
  }
}

async function fetchAndCachePosts() {
  // Fetch the RSS feed from Substack
  const response = await fetch('https://moccetai.substack.com/feed', {
    cache: 'no-store' // Always fetch fresh when explicitly calling this
  });

  if (!response.ok) {
    throw new Error('Failed to fetch RSS feed');
  }

  const xmlText = await response.text();
  const items = parseRSSFeed(xmlText);

  // Cache the posts
  await cachePosts(items);

  return items;
}

async function cachePosts(posts: BlogPost[]) {
  try {
    const now = new Date().toISOString();

    // Update memory cache immediately
    memoryCache = {
      posts,
      timestamp: Date.now()
    };

    // Update Supabase cache
    const supabase = await createClient();
    const { error } = await supabase
      .from('cache_store')
      .upsert({
        key: CACHE_KEY,
        value: posts,
        updated_at: now
      }, {
        onConflict: 'key'
      });

    if (error) throw error;

    console.log(`[Substack Feed] Cached ${posts.length} posts`);
  } catch (error) {
    console.error('Error caching posts:', error);
    // Don't throw - caching failure shouldn't break the response
  }
}

function refreshCacheInBackground() {
  // Fire and forget - refresh cache without blocking the response
  fetchAndCachePosts().catch(err => {
    console.error('Background cache refresh failed:', err);
  });
}

interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  image?: string;
}

function parseRSSFeed(xmlText: string): BlogPost[] {
  const items: BlogPost[] = [];

  // Simple XML parsing using regex (for basic RSS structure)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const matches = xmlText.matchAll(itemRegex);

  for (const match of matches) {
    const itemContent = match[1];

    const title = extractTag(itemContent, 'title');
    const link = extractTag(itemContent, 'link');
    const pubDate = extractTag(itemContent, 'pubDate');
    const description = extractTag(itemContent, 'description');
    const content = extractTag(itemContent, 'content:encoded') || description;

    // Try to extract image from content
    const imageMatch = content.match(/<img[^>]+src="([^">]+)"/);
    const image = imageMatch ? imageMatch[1] : undefined;

    // Remove the first image from content to avoid duplication
    const contentWithoutFirstImage = image
      ? content.replace(/<img[^>]*src="[^"]*"[^>]*>/, '')
      : content;

    // Filter out placeholder/profile posts
    const cleanTitle = stripHTML(title);
    const cleanDesc = stripHTML(description);

    // Skip posts with generic titles or profile descriptions
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

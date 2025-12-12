import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
      // OpenAI crawlers
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
      // Anthropic crawlers
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
      // Perplexity
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
      // Google AI
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
      // Common Crawl (used for AI training)
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: ['/api/', '/private/', '/dashboard/', '/admin/'],
      },
    ],
    sitemap: 'https://moccet.ai/sitemap.xml',
    host: 'https://moccet.ai',
  }
}

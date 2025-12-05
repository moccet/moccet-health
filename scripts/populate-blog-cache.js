#!/usr/bin/env node

/**
 * Script to populate the blog cache
 * Run this after deploying or whenever you want to refresh the cache
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function populateCache() {
  console.log('🔄 Populating blog cache...');
  console.log(`📍 Site URL: ${siteUrl}`);

  try {
    const response = await fetch(`${siteUrl}/api/admin/refresh-blog-cache`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Blog cache populated successfully!');
      console.log(`📝 Cached ${data.postsCount} posts`);
      console.log(`💾 From cache: ${data.fromCache ? 'Yes' : 'No (fetched fresh)'}`);
    } else {
      console.error('❌ Failed to populate cache:', data.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error populating cache:', error.message);
    process.exit(1);
  }
}

populateCache();

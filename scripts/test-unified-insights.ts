/**
 * Test script for insight generation with unified data
 * Usage: npx tsx scripts/test-unified-insights.ts [email] [base_url]
 */

async function testInsights() {
  const email = process.argv[2] || 'sofian@moccet.com';
  const baseUrl = process.argv[3] || 'https://www.moccet.ai';

  console.log('Testing insight generation with unified data...\n');
  console.log('Email:', email);
  console.log('Base URL:', baseUrl);
  console.log('');

  try {
    const res = await fetch(baseUrl + '/api/insights/multi-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mode: 'quick', useUnified: true }),
    });

    console.log('Status:', res.status);
    const data = await res.json();

    if (data.error) {
      console.log('Error:', data.error);
      return;
    }

    console.log('Success:', data.success);
    console.log('Insights generated:', data.insights?.length || 0);
    console.log('Data source:', data.dataSource || 'N/A');
    console.log('Processing time:', data.processingTimeMs, 'ms');

    if (data.insights && data.insights.length > 0) {
      console.log('\n=== TOP INSIGHTS ===\n');
      data.insights.slice(0, 3).forEach((insight: any, i: number) => {
        console.log((i + 1) + '. ' + insight.title);
        console.log('   Category: ' + insight.category);
        console.log('   ' + (insight.recommendation || insight.finding || '').slice(0, 120) + '...');
        console.log('');
      });
    }
  } catch (e) {
    console.log('Fetch error:', e);
  }
}

testInsights();

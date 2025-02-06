import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

const apifyToken = process.env.APIFY_API_TOKEN || 'apify_api_5cO4CWdFzGh7b6vNx8nVRIknc42Cce1QQzdO';

if (!apifyToken) {
  throw new Error('APIFY_API_TOKEN is not defined in environment variables');
}

const client = new ApifyClient({
  token: apifyToken,
});

export async function POST(request: Request) {
  try {
    const { profileUrl, count, cookies } = await request.json();

    const input = {
      profileUrl,
      friendshipType: "followers",
      count,
      minDelay: 1,
      maxDelay: 15,
      cookie: cookies
    };

    const run = await client.actor("curious_coder/twitter-scraper").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to scrape followers:', error);
    return NextResponse.json({ 
      error: 'Failed to scrape followers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
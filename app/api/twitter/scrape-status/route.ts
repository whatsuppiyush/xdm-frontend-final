import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileUrl = searchParams.get('profileUrl');
    
    if (!profileUrl) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Missing profileUrl parameter' 
      }, { status: 400 });
    }
    
    // Get scraping status from Redis
    const key = `scrape:${profileUrl}`;
    const status = await redis.get(key);
    
    if (!status) {
      return NextResponse.json({ 
        status: 'in_progress', 
        message: 'Scraping in progress' 
      });
    }
    
    // Check if status is already an object or a string that needs parsing
    const data = typeof status === 'string' ? JSON.parse(status) : status;
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error checking scrape status:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Failed to check scrape status'
    }, { status: 500 });
  }
} 
import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { DAILY_MESSAGE_LIMIT } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get current count from Redis
    const today = new Date().toISOString().split('T')[0];
    const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
    
    const currentCount = (await redis.get(dailyLimitKey)) || '0';
    
    // Convert currentCount to string before parsing
    const countValue = typeof currentCount === 'object' ? JSON.stringify(currentCount) : String(currentCount);

    return NextResponse.json({ 
      used: parseInt(countValue), 
      total: DAILY_MESSAGE_LIMIT,
      remaining: DAILY_MESSAGE_LIMIT - parseInt(countValue)
    });
  } catch (error) {
    console.error('Failed to fetch daily limit:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch daily limit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    return NextResponse.json({ 
      authenticated: !!session,
      user: session?.user || null 
    });
  } catch (error) {
    console.error('Auth check failed:', error);
    return NextResponse.json({ 
      authenticated: false, 
      error: 'Failed to check authentication status' 
    }, { status: 500 });
  }
} 
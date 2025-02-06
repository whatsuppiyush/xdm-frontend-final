import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cookies, twitterAccountName } = body;

    if (!cookies || !Array.isArray(cookies)) {
      return NextResponse.json({ error: 'Invalid cookies format' }, { status: 400 });
    }

    if (!twitterAccountName) {
      return NextResponse.json({ error: 'Twitter account name is required' }, { status: 400 });
    }

    // Check if this Twitter account name already exists for this user
    const existingAccount = await prisma.twitterAccount.findFirst({
      where: {
        twitterAccountName,
        userId: session.user.id
      } as Prisma.TwitterAccountWhereInput
    });

    let twitterAccount;
    if (existingAccount) {
      // Update existing account
      twitterAccount = await prisma.twitterAccount.update({
        where: {
          id: existingAccount.id
        },
        data: {
          cookies: cookies,
          createdAt: new Date()
        }
      });
    } else {
      // Create new account using unchecked create
      twitterAccount = await prisma.twitterAccount.create({
        data: {
          twitterAccountName,
          cookies: cookies,
          createdAt: new Date(),
          userId: session.user.id
        } as Prisma.TwitterAccountUncheckedCreateInput
      });
    }

    return NextResponse.json({ 
      success: true, 
      account: twitterAccount 
    });
  } catch (error) {
    console.error('Failed to store cookies:', error);
    return NextResponse.json({ 
      error: 'Failed to store cookies',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // Get userId from URL params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Fetch accounts for specific userId
    const accounts = await prisma.twitterAccount.findMany({
      where: {
        userId: userId // This will match the MongoDB ObjectId from User collection
      },
      select: {
        id: true,
        cookies: true,
        createdAt: true,
        twitterAccountName: true
      }
    });

    // Extract info from cookies and format dates
    const accountsWithInfo = accounts.map((account) => {
      // Safely type cast cookies to any to handle the complex JSON structure
      const cookies = account.cookies as any[];
      const authToken = cookies?.find?.(c => c?.name === 'auth_token')?.value || null;
      
      // Safely handle the createdAt date
      let formattedDate;
      try {
        formattedDate = account.createdAt ? new Date(account.createdAt).toISOString() : new Date().toISOString();
      } catch (error) {
        console.error('Error formatting date:', error);
        formattedDate = new Date().toISOString();
      }
      
      return {
        id: account.id,
        authToken,
        twitterAccountName: account.twitterAccountName,
        createdAt: formattedDate,
        status: 'Active',
        cookies: cookies
      };
    });

    return NextResponse.json({ accounts: accountsWithInfo });
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
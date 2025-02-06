import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageSent, recipients } = await request.json();

    // Get user ID from email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        messageSent,
        userId: user.id,
        messages: recipients.map((recipientId: string) => ({
          recipientId,
          status: false // Initially set to false, will be updated when DM is sent
        }))
      }
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Failed to create message:', error);
    return NextResponse.json({ 
      error: 'Failed to create message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
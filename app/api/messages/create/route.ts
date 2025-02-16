import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { messageSent, recipients, campaignName, userId } = await request.json();

    const message = await prisma.message.create({
      data: {
        messageSent,
        campaignName,
        messages: recipients.map((recipientId: string) => ({
          recipientId,
          status: false
        })),
        userId
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
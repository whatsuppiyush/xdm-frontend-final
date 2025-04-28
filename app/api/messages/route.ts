import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ messages: [] });
    }

    const messages = await prisma.message.findMany({
      where: {
        userId: userId
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform messages to ensure proper JSON serialization
    const serializedMessages = messages.map(message => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));

    return NextResponse.json({ 
      messages: serializedMessages 
    });

  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ 
      messages: [],
      error: 'Failed to fetch messages' 
    });
  }
} 
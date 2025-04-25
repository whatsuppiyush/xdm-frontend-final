import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string) : 10;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page') as string) : 1;
    const skip = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json({ messages: [] });
    }

    // Get total count for pagination info
    const totalCount = await prisma.message.count({
      where: {
        userId: userId
      }
    });

    // Get paginated messages
    const messages = await prisma.message.findMany({
      where: {
        userId: userId
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: skip
    });

    // Transform messages to ensure proper JSON serialization
    const serializedMessages = messages.map(message => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));

    return NextResponse.json({ 
      messages: serializedMessages,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        current: page,
        limit
      }
    });

  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ 
      messages: [],
      error: 'Failed to fetch messages' 
    });
  }
} 
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ messages: [] });
    }

    // Pagination logic
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          userId: userId
        },
        include: {
          user: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.message.count({
        where: {
          userId: userId
        }
      })
    ]);

    // Transform messages to ensure proper JSON serialization
    const serializedMessages = messages.map(message => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));

    return NextResponse.json({ 
      messages: serializedMessages,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ 
      messages: [],
      error: 'Failed to fetch messages' 
    });
  }
} 
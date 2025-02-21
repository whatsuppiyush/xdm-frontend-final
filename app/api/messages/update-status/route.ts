import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { messageId, status } = await request.json();

    const updatedMessage = await prisma.message.update({
      where: {
        id: messageId
      },
      data: {
        status: status
      }
    });

    return NextResponse.json({ success: true, message: updatedMessage });
  } catch (error) {
    console.error('Failed to update message status:', error);
    return NextResponse.json({ 
      error: 'Failed to update message status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
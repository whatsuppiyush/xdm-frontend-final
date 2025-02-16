import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const leads = await prisma.automatedLead.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch leads',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
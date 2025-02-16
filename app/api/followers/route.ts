import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileUrl = searchParams.get('profileUrl');

    const where = profileUrl ? { profileUrl } : {};

    const followers = await prisma.follower.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ followers });
  } catch (error) {
    console.error('Failed to fetch followers:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch followers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
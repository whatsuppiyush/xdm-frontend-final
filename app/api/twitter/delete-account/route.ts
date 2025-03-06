import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }

    // Delete the Twitter account record
    await prisma.twitterAccount.delete({
      where: {
        id: id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete Twitter account:', error);
    return NextResponse.json({ 
      error: 'Failed to delete Twitter account',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
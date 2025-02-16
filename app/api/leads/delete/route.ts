import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    await prisma.automatedLead.delete({
      where: {
        id: id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete lead:', error);
    return NextResponse.json({ 
      error: 'Failed to delete lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
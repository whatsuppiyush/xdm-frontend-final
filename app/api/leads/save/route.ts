import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { leadName, followers, userId } = await request.json();

    const automatedLead = await prisma.automatedLead.create({
      data: {
        leadName,
        followers,
        totalLeads: followers.length,
        userId
      }
    });

    return NextResponse.json({ success: true, lead: automatedLead });
  } catch (error) {
    console.error('Failed to save leads:', error);
    return NextResponse.json({ 
      error: 'Failed to save leads',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
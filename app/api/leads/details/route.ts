import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    // First try to find in AutomatedLead table
    let leadDetails = await prisma.automatedLead.findUnique({
      where: {
        id: id
      },
      select: {
        id: true,
        leadName: true,
        followers: true
      }
    });

    // If not found in AutomatedLead, try PublicLeads
    if (!leadDetails) {
      leadDetails = await prisma.publicLeads.findUnique({
        where: {
          id: id
        },
        select: {
          id: true,
          leadName: true,
          followers: true
        }
      });
    }

    if (!leadDetails) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(leadDetails);
  } catch (error) {
    console.error('Failed to fetch lead details:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch lead details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
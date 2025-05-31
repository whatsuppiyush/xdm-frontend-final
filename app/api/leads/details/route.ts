import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log(`Fetching lead details for ID: ${id}`);

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

    console.log(`Found in AutomatedLead: ${leadDetails ? 'Yes' : 'No'}`);

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
      console.log(`Found in PublicLeads: ${leadDetails ? 'Yes' : 'No'}`);
    }

    if (!leadDetails) {
      console.log(`Lead not found with ID: ${id}`);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    console.log(`Returning lead details for ${leadDetails.leadName} with ${Array.isArray(leadDetails.followers) ? leadDetails.followers.length : 'unknown'} followers`);

    return NextResponse.json(leadDetails);
  } catch (error) {
    console.error('Failed to fetch lead details:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch lead details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { leadName, leads, userId } = await request.json();

    if (!leadName || !leads || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: leadName, leads, or userId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "Leads must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if lead name already exists for this user
    const existingLead = await prisma.automatedLead.findFirst({
      where: {
        leadName,
        userId
      }
    });

    if (existingLead) {
      return NextResponse.json(
        { error: "A lead list with this name already exists" },
        { status: 409 }
      );
    }

    // Validate and clean the leads data
    const validatedLeads = leads.map((lead: any) => ({
      id: lead.id || "",
      name: lead.name || "",
      username: lead.username || "",
      bio: lead.bio || "",
      followers: parseInt(lead.followers) || 0,
      following: parseInt(lead.following) || 0,
      canDM: lead.canDM !== false, // Default to true
      status: lead.status || "Active"
    }));

    // Create the lead list in the database
    const newLead = await prisma.automatedLead.create({
      data: {
        leadName,
        followers: validatedLeads,
        totalLeads: validatedLeads.length,
        userId
      }
    });

    return NextResponse.json({
      success: true,
      count: validatedLeads.length,
      leadId: newLead.id,
      message: `Successfully imported ${validatedLeads.length} leads`
    });

  } catch (error) {
    console.error("Error importing CSV leads:", error);
    return NextResponse.json(
      {
        error: "Failed to import leads",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 
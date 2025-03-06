import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get the user's credits
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId }
    });
    
    if (!userCredits) {
      return NextResponse.json({ 
        leadCredits: 0,
        dmCredits: 0,
        planType: null,
        subscriptionId: null
      });
    }
    
    return NextResponse.json(userCredits);
  } catch (error) {
    console.error("Error fetching user credits:", error);
    return NextResponse.json({ error: "Failed to fetch user credits" }, { status: 500 });
  }
} 
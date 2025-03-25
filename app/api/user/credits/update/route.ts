import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { userId, leadsCount } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!leadsCount || leadsCount <= 0) {
      return NextResponse.json({ error: "Valid leads count is required" }, { status: 400 });
    }

    // Get the user's current credits
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId }
    });

    if (!userCredits) {
      return NextResponse.json({ 
        error: "User credits not found",
        success: false
      }, { status: 404 });
    }

    // Check if user is on a free trial
    if (userCredits.isTrialActive) {
      // Check if trial has ended
      if (userCredits.trialEndDate && new Date() > new Date(userCredits.trialEndDate)) {
        return NextResponse.json({ 
          error: "Your free trial has ended. Please upgrade to continue using the service.",
          success: false,
          trialEnded: true,
          remainingCredits: userCredits.leadCredits
        }, { status: 403 });
      }
    }
    
    // Determine how many credits to deduct
    let creditsToDeduct = leadsCount;
    let wasLimited = false;
    
    // If user doesn't have enough credits, just reduce to zero
    if (userCredits.leadCredits < leadsCount) {
      creditsToDeduct = userCredits.leadCredits;
      wasLimited = true;
    }

    // Update the user's credits by reducing the lead credits
    const updatedCredits = await prisma.userCredits.update({
      where: { userId },
      data: {
        leadCredits: {
          decrement: creditsToDeduct
        },
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true,
      remainingCredits: updatedCredits.leadCredits,
      isTrialActive: updatedCredits.isTrialActive,
      isMonthly: updatedCredits.isMonthly,
      wasLimited
    });
  } catch (error) {
    console.error("Error updating user credits:", error);
    return NextResponse.json({ 
      error: "Failed to update user credits",
      success: false
    }, { status: 500 });
  }
} 
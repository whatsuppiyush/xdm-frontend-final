import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }
    
    const { twitterAccountName, cookies, userId } = await request.json();
    
    if (!twitterAccountName || !cookies || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Find the existing account to ensure it belongs to the user
    const existingAccount = await prisma.twitterAccount.findUnique({
      where: { id }
    });
    
    if (!existingAccount) {
      return NextResponse.json({ error: "Twitter account not found" }, { status: 404 });
    }
    
    if (existingAccount.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    // Update the account with new cookies
    const updatedAccount = await prisma.twitterAccount.update({
      where: { id },
      data: { 
        twitterAccountName,
        cookies
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      account: updatedAccount 
    });
    
  } catch (error) {
    console.error("Error updating Twitter account:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 
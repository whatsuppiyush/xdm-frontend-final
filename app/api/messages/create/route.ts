import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messageSent, variants, recipients, campaignName, userId } = body;

    if (!messageSent || !recipients || !campaignName || !userId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Create message record with variants
    const message = await db.insert(messages).values({
      messageSent,
      variants: variants || [], // Store variants array
      recipients,
      campaignName,
      userId,
      status: "In Progress",
      createdAt: new Date(),
    }).returning();

    return NextResponse.json({ message: message[0] });
  } catch (error) {
    console.error("[MESSAGES_CREATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Redis } from "@upstash/redis";
import { isFreeUser } from "../../../../workers/planLimits";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export async function POST(request: Request) {
  try {
    const { messageSent, recipients, campaignName, userId } = await request.json();

    if (!messageSent || !recipients || !campaignName || !userId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const userCredits = await prisma.userCredits.findUnique({ where: { userId } });

    // Create message record with nested items
    const message = await prisma.message.create({
      data: {
        messageSent,
        campaignName,
        messages: recipients.map((recipientId: string) => ({
          recipientId,
          status: false,
        })),
        userId,
      },
    });

    // Add to high_priority_campaigns if free user
    if (isFreeUser(userCredits?.planType)) {
      await redis.sadd('high_priority_campaigns', message.id);
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Failed to create message:", error);
    return NextResponse.json(
      {
        error: "Failed to create message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
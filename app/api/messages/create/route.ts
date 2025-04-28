import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Queue from 'bull';

export async function POST(request: Request) {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    throw new Error("UPSTASH_REDIS_URL environment variable is not set!");
  }
  // Use the same queue name and Redis URL as the worker
  const messageQueue = new Queue('message-queue', redisUrl);

  try {
    const { messageSent, recipients, campaignName, userId } = await request.json();

    if (!messageSent || !recipients || !campaignName || !userId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

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

    // Also add jobs to the Bull queue for each recipient
    for (const recipientId of recipients) {
      await messageQueue.add({
        recipientId,
        message: messageSent, // or customize per recipient if needed
        campaignId: message.id,
        userId,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000 // 1 minute
        }
      });
      console.log(`[QUEUE] Added job for recipient ${recipientId} in campaign ${message.id}`);
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
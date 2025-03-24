import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

export async function POST(request: Request) {
  try {
    const { messageId, status } = await request.json();

    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
    }

    // Update status in the database
    const updatedMessage = await prisma.message.update({
      where: {
        id: messageId
      },
      data: {
        status: status
      }
    });

    // Update only the status field in the Redis object
    const queueKey = `queue:${messageId}`;
    
    // Map database status to Redis status if needed
    let redisStatus = status;
    if (status === "In Progress") {
      redisStatus = "Running";
    }
    
    try {
      // Get the existing queue data from Redis
      const queueData = await redis.get(queueKey);
      
      if (queueData) {
        // Parse the Redis data (which is a string) into an object
        const queueObject = (typeof queueData === 'object' ? queueData : {}) as Record<string, any>;
        
        // Update only the status field
        queueObject['status'] = redisStatus;
        console.log("queueObject", queueObject.queue.length,queueObject.processedRecipients.length);
        
        // Save the updated object back to Redis
        await redis.set(queueKey, queueObject);
      }
    } catch (redisError) {
      console.error('Error updating Redis:', redisError);
      // Continue execution - database update was successful
    }

    return NextResponse.json({ success: true, message: updatedMessage });
  } catch (error) {
    console.error('Failed to update message status:', error);
    return NextResponse.json({ 
      error: 'Failed to update message status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
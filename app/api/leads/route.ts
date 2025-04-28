import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ leads: [] });
    }

    // Get leads from database
    const leads = await prisma.automatedLead.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Enhance leads with status from Redis
    const enhancedLeads = await Promise.all(leads.map(async (lead) => {
      const statusKey = `lead:${lead.id}:status`;
      const statusData = await redis.get(statusKey);
      
      let status = 'completed';
      let errorType = null;
      if (statusData) {
        try {
          // Check if statusData is already an object or needs parsing
          const parsedStatus = typeof statusData === 'object' 
            ? statusData 
            : JSON.parse(statusData.toString());
          
          status = parsedStatus.status || status;
          errorType = parsedStatus.errorType || null;
        } catch (e) {
          console.error('Error parsing status data:', e);
        }
      }
      
      return {
        ...lead,
        status,
        errorType,
        createdAt: lead.createdAt.toISOString()
      };
    }));

    return NextResponse.json({ leads: enhancedLeads });
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ 
      leads: [],
      error: 'Failed to fetch leads' 
    });
  }
} 
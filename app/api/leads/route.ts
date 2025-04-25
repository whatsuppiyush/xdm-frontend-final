import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json({ leads: [], total: 0, page, limit });
    }

    // Get total count for pagination info
    const totalCount = await prisma.automatedLead.count({
      where: {
        userId: userId
      }
    });

    // Get paginated leads from database
    const leads = await prisma.automatedLead.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
      select: {
        id: true,
        leadName: true,
        totalLeads: true,
        createdAt: true,
        userId: true
      }
    });

    // Prepare Redis keys for bulk fetching
    const statusKeys = leads.map(lead => `lead:${lead.id}:status`);
    
    // Use mget to fetch all statuses in a single Redis call
    const statusDataArray = statusKeys.length > 0 ? await redis.mget(...statusKeys) : [];
    
    // Enhance leads with status from Redis
    const enhancedLeads = leads.map((lead, index) => {
      const statusData = statusDataArray[index];
      
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
    });

    return NextResponse.json({ 
      leads: enhancedLeads,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ 
      leads: [],
      error: 'Failed to fetch leads',
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0
    });
  }
} 
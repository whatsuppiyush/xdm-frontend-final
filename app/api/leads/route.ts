import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const skip = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json({ leads: [], total: 0, page, totalPages: 0 });
    }

    const total = await prisma.automatedLead.count({
      where: { userId }
    });

    const leads = await prisma.automatedLead.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    const enhancedLeads = await Promise.all(leads.map(async (lead) => {
      const statusKey = `lead:${lead.id}:status`;
      const statusData = await redis.get(statusKey);
      let status = 'completed';
      let errorType = null;
      if (statusData) {
        try {
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

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({ leads: enhancedLeads, total, page, totalPages });
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ 
      leads: [],
      total: 0,
      page: 1,
      totalPages: 0,
      error: 'Failed to fetch leads' 
    });
  }
} 
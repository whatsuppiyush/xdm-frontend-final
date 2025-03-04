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

    // Check Redis for any in-progress scraping for these leads
    const leadsWithStatus = await Promise.all(leads.map(async (lead) => {
      // First try with the profile name from the lead name
      const profileName = lead.leadName.split('_')[0];
      let key = `scrape:https://x.com/${profileName}`;
      let status = await redis.get(key);
      
      // If no status found with that key, try with the lead ID
      if (!status) {
        key = `lead:${lead.id}:status`;
        status = await redis.get(key);
      }
      
      if (status) {
        const statusData = typeof status === 'string' ? JSON.parse(status) : status;
        console.log(`Lead ${lead.id} status: ${statusData.status}`);
        return {
          ...lead,
          status: statusData.status,
          createdAt: lead.createdAt.toISOString()
        };
      }
      
      return {
        ...lead,
        createdAt: lead.createdAt.toISOString()
      };
    }));

    return NextResponse.json({ leads: leadsWithStatus });
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ 
      leads: [],
      error: 'Failed to fetch leads' 
    });
  }
} 
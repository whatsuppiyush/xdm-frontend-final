import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { messageSent, recipients, campaignName, userId } = await request.json();

    const message = await prisma.message.create({
      data: {
        messageSent,
        campaignName,
        messages: recipients.map((recipientId: string) => ({
          recipientId,
          status: false
        })),
        userId
      }
    });

    // Check if this is the user's first campaign
    const userCampaignCount = await prisma.message.count({
      where: {
        userId
      }
    });

    // If this is the first campaign, send a notification email
    if (userCampaignCount === 1) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        await fetch(`${baseUrl}/api/send-campaign-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campaignName,
            recipientCount: recipients.length,
            userId
          }),
        });
      } catch (emailError) {
        console.error('Error sending campaign notification email:', emailError);
        // Continue with campaign creation even if email fails
      }
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Failed to create message:', error);
    return NextResponse.json({ 
      error: 'Failed to create message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
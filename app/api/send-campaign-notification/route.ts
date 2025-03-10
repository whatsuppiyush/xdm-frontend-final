import { CampaignLiveEmailTemplate } from '@/components/CampaignLiveEmailTemplate';
import { Resend } from 'resend';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

// Check for API key and provide better error handling
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not defined in the environment variables');
}

// Create the resend instance with proper key
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function POST(request: Request) {
  try {
    const { campaignName, recipientCount, userId } = await request.json();
    // as they are show in prisma schema 
    if (!campaignName || !recipientCount || !userId) {
      return Response.json({ error: 'Campaign name, recipient count, and user ID are required' }, { status: 400 });
    }

    // Get user information becuase link with user id
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.email) {
      return Response.json({ error: 'User not found or missing email' }, { status: 404 });
    }

    const firstName = user.name?.split(' ')[0] || 'User';

    // Check if resend is properly initialized
    if (!resend) {
      console.error('Resend client not initialized. Missing API key.');
      return Response.json({ 
        error: 'Email service not configured', 
        success: false 
      }, { status: 500 });
    }

    const { data, error } = await resend.emails.send({
      from: 'XAutoDM <hi@xcolddm.com>',
      to: [user.email],
      subject: `Your Campaign "${campaignName}" Is Now Live!`,
      react: CampaignLiveEmailTemplate({ 
        firstName, 
        campaignName, 
        recipientCount 
      }),
    });

    if (error) {
      console.error('Error sending campaign notification email:', error);
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error in campaign notification email API route:', error);
    return Response.json({ error: 'Failed to send campaign notification email' }, { status: 500 });
  }
} 
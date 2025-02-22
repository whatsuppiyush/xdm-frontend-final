import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const activeMessages = await prisma.message.findMany({
      where: { 
        status: 'In Progress'
      }
    });

    if (!activeMessages.length) {
      return res.status(200).json({ campaigns: [] });
    }

    const campaignProgress = activeMessages.map(message => ({
      id: message.id,
      messages: message.messages,
      status: message.status,
      processedCount: message.messages.filter(msg => msg.status === true).length,
      failedCount: message.messages.filter(msg => msg.status === false).length
    }));

    res.status(200).json({ campaigns: campaignProgress });
  } catch (error) {
    console.error('Error fetching campaigns progress:', error);
    res.status(500).json({ message: 'Failed to fetch campaigns progress' });
  }
} 
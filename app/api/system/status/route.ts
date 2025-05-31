import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Recommendation = { type: string; message: string };

export async function GET() {
  try {
    // Get total users and accounts
    const totalUsers = await prisma.user.count();
    const totalAccounts = await prisma.twitterAccount.count();
    
    // Get accounts per user
    const accountsPerUser = await prisma.twitterAccount.groupBy({
      by: ['userId'],
      _count: {
        id: true
      }
    });
    
    // Get recent leads (last 24 hours)
    const recentLeads = await prisma.automatedLead.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    
    // No status field in AutomatedLead, so set to 0
    const leadsInProgress = 0;
    const completedLeads = 0;
    
    // Calculate distribution stats
    const usersWithAccounts = accountsPerUser.length;
    const usersWithoutAccounts = totalUsers - usersWithAccounts;
    const avgAccountsPerUser = totalUsers > 0 ? totalAccounts / totalUsers : 0;
    
    const accountDistribution = accountsPerUser.reduce((acc, user) => {
      const count = user._count.id;
      acc[count] = (acc[count] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const status = {
      system: {
        totalUsers,
        totalAccounts,
        usersWithAccounts,
        usersWithoutAccounts,
        avgAccountsPerUser: Math.round(avgAccountsPerUser * 100) / 100
      },
      accounts: {
        distribution: accountDistribution,
        maxAccountsPerUser: Math.max(...accountsPerUser.map(u => u._count.id), 0),
        minAccountsPerUser: Math.min(...accountsPerUser.map(u => u._count.id), 0)
      },
      activity: {
        recentLeads24h: recentLeads,
        leadsInProgress,
        completedLeads,
        totalLeads: leadsInProgress + completedLeads
      },
      recommendations: [] as Recommendation[]
    };
    
    // Add recommendations based on system state
    if (totalAccounts < 10) {
      status.recommendations.push({
        type: 'warning',
        message: `Only ${totalAccounts} Twitter accounts in system. Consider adding more for better parallel processing.`
      });
    }
    
    if (usersWithoutAccounts > totalUsers * 0.5) {
      status.recommendations.push({
        type: 'info',
        message: `${usersWithoutAccounts} users don't have Twitter accounts. They'll use shared accounts.`
      });
    }
    
    if (leadsInProgress > totalAccounts * 2) {
      status.recommendations.push({
        type: 'warning',
        message: `${leadsInProgress} jobs in progress with only ${totalAccounts} accounts. Consider adding more accounts.`
      });
    }
    
    if (avgAccountsPerUser < 1) {
      status.recommendations.push({
        type: 'critical',
        message: 'Average accounts per user is less than 1. System may experience bottlenecks.'
      });
    }
    
    return NextResponse.json(status);
    
  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json(
      { error: 'Failed to get system status' },
      { status: 500 }
    );
  }
} 
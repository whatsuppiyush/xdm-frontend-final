import { NextResponse } from "next/server";
import { sendSlackMessage, formatSignupStatsMessage } from "@/lib/slackNotifications";
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function GET(request: Request) {
  try {
    // Verify the request using either header or query param
    const authHeader = request.headers.get('x-cron-secret');
    const { searchParams } = new URL(request.url);
    const authToken = searchParams.get('token');

    if (authHeader !== process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Running daily signup report for marketing Slack channel');

    // Initialize Google Sheets
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID || '1ZpmOsKRlwo342RyNZZ8vNKRwhJ6Zd1x3B0R0uG88xwk', serviceAccountAuth);
    await doc.loadInfo();
    
    // Get the first sheet
    const sheet = doc.sheetsById[0];
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
    
    // Count total users from Google Sheets
    const totalUsers = rows.length;

    // Set to start of day in IST (UTC+5:30)
    const now = new Date();
    const startOfToday = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    startOfToday.setHours(0, 0, 0, 0);
    
    // Convert back to UTC
    const startOfTodayUTC = new Date(startOfToday.toLocaleString('en-US', { timeZone: 'UTC' }));
    
    // Get yesterday's start in IST
    const startOfYesterday = new Date(startOfTodayUTC);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    console.log('Checking for new users between:', {
      startOfYesterday: startOfYesterday.toISOString(),
      startOfToday: startOfTodayUTC.toISOString(),
      now: now.toISOString()
    });

    // Count new users from Google Sheets
    const newUsers = rows.filter(row => {
      try {
        const signupDateStr = row.get('SignupDate');
        if (!signupDateStr) {
          console.log('No signup date for user:', row.get('Email'));
          return false;
        }

        const signupDate = new Date(signupDateStr);
        const isNewUser = signupDate >= startOfYesterday;
        
        if (isNewUser) {
          console.log('Found new user:', {
            email: row.get('Email'),
            name: row.get('Name'),
            signupDate: signupDate.toISOString()
          });
        }

        return isNewUser;
      } catch (error) {
        console.error('Error parsing date for row:', row.get('Email'), error);
        return false;
      }
    });

    // Format the date in IST
    const formattedDate = now.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Create stats object
    const stats = {
      totalUsers,
      newUsers: newUsers.length,
      date: formattedDate
    };

    // Format and send Slack message
    const message = formatSignupStatsMessage(stats);
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!slackWebhookUrl) {
      console.error('SLACK_WEBHOOK_URL environment variable is not set');
      return NextResponse.json({ 
        error: 'Slack webhook URL not configured',
        stats
      }, { status: 500 });
    }

    const slackResult = await sendSlackMessage(message, slackWebhookUrl);

    if (!slackResult) {
      return NextResponse.json({ 
        error: 'Failed to send Slack notification',
        stats
      }, { status: 500 });
    }

    console.log('Successfully sent daily signup report to marketing Slack channel');

    return NextResponse.json({
      success: true,
      stats,
      message: 'Daily signup report sent to marketing Slack channel'
    });
  } catch (error) {
    console.error('Error generating daily signup report:', error);
    return NextResponse.json({ error: 'Failed to generate daily signup report' }, { status: 500 });
  }
} 
/**
 * Utility functions for sending notifications to Slack
 */

/**
 * Send a message to a Slack channel using webhook
 * @param message The message to send
 * @param webhookUrl The Slack webhook URL
 */
export async function sendSlackMessage(message: string, webhookUrl: string = process.env.SLACK_WEBHOOK_URL || '') {
  if (!webhookUrl) {
    console.error('Slack webhook URL not configured');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return false;
  }
}

/**
 * Format a signup statistics message for Slack
 * @param stats Signup statistics object
 */
export function formatSignupStatsMessage(stats: {
  totalUsers: number;
  newUsers: number;
  date: string;
}): string {
  const dashboardUrl = 'https://docs.google.com/spreadsheets/d/1ZpmOsKRlwo342RyNZZ8vNKRwhJ6Zd1x3B0R0uG88xwk/edit?gid=0#gid=0';
  
  // Get current time in IST
  const istTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
  
  const message = [
    `*📊 Daily Signup Report - ${stats.date} (${istTime} IST)*`,
    '',
    '*📈 Statistics*',
    `• *Total Users:* ${stats.totalUsers}`,
    `• *New Users (Last 24h):* ${stats.newUsers}`,
    '',
    '*🔗 Marketing Dashboard*',
    `<${dashboardUrl}|*Click here to view detailed analytics* →>`
  ].join('\n');

  return message;
} 
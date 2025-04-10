// Cron job configuration
export const CRON_JOBS = {
  // Check cancelled subscriptions every 12 hours
  CHECK_CANCELLED_SUBSCRIPTIONS: {
    schedule: '0 */12 * * *', // At minute 0 past every 12th hour
    endpoint: '/api/cron/check-cancelled-subscriptions',
    description: 'Checks and processes cancelled subscriptions (both trial and regular) every 12 hours',
    // For Render cron job:
    // curl -X GET "https://your-app.onrender.com/api/cron/check-cancelled-subscriptions" -H "x-cron-secret: your-secret"
  },
  
  // Send daily signup report to marketing Slack channel at 9:00 AM IST (3:30 AM UTC)
  DAILY_SIGNUP_REPORT: {
    schedule: '30 3 * * *', // At 3:30 AM UTC = 9:00 AM IST
    endpoint: '/api/cron/daily-signup-report',
    description: 'Sends daily signup statistics to the marketing Slack channel at 9:00 AM IST',
    // For Render cron job:
    // curl -X GET "https://your-app.onrender.com/api/cron/daily-signup-report" -H "x-cron-secret: your-secret"
  }
};

// Cron secret for authentication
export const CRON_SECRET = process.env.CRON_SECRET;

// Error messages
export const ERRORS = {
  UNAUTHORIZED: 'Unauthorized cron job request',
  INTERNAL_ERROR: 'Internal server error in cron job',
  MISSING_ENV_VARS: 'Missing required environment variables',
  SLACK_WEBHOOK_ERROR: 'Failed to send Slack notification'
}; 
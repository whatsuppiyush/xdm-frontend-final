// Cron job configuration
export const CRON_JOBS = {
  // Check cancelled subscriptions every 12 hours
  CHECK_CANCELLED_SUBSCRIPTIONS: {
    schedule: '0 */12 * * *', // At minute 0 past every 12th hour
    endpoint: '/api/cron/check-cancelled-subscriptions',
    description: 'Checks and processes cancelled subscriptions (both trial and regular) every 12 hours'
  }
};

// Cron secret for authentication
export const CRON_SECRET = process.env.CRON_SECRET;

// Error messages
export const ERRORS = {
  UNAUTHORIZED: 'Unauthorized cron job request',
  INTERNAL_ERROR: 'Internal server error in cron job'
}; 
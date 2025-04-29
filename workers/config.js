const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const prisma = new PrismaClient();
const MAX_RETRIES = 2;

// Utility functions
function getUserDailyMessageLimit(userCredits, defaultLimit = 50) {
  if (!userCredits) {
    return defaultLimit;
  }
  
  const { planType } = userCredits;
  
  switch(planType) {
    case 'Starter': return 450;
    case 'Growth': return 1250;
    case 'Elite': return 2250;
    case 'free': return 50;
    default: return defaultLimit;
  }
}

function getEnvironmentAdjustedLimit(limit) {
  if (process.env.NODE_ENV === 'development') {
    return 25;
  }
  return limit;
}

// Message transform function
function messageTransformFunction(message, recipient) {
  let transformedMessage = message.replace("{name}", recipient.name ? recipient.name.split(" ")[0] : "");
  transformedMessage = transformedMessage.replace("{username}", recipient.username ? recipient.username : "");
  transformedMessage = transformedMessage.replace("{url}", recipient.url ? recipient.url : "");
  transformedMessage = transformedMessage.replace("{bio}", recipient.bio ? recipient.bio : "");
  transformedMessage = transformedMessage.replace("{followers}", recipient.followers ? recipient.followers : "");
  transformedMessage = transformedMessage.replace("{following}", recipient.following ? recipient.following : "");
  return transformedMessage;
}

module.exports = {
  redis,
  prisma,
  MAX_RETRIES,
  getUserDailyMessageLimit,
  getEnvironmentAdjustedLimit,
  messageTransformFunction
}; 
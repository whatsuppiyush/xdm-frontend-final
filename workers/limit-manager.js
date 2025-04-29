const { redis, prisma, getUserDailyMessageLimit, getEnvironmentAdjustedLimit } = require('./config');

// Daily limit check function
async function checkDailyLimit(userId) {
  if (!userId) {
    console.error("userId is undefined in checkDailyLimit");
    return { canSend: false };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
  
  const currentCount = await redis.get(dailyLimitKey);
  const parsedCount = currentCount ? parseInt(currentCount) : 0;
  
  const userCredits = await prisma.userCredits.findUnique({
    where: { userId }
  });
  
  const userLimit = getUserDailyMessageLimit(userCredits);
  const effectiveLimit = getEnvironmentAdjustedLimit(userLimit);
  
  return {
    canSend: parsedCount < effectiveLimit,
    currentCount: parsedCount
  };
}

// Increment daily limit function
async function incrementDailyLimit(userId) {
  if (!userId) {
    console.error("userId is undefined in incrementDailyLimit");
    return { success: false };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
  
  const newCount = await redis.incr(dailyLimitKey);
  
  if (newCount === 1) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const secondsUntilMidnight = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
    await redis.expire(dailyLimitKey, secondsUntilMidnight);
  }
  
  return {
    success: true,
    currentCount: newCount
  };
}

module.exports = {
  checkDailyLimit,
  incrementDailyLimit
}; 
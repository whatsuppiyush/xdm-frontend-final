const DAILY_MESSAGE_LIMIT = 450;

function calculateDailyMessageLimit(planType, quantity = 1) {
  let limit = DAILY_MESSAGE_LIMIT;
  if (planType) {
    if (planType === "Starter") {
      limit = DAILY_MESSAGE_LIMIT;
    } else if (planType === "Growth") {
      limit = DAILY_MESSAGE_LIMIT * 3;
    } else if (planType === "Elite") {
      limit = DAILY_MESSAGE_LIMIT * 5;
    } else if (planType === "free") {
      limit = 0;
    }
  }
  return limit;
}

function getUserDailyMessageLimit(userCredits, defaultLimit = 0) {
  if (!userCredits) return defaultLimit;
  const { planType, quantity } = userCredits;
  return calculateDailyMessageLimit(planType, quantity);
}

function getEnvironmentAdjustedLimit(limit) {
  if (process.env.NODE_ENV === 'development') return 25;
  return limit;
}

function isFreeUser(planType) {
  return planType === 'free';
}

module.exports = {
  DAILY_MESSAGE_LIMIT,
  calculateDailyMessageLimit,
  getUserDailyMessageLimit,
  getEnvironmentAdjustedLimit,
  isFreeUser
}; 
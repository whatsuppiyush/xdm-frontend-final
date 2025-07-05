import { DAILY_MESSAGE_LIMIT } from "@/lib/constants";

export function calculateDailyMessageLimit(planType: string | null, quantity: number = 1): number {
  // Default limit
  let limit = DAILY_MESSAGE_LIMIT;
  
  if (planType) {
    if (planType === "Starter") {
      limit = DAILY_MESSAGE_LIMIT;
    } else if (planType === "Growth") {
      limit = DAILY_MESSAGE_LIMIT * 3; // Fixed 3x multiplier for Growth plan
    } else if (planType === "Elite") {
      limit = DAILY_MESSAGE_LIMIT * 5; // Fixed 5x multiplier for Elite plan
    } else if (planType === "free") {
      limit = 0; // Free plan gets 10 messages per day
    }
  }
  
  return limit;
}


export function getUserDailyMessageLimit(userCredits: any, defaultLimit: number = 0): number {
  if (!userCredits) {
    return defaultLimit;
  }
  
  const { planType, quantity } = userCredits;
  return calculateDailyMessageLimit(planType, quantity);
}


export function getEnvironmentAdjustedLimit(limit: number): number {
  if (process.env.NODE_ENV === 'development') {
    return 25; // Lower limit for development
  }
  return limit;
} 
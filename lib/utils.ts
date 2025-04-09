import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import prisma from './prisma';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function setupNewUser(userId: string) {
  try {
    await prisma.userCredits.create({
      data: {
        userId,
        leadCredits: 2000,
        planType: "free",
        isMonthly: false,
        quantity: 1,
        isTrialActive: false,
        hadPreviousTrial: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
    console.log(`Successfully created credits for new user: ${userId}`);
    return true;
  } catch (error) {
    console.error('Error setting up new user credits:', error);
    return false;
  }
}

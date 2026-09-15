import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

// @ts-ignore
const prisma = new PrismaClient();

export async function checkCreditsAndSubscription(requiredCredits: number = 1) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    // Bypass auth for personal tool usage on Vercel
    return { success: true, userId: "dev-user", user: { id: "dev-user", credits: 9999 } };
  }

  // @ts-ignore
  const userId = session.user.id;
  
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return { success: false, status: 401, error: "User not found" };
  }

  const now = new Date();
  
  // Check if subscription is valid
  const hasValidSubscription = user.subscriptionEnd && user.subscriptionEnd > now;
  
  // Check if user has enough credits
  const hasEnoughCredits = user.credits >= requiredCredits;

  if (!hasValidSubscription && !hasEnoughCredits) {
    return { 
      success: false, 
      status: 403, 
      error: "You have no remaining credits and your subscription has expired. Please contact admin to recharge." 
    };
  }

  return { success: true, userId: user.id, user };
}

export async function deductCredits(userId: string, amount: number = 1) {
  if (userId === "dev-user") return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: { decrement: amount }
    }
  });
}

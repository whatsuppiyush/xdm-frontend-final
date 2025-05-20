// File: app/api/auth/[...nextauth]/authOptions.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { ObjectId } from 'mongodb';
import { pushUserToGoogleSheet } from '@/lib/googleSheets';
import { pushUserToInstantly } from '@/lib/instantlyApi';
import { pushUserToBeehiiv } from '@/lib/beehiivApi';
import { setupNewUser } from '@/lib/utils';

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string;
      planType?: string | null;
    }
  }
}

// Queue for processing non-critical operations after login completes
type QueuedOperation = () => Promise<void>;
const operationQueue: QueuedOperation[] = [];

// Process operations in the background
const processQueue = async () => {
  if (operationQueue.length === 0) return;
  
  console.log(`Processing ${operationQueue.length} queued operations`);
  
  // Take the first operation and process it
  const operation = operationQueue.shift();
  if (operation) {
    try {
      await operation();
    } catch (error) {
      console.error('Error processing queued operation:', error);
    }
    
    // Process the next operation with a small delay to prevent resource contention
    setTimeout(processQueue, 100);
  }
};

// Add operation to queue and trigger processing if not already running
const queueOperation = (operation: QueuedOperation) => {
  operationQueue.push(operation);
  
  // Start processing if this is the only item
  if (operationQueue.length === 1) {
    processQueue();
  }
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          provider: 'credentials'
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user?.email) {
        return false;
      }

      try {
        if (account?.provider === 'google') {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          });

          if (existingUser) {
            // Update the user's provider if they're signing in with Google
            await prisma.user.update({
              where: { email: user.email },
              data: {
                provider: 'google',
                image: user.image,
                updatedAt: new Date(),
              },
            });
            
            // If this is the first time the user is logging in with Google (previously used credentials)
            if (existingUser.provider !== 'google') {
              // Queue external API operations instead of awaiting them
              queueOperation(async () => {
                try {
                  await pushUserToGoogleSheet({
                    email: user.email || '',
                    name: user.name || '',
                    provider: 'google'
                  });
                } catch (error) {
                  console.error('Error pushing converted user data to Google Sheet:', error);
                }
              });
              
              queueOperation(async () => {
                try {
                  await pushUserToInstantly({
                    email: user.email || '',
                    name: user.name || ''
                  });
                } catch (error) {
                  console.error('Error pushing converted user data to Instantly.ai:', error);
                }
              });
              
              queueOperation(async () => {
                try {
                  await pushUserToBeehiiv({
                    email: user.email || '',
                    name: user.name || '',
                    provider: 'google'
                  });
                } catch (error) {
                  console.error('Error pushing converted user data to Beehiiv:', error);
                }
              });
            }
            
            return true;
          }

          // Create new user with MongoDB ObjectId
          const newUser = await prisma.user.create({
            data: {
              id: new ObjectId().toString(),
              email: user.email,
              name: user.name || '',
              image: user.image,
              provider: 'google',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          
          // Setup initial credits for new user - this is critical, so we await it
          await setupNewUser(newUser.id);

          // Queue welcome email and external API integrations
          queueOperation(async () => {
            try {
              await fetch(`${process.env.NEXTAUTH_URL}/api/send`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  firstName: user.name?.split(' ')[0] || 'User',
                  email: user.email || '',
                }),
              });
            } catch (error) {
              console.error('Error sending welcome email:', error);
            }
          });
          
          // Batch all external API calls into a single queued operation to reduce overhead
          queueOperation(async () => {
            const promises = [
              pushUserToGoogleSheet({
                email: user.email || '',
                name: user.name || '',
                provider: 'google'
              }).catch(error => console.error('Error pushing Google user data to Google Sheet:', error)),
              
              pushUserToInstantly({
                email: user.email || '',
                name: user.name || ''
              }).catch(error => console.error('Error pushing Google user data to Instantly.ai:', error)),
              
              pushUserToBeehiiv({
                email: user.email || '',
                name: user.name || '',
                provider: 'google'
              }).catch(error => console.error('Error pushing Google user data to Beehiiv:', error))
            ];
            
            // Run all in parallel but don't fail if one fails
            await Promise.allSettled(promises);
          });

          return true;
        }
        return true;
      } catch (error) {
        console.error("Sign-in error:", error);
        return false;
      }
    },
    async jwt({ token, user, account, trigger }) {
      if (trigger === 'signIn' && user && user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email }
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.provider = dbUser.provider;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        const dbUser = await prisma.user.findFirst({
          where: { id: token.id as string }
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.provider = dbUser.provider || 'google';
          session.user.email = dbUser.email;
          session.user.name = dbUser.name || null;
          session.user.image = dbUser.image || null;

          // Fetch userCredits to get planType
          const userCredits = await prisma.userCredits.findUnique({
            where: { userId: dbUser.id }
          });
          session.user.planType = userCredits?.planType || null;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/?error=AuthError',
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
};

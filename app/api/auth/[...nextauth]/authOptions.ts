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

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string;
    }
  }
}

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
              try {
                await pushUserToGoogleSheet({
                  email: user.email,
                  name: user.name,
                  provider: 'google (converted from credentials)'
                });
              } catch (sheetError) {
                console.error('Error pushing converted user data to Google Sheet:', sheetError);
                // Continue with sign-in even if Google Sheet push fails
              }
              
              // Also push to Instantly.ai when user converts from credentials to Google
              try {
                await pushUserToInstantly({
                  email: user.email,
                  name: user.name
                });
              } catch (instantlyError) {
                console.error('Error pushing converted user data to Instantly.ai:', instantlyError);
                // Continue with sign-in even if Instantly.ai push fails
              }
              
              // Also push to Beehiiv when user converts from credentials to Google
              try {
                await pushUserToBeehiiv({
                  email: user.email,
                  name: user.name,
                  provider: 'google (converted from credentials)'
                });
              } catch (beehiivError) {
                console.error('Error pushing converted user data to Beehiiv:', beehiivError);
                // Continue with sign-in even if Beehiiv push fails
              }
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

          // Send welcome email for new Google sign-ups
          try {
            await fetch(`${process.env.NEXTAUTH_URL}/api/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                firstName: user.name?.split(' ')[0] || 'User',
                email: user.email,
              }),
            });
          } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            // Continue with sign-in even if email fails
          }
          
          // Push new Google user data to Google Sheet
          try {
            await pushUserToGoogleSheet({
              email: user.email,
              name: user.name,
              provider: 'google'
            });
          } catch (sheetError) {
            console.error('Error pushing Google user data to Google Sheet:', sheetError);
            // Continue with sign-in even if Google Sheet push fails
          }
          
          // Push new Google user data to Instantly.ai
          try {
            await pushUserToInstantly({
              email: user.email,
              name: user.name
            });
          } catch (instantlyError) {
            console.error('Error pushing Google user data to Instantly.ai:', instantlyError);
            // Continue with sign-in even if Instantly.ai push fails
          }
          
          // Push new Google user data to Beehiiv
          try {
            await pushUserToBeehiiv({
              email: user.email,
              name: user.name,
              provider: 'google'
            });
          } catch (beehiivError) {
            console.error('Error pushing Google user data to Beehiiv:', beehiivError);
            // Continue with sign-in even if Beehiiv push fails
          }

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

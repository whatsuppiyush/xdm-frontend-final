// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";

export const authOptions = {
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub;
      return session;
    },
  },
};

export default NextAuth(authOptions);

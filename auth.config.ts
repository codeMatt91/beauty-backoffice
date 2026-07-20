import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.firstName = (user as any).firstName;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.lastName = (user as any).lastName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = token.role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).firstName = token.firstName;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).lastName = token.lastName;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

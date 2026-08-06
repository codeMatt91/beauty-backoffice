import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { SessionUser } from "@/types";
import { authConfig } from "@/auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as any,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      // Backfills fields added to the token after a session was already issued
      // (e.g. firstName/lastName), so pre-existing logged-in users self-heal
      // on their next request instead of crashing on undefined access.
      // Edge middleware can't do this (no DB access there), so it runs here,
      // in the Node-runtime auth() used by Server Components/Actions.
      if (!(token as any).firstName && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
        });
        if (dbUser) {
          token.id = dbUser.id;
          (token as any).firstName = dbUser.firstName;
          (token as any).lastName = dbUser.lastName;
          (token as any).role = dbUser.role;
        }
      }
      return token;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!passwordMatch) return null;

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});

export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new Error("Non autenticato");
  return session.user as unknown as SessionUser;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Accesso non autorizzato");
  return user;
}

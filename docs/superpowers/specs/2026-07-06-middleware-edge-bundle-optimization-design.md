# Middleware Edge Bundle Optimization — Design Spec

**Date:** 2026-07-06  
**Status:** Approved  
**Scope:** Ridurre il bundle dell'Edge Function `middleware` da 1.03 MB a < 1 MB separando la configurazione JWT-only da quella completa di NextAuth.

---

## Problema

`middleware.ts` importa `auth` da `lib/auth.ts`, che trascina nell'Edge bundle l'intera catena:

- `@prisma/client` — ORM non Edge-compatible (~700 KB)
- `bcryptjs` — hashing password (~200 KB)
- `@auth/prisma-adapter` — adapter database
- `next-auth` completo con providers

Il middleware ha bisogno esclusivamente di verificare e leggere il JWT (id, role). Non fa mai query al database né hasha password. Il risultato è un bundle da 1.03 MB che supera il limite di 1 MB del piano Vercel Hobby.

---

## Soluzione: Split Auth Config

Pattern ufficiale NextAuth v5 per Edge compatibility: separare la configurazione "JWT-only" (Edge-safe) da quella completa (Node.js only).

---

## Architettura

### File nuovo: `auth.config.ts` (root del progetto)

Contiene esclusivamente il nucleo JWT di NextAuth:

```ts
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

**Import di runtime:** nessuno oltre a `next-auth` (solo il tipo `NextAuthConfig`, erased a compile time).  
**Edge-safe:** sì — nessun accesso a DB, nessun import di Prisma/bcrypt.

---

### File modificato: `lib/auth.ts`

Importa `authConfig` e lo estende con adapter e provider:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { authConfig } from "../auth.config";
import type { SessionUser } from "@/types";

// ... loginSchema invariato ...

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    Credentials({
      async authorize(credentials) {
        // ... logica invariata ...
      },
    }),
  ],
});

export async function requireAuth(): Promise<SessionUser> { /* invariato */ }
export async function requireAdmin(): Promise<SessionUser> { /* invariato */ }
```

I callbacks `jwt` e `session` vengono da `authConfig` via spread — non vengono ridefiniti.

---

### File modificato: `middleware.ts`

Sostituisce l'import pesante con un'istanza NextAuth leggera:

```ts
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/login"];
const ADMIN_ONLY_ROUTES = ["/finance", "/employees", "/settings"];

export default auth((req: NextRequest & { auth: any }) => {
  // ... logica di routing invariata ...
});

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

**Differenza chiave:** `NextAuth(authConfig)` — istanza separata con solo la config leggera. `lib/auth.ts` non viene più importato dal middleware.

---

## Impatto sul bundle

| Cosa rimosso dal bundle Edge | Risparmio stimato |
|---|---|
| `@prisma/client` | ~700 KB |
| `bcryptjs` | ~200 KB |
| `@auth/prisma-adapter` | ~50 KB |

Il bundle middleware atteso dopo la modifica: < 200 KB.

---

## Sicurezza

- Il JWT è firmato con `AUTH_SECRET` — la verifica avviene tramite lo stesso secret in entrambe le istanze NextAuth.
- I callbacks `jwt`/`session` sono identici in entrambe le istanze (condivisi via spread da `authConfig`).
- Le redirect di sicurezza (login guard, admin guard) restano nel middleware e sono invariate.
- `requireAuth()` e `requireAdmin()` nelle Server Actions usano ancora `lib/auth.ts` completo — invariati.

---

## Fuori scope

- Modifica alla logica di routing del middleware
- Modifica ai callbacks JWT/session
- Aggiunta di nuovi provider di autenticazione
- Modifica alle Server Actions o API routes

---

## File toccati

| File | Azione |
|---|---|
| `auth.config.ts` | Crea (nuovo) |
| `lib/auth.ts` | Modifica — aggiungi import di authConfig, rimuovi callbacks duplicati |
| `middleware.ts` | Modifica — sostituisci import auth con istanza NextAuth leggera |

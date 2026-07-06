# Middleware Edge Bundle Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridurre il bundle dell'Edge Function `middleware` sotto 1 MB separando la configurazione JWT-only da quella completa di NextAuth.

**Architecture:** Si crea `auth.config.ts` (root) con solo la config JWT — nessun import di Prisma/bcrypt, Edge-safe. `lib/auth.ts` importa `authConfig` e lo estende con adapter e Credentials provider. `middleware.ts` crea un'istanza NextAuth leggera da `authConfig` invece di importare da `lib/auth.ts`.

**Tech Stack:** Next.js 15 App Router, NextAuth v5 beta, TypeScript.

## Global Constraints

- `auth.config.ts` non deve contenere import runtime di `@prisma/client`, `bcryptjs`, `@auth/prisma-adapter` — nemmeno come re-export. Solo `import type` è consentito.
- La logica di routing in `middleware.ts` (PUBLIC_ROUTES, ADMIN_ONLY_ROUTES, redirect) deve restare identica all'originale.
- I callbacks `jwt` e `session` in `auth.config.ts` devono leggere/scrivere `token.id` e `token.role` esattamente come nell'originale `lib/auth.ts`.
- `requireAuth()` e `requireAdmin()` in `lib/auth.ts` devono restare invariate come funzioni esportate.
- `npx tsc --noEmit` deve passare con zero errori dopo ogni task.

---

## File Structure

| File | Azione | Responsabilità |
|---|---|---|
| `auth.config.ts` | Crea (root) | Config JWT-only, Edge-safe |
| `lib/auth.ts` | Modifica | Spreads authConfig + aggiunge adapter/provider |
| `middleware.ts` | Modifica | Usa istanza NextAuth leggera da authConfig |

---

### Task 1: Crea `auth.config.ts` e aggiorna `lib/auth.ts`

**Files:**
- Create: `auth.config.ts`
- Modify: `lib/auth.ts`

**Interfaces:**
- Produces: `authConfig` — oggetto `NextAuthConfig` con `session`, `pages`, `providers: []`, `callbacks.jwt`, `callbacks.session`. Consumato da Task 2 (`middleware.ts`) e da `lib/auth.ts` in questo stesso task.

- [ ] **Step 1: Crea `auth.config.ts`**

Crea il file alla root del progetto con questo contenuto esatto:

```ts
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 2: Verifica che `auth.config.ts` non importa moduli pesanti**

```bash
grep -E "^import " auth.config.ts
```

Expected output: una sola riga — `import type { NextAuthConfig } from "next-auth";`
Qualsiasi altra riga di import è un errore.

- [ ] **Step 3: Sostituisci `lib/auth.ts` con la versione che usa `authConfig`**

Riscrivi `lib/auth.ts` con questo contenuto esatto (nota: rimosso `import { Role } from "@prisma/client"` perché i callbacks sono ora in `authConfig`):

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { SessionUser } from "@/types";
import { authConfig } from "../auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as any,
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
          name: user.name,
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
```

- [ ] **Step 4: Verifica TypeScript**

```bash
npx tsc --noEmit
```

Expected: nessun output, exit code 0.
Se ci sono errori di tipo, correggili prima di procedere.

- [ ] **Step 5: Commit**

```bash
git add auth.config.ts lib/auth.ts
git commit -m "refactor: extract JWT-only auth config for Edge middleware"
```

---

### Task 2: Aggiorna `middleware.ts` e verifica build

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `authConfig` da `./auth.config` (prodotto in Task 1)

- [ ] **Step 1: Riscrivi `middleware.ts`**

Sostituisci il contenuto del file con:

```ts
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/login"];
const ADMIN_ONLY_ROUTES = ["/finance", "/employees", "/settings"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default auth((req: NextRequest & { auth: any }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Rotta pubblica – lascia passare
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session) {
      return NextResponse.redirect(new URL("/calendar", req.url));
    }
    return NextResponse.next();
  }

  // Utente non autenticato
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Rotte riservate agli Admin
  if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session.user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/calendar", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

- [ ] **Step 2: Verifica che `middleware.ts` non importa `lib/auth`**

```bash
grep "lib/auth" middleware.ts
```

Expected: nessun output. Se appare qualcosa, il file è stato scritto male.

- [ ] **Step 3: Verifica TypeScript**

```bash
npx tsc --noEmit
```

Expected: nessun output, exit code 0.

- [ ] **Step 4: Verifica build locale**

```bash
npm run build 2>&1 | grep -E "Middleware|error|Error"
```

Expected: la riga `Middleware` appare senza errori. La build deve completarsi con successo.
Il bundle locale mostrato da Next.js è compresso — la dimensione reale (uncompressed) su Vercel sarà visibile solo al deploy. Se la build passa senza l'errore `Edge Function size`, il fix è corretto.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts
git commit -m "fix: use lightweight auth config in middleware to reduce Edge bundle size"
```

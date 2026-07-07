---
name: vercel-env-var-name-mismatch
description: schema.prisma expects POSTGRES_PRISMA_URL but Vercel integration injects PRISMA_DATABASE_URL/POSTGRES_URL — deploy gotcha
metadata:
  type: project
---

`prisma/schema.prisma` uses `env("POSTGRES_PRISMA_URL")` (url) and `env("POSTGRES_URL_NON_POOLING")` (directUrl). But `.env.local` (produced by `vercel env pull`) provides `PRISMA_DATABASE_URL` and `POSTGRES_URL` instead — different names. Local dev works only because `.env` (manually authored, gitignored, NOT deployed) supplies the `POSTGRES_PRISMA_URL` name and Next merges both files.

**Why:** On Vercel neither `.env` nor `.env.local` is deployed; production env comes from the Vercel dashboard/Storage integration, which uses the `PRISMA_DATABASE_URL`/`POSTGRES_URL` naming. Result: `PrismaClientInitializationError: Environment variable not found: POSTGRES_PRISMA_URL` in production (calendar page and every Prisma query).

**How to apply:** When a Prisma "env var not found" appears only in production, it's a name mismatch, not a missing DB. Fix by either adding `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` in the Vercel dashboard, or aligning schema.prisma to the names Vercel injects. Note `PRISMA_DATABASE_URL` may be a `prisma+postgres://` Accelerate URL (not a plain pooled PG string), so don't blindly swap — verify the scheme.

Related: NextAuth env `NEXTAUTH_URL` is present in their env files; a stale/wrong value on Vercel (localhost or old domain) is a prime suspect for the production redirect loop, since the Edge middleware (root `auth.config.ts`, slim JWT-only config, no Prisma) bounces to /login whenever it can't verify the session cookie. See [[anti-patterns]].

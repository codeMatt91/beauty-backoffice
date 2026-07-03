# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech constraints

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React LTS + Tailwind CSS | No external component libraries beyond Radix UI already in use |
| Backend | Next.js 15 App Router | Server Actions preferred over API Routes for data mutations |
| Database | Vercel Postgres (free tier) | Stay within free-tier limits: 256 MB storage, 60 compute hours/month |

## Security rules

- Any operation that reads or writes sensitive data (user credentials, personal customer data, financial figures, WhatsApp tokens) **must run server-side** — either as a Server Action (`"use server"`) or in an API Route handler. Never expose these in Client Components or pass them through props.
- All Server Actions must call `requireAuth()` before touching the database.
- Admin-only operations must additionally verify `session.user.role === "ADMIN"`.
- The `CRON_SECRET` header check in cron routes must never be removed.

## Naming conventions

- **Variables and functions:** camelCase (`getUserById`, `appointmentList`)
- **React components and TypeScript types/interfaces:** PascalCase (`AppointmentModal`, `CustomerWithStats`)
- **Files:** camelCase for utilities and actions (`lib/whatsapp.ts`, `actions/appointments.ts`); PascalCase for component files (`CalendarView.tsx`)
- **Database columns:** snake_case via Prisma `@map` — do not deviate from this pattern
- **Prisma model fields:** camelCase in TypeScript, mapped to snake_case in the DB

## Commands

```bash
npm run dev          # Start dev server (Next.js)
npm run build        # Production build
npm run lint         # ESLint

npm run db:push      # Push schema changes to DB (no migration history)
npm run db:migrate   # Create and apply a migration
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed the database (tsx prisma/seed.ts)
```

## Architecture

**Stack:** Next.js 15 (App Router) · Next-Auth v5 beta (JWT sessions) · Prisma 6 · Vercel Postgres (serverless PG) · Tailwind CSS · Radix UI

### Route groups

- `app/(auth)/` — unauthenticated routes (`/login`)
- `app/(dashboard)/` — all protected routes; layout enforces auth and renders Sidebar + MobileNav
- `app/api/cron/` — cron endpoints (not protected by session; use `CRON_SECRET` header instead)
- `app/api/purge/` — data archiving endpoint (ADMIN only)

The root dashboard route (`/`) immediately redirects to `/calendar`.

### Auth & roles

`lib/auth.ts` configures NextAuth with a Credentials provider (email + bcrypt password). The JWT callback embeds `id` and `role` into the token; the session callback re-exposes them on `session.user`.

`middleware.ts` enforces:
- Unauthenticated users → redirect to `/login`
- `/finance`, `/employees`, `/settings` → ADMIN role only; others redirected to `/calendar`

### Server Actions

All data mutations are Next.js Server Actions in `actions/`. Each action calls `requireAuth()` (throws if no session) and validates input with Zod before hitting Prisma. Mutating actions call `revalidatePath` to bust the Next.js cache.

### Data models

| Model | Purpose |
|---|---|
| `User` | Staff accounts with `ADMIN` / `EMPLOYEE` role |
| `Customer` | Client registry |
| `Appointment` | Booking linking customer + optional employee |
| `MonthlyExpense` | Operating expenses by `ExpenseCategory` |
| `PurgeArchive` | Audit log of data-purge operations |

`Appointment.price` is a Prisma `Decimal` — serialized as a string in `AppointmentWithRelations` in `types/index.ts`.

### WhatsApp reminders

`lib/whatsapp.ts` supports two providers switchable via the `WHATSAPP_PROVIDER` env var (`"twilio"` default, or `"meta"`). The cron job at `app/api/cron/whatsapp-reminder/route.ts` fires daily at 09:00 UTC (configured in `vercel.json`) and sends next-day appointment reminders. It requires `Authorization: Bearer <CRON_SECRET>` on both GET and POST.

### Data purge

`lib/purge.ts` exports appointments older than N months to a ZIP-compressed JSON archive, records the operation in `PurgeArchive`, then deletes the source rows. The `app/api/purge/route.ts` endpoint triggers this; only ADMINs can call it.

## Required environment variables

```
# Database (Vercel Postgres)
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Auth
AUTH_SECRET=           # or NEXTAUTH_SECRET

# WhatsApp – Twilio (default)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=  # e.g. "whatsapp:+14155238886"

# WhatsApp – Meta (alternative, set WHATSAPP_PROVIDER=meta)
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=
WHATSAPP_PROVIDER=     # "twilio" | "meta"

# Cron
CRON_SECRET=
```

## Claude Code skills

Use these skills in the situations described:

| Skill | When to invoke |
|---|---|
| `/run` | After adding or changing any UI feature — start the dev server and visually verify the golden path |
| `/verify` | Before considering a task complete: confirm the change works in the running app, not just in the editor |
| `/code-review` | Before committing non-trivial changes; catches bugs and simplification opportunities |
| `/security-review` | Any time auth, role checks, env vars, or Prisma queries change |
| `/simplify` | After a feature is working but the code feels verbose |

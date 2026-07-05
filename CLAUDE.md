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

## Frontend design guidelines

- **Mobile-first:** design for mobile viewport first, then extend with `lg:` breakpoints. The app uses a `Sidebar` (desktop) + `MobileNav` (mobile) split — respect this layout contract.
- **Tailwind only:** use Tailwind utility classes for all styling. No inline `style` props, no CSS modules, no additional CSS beyond `globals.css`.
- **Radix UI for interactive primitives:** Dialog, Select, Popover, Tabs, Toast are already installed. Use them instead of building custom accessible components from scratch.
- **Client Components only when needed:** mark a component `"use client"` only if it uses browser APIs, event handlers, or React state/effects. Prefer Server Components for read-only rendering.
- **Small, focused components:** a component should do one thing. If a page file exceeds ~150 lines, extract sub-components into `components/<feature>/`.
- **Semantic HTML + basic a11y:** use `<button>` for actions, `<a>` for navigation, add `aria-label` on icon-only buttons.

## Vercel & React best practices

### Free-tier limits (stay within these)

- Postgres: 256 MB storage, 60 compute hours/month, 100 000 rows max per query result
- Serverless functions: 100 GB-hours/month, 10 s execution timeout on Hobby plan
- Cron jobs: 2 max on Hobby plan (currently using 1 for WhatsApp reminders)

### Next.js / React

- **Prefer Server Components** for data-fetching pages — they run at request time, add zero JS to the client bundle, and can query Prisma directly (see `/calendar` pattern).
- **`revalidatePath`** must be called after every mutation in a Server Action to invalidate the Next.js cache for the affected route.
- **Serialize before passing to Client:** `Decimal` and `Date` objects from Prisma cannot cross the server/client boundary — always convert with `.toString()` / `.toISOString()` and use `JSON.parse(JSON.stringify(...))` for the full prop object.
- **`NEXT_PUBLIC_` prefix** is required for any env var that must be readable in Client Components. Never add this prefix to secrets.
- **Avoid large client-side dependencies:** check bundle impact before adding a new `npm` package. Prefer tree-shakable imports (`import { foo } from 'lib'` not `import lib from 'lib'`).
- **`useTransition` for non-urgent updates:** wrap expensive state updates (e.g., financial chart re-computation on filter change) in `startTransition` to keep the UI responsive.

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

### Pages

| Route | Access | Type | Description |
|---|---|---|---|
| `/login` | Public | Client | Credentials login form; redirects to `/calendar` if already authenticated |
| `/calendar` | All | **Server → Client** | Fetches current-month appointments + all employees directly via Prisma (no Server Action), serializes `Decimal`/`Date` with `JSON.parse(JSON.stringify(...))`, then passes to `CalendarClient.tsx`. Month navigation re-fetches via the `getAppointments` Server Action |
| `/customers` | All | Client | Customer registry — `CustomerTable` + `CustomerForm` modal for create/edit via `actions/customers.ts` |
| `/employees` | ADMIN | Client | User account management — inline `UserModal` for create/edit/delete via `actions/users.ts` |
| `/finance` | ADMIN | Client | Financial dashboard — date-range + service + granularity filters, KPI cards, Recharts chart (`FinancialChart`), expenses table with add/delete via `actions/expenses.ts` |
| `/settings` | ADMIN | Client | Data purge (calls `POST /api/purge`, auto-downloads the ZIP response) and WhatsApp cron status display |

**Key pattern — calendar page data flow:** `CalendarPage` (Server Component) queries Prisma directly and passes serialized props to `CalendarClient` (Client Component). `Decimal` fields must always be `.toString()`-ed before crossing the server/client boundary.

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

## Agent usage rules

**Always invoke `/brainstorming` before spawning any custom agent** (`fullstack-code-reviewer`, `backend-engineer`, or any future project agent). Use brainstorming to clarify the approach, surface edge cases, and frame the task clearly before delegating it to an agent.

## Claude Code skills

Use these skills in the situations described:

| Skill | When to invoke |
|---|---|
| `/run` | After adding or changing any UI feature — start the dev server and visually verify the golden path |
| `/verify` | Before considering a task complete: confirm the change works in the running app, not just in the editor |
| `/code-review` | Before committing non-trivial changes; catches bugs and simplification opportunities |
| `/security-review` | Any time auth, role checks, env vars, or Prisma queries change |
| `/simplify` | After a feature is working but the code feels verbose |

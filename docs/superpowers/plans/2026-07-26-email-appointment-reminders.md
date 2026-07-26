# Email Appointment Reminders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the removed WhatsApp reminder cron with an equivalent that sends next-day appointment reminders to customers via email, using Nodemailer/SMTP.

**Architecture:** A new `Customer.email` (optional) column feeds a new `lib/mailer.ts` (Nodemailer SMTP transporter, separate from the existing Resend-based `lib/email.ts` used for password reset). A cron route at `app/api/cron/email-reminder/route.ts`, protected by `CRON_SECRET`, queries tomorrow's appointments and sends a reminder to each customer with an email on file, skipping those without one. Scheduled daily at 09:00 UTC via `vercel.json`, mirroring the removed WhatsApp cron's shape and error handling.

**Tech Stack:** Next.js 15 App Router · Prisma 6 · Nodemailer (SMTP) · date-fns

## Global Constraints

- All Server Actions must call `requireAuth()` before touching the DB
- The `CRON_SECRET` header check in cron routes must never be removed
- No hardcoded credentials — all secrets from env vars
- `revalidatePath` after every DB mutation in a Server Action
- Naming: camelCase for utility/action files (`lib/mailer.ts`), PascalCase for components; DB columns snake_case via Prisma `@map`
- Tailwind only for any UI change — no inline `style` props
- Vercel Hobby plan: max 2 cron jobs (this adds the 1st)
- No test framework is configured in this repo (no jest/vitest, no `*.test.ts` files) — verification is via `tsc --noEmit`, `npm run build`, and manual curl/browser checks, matching the existing convention used in prior plans

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `Customer.email` (optional) |
| `prisma/migrations/` | Create | New migration adding `email` column |
| `actions/customers.ts` | Modify | Validate/persist `email` in create/update |
| `components/customers/CustomerForm.tsx` | Modify | Add optional email input |
| `package.json` | Modify | Add `nodemailer`, `@types/nodemailer` |
| `lib/mailer.ts` | Create | Nodemailer/SMTP transporter + reminder email builder |
| `app/api/cron/email-reminder/route.ts` | Create | Cron endpoint: finds tomorrow's appointments, sends reminders |
| `vercel.json` | Create | Registers the cron schedule |
| `.env` | Modify (untracked) | Restore `CRON_SECRET` |
| `CLAUDE.md` | Modify | Restore docs section, route table entry, required env vars |

---

## Task 1: DB Schema — add `Customer.email`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_customer_email/migration.sql` (generated)

**Interfaces:**
- Produces: `Customer.email: string | null` in the Prisma client, consumed by Task 2 and Task 4

- [ ] **Step 1: Update `prisma/schema.prisma`**

In `model Customer`, add `email` right after `phoneNumber`:

```prisma
model Customer {
  id          String   @id @default(cuid())
  firstName   String   @map("first_name")
  lastName    String   @map("last_name")
  phoneNumber String?  @map("phone_number")
  email       String?  @map("email")
  age         Int?
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at")

  appointments Appointment[]

  @@map("customers")
}
```

- [ ] **Step 2: Create and apply the migration**

```bash
npx prisma migrate dev --name add_customer_email
```

Expected output: `The following migration(s) have been applied: add_customer_email` and `Generated Prisma Client` — this is a plain nullable-column addition, no manual SQL editing needed (unlike migrations that move/split existing data).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors (or only pre-existing errors unrelated to `Customer`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add optional email field to Customer"
```

---

## Task 2: Collect customer email — action + form

**Files:**
- Modify: `actions/customers.ts`
- Modify: `components/customers/CustomerForm.tsx`

**Interfaces:**
- Consumes: `Customer.email` from Task 1 Prisma client
- Produces: `createCustomer`/`updateCustomer` accept `email: string | null` in their input; `CustomerForm` collects and submits it

- [ ] **Step 1: Update `customerSchema` in `actions/customers.ts`**

Add the `email` field right after `phoneNumber` in the schema:

```ts
const customerSchema = z.object({
  firstName: z.string().min(2, "Il nome è obbligatorio (min. 2 caratteri).").max(50, "Il nome è troppo lungo."),
  lastName: z.string().min(2, "Il cognome è obbligatorio (min. 2 caratteri).").max(50, "Il cognome è troppo lungo."),
  phoneNumber: z.string().optional().nullable(),
  email: z.string().email("Inserisci un indirizzo email valido.").nullable().optional(),
  age: z.coerce
    .number({ invalid_type_error: "L'età deve essere un numero." })
    .min(1, "L'età inserita non è valida.")
    .max(120, "L'età inserita non è valida.")
    .optional()
    .nullable(),
  notes: z.string().max(500, "Le note sono troppo lunghe (max 500 caratteri).").optional().nullable(),
});
```

`createCustomer`/`updateCustomer` already spread `parsed.data` directly into Prisma — no other change needed in those functions.

- [ ] **Step 2: Update `components/customers/CustomerForm.tsx` — type, state, submit payload**

Add `email` to the `Customer` interface at the top of the file:

```ts
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  email: string | null;
  age: number | null;
  notes: string | null;
}
```

Add state, right after the `phoneNumber` state declaration:

```ts
const [phoneNumber, setPhoneNumber] = useState("");
const [email, setEmail] = useState("");
```

In the `useEffect` that resets form fields, right after the `setPhoneNumber` line:

```ts
setPhoneNumber(customer?.phoneNumber ?? "");
setEmail(customer?.email ?? "");
```

In `handleSubmit`, inside the `data` object, right after `phoneNumber`:

```ts
const data = {
  firstName,
  lastName,
  phoneNumber: phoneNumber || null,
  email: email || null,
  age: age ? parseInt(age) : null,
  notes: notes || null,
};
```

- [ ] **Step 3: Add the email input to the form JSX**

Insert this new field between the closing `</div>` of the Telefono/Età grid and the Note field:

```tsx
<div className="space-y-1">
  <label className="text-sm font-medium">Email</label>
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="cliente@esempio.it"
    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
  />
</div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors in `actions/customers.ts` and `components/customers/CustomerForm.tsx`.

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

- [ ] Open `/customers`, click "Nuovo cliente", fill Nome/Cognome and Email with a valid address, save — customer is created without error
- [ ] Edit the same customer, clear the Email field, save — succeeds (field is optional)
- [ ] Try saving with an invalid email (e.g. `abc`) — form shows the validation error message

- [ ] **Step 6: Commit**

```bash
git add actions/customers.ts components/customers/CustomerForm.tsx
git commit -m "feat: collect optional customer email in CustomerForm"
```

---

## Task 3: `lib/mailer.ts` — Nodemailer/SMTP module

**Files:**
- Modify: `package.json` (add `nodemailer`, `@types/nodemailer`)
- Create: `lib/mailer.ts`

**Interfaces:**
- Consumes: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_API_KEY`, `EMAIL_FROM` env vars (already present in `.env`)
- Produces: `sendAppointmentReminderEmail(params: { to: string; customerName: string; date: string; time: string; service: string }): Promise<{ success: boolean; error?: string }>`, consumed by Task 4

- [ ] **Step 1: Install dependencies**

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Create `lib/mailer.ts`**

```ts
/**
 * Email reminder service (Nodemailer / SMTP)
 */

import nodemailer from "nodemailer";

interface SendResult {
  success: boolean;
  error?: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_API_KEY,
  },
});

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_API_KEY || !from) {
    console.error("[Mailer] Variabili SMTP non configurate");
    return { success: false, error: "Provider email non configurato" };
  }

  try {
    await transporter.sendMail({ from, to, subject, html });
    return { success: true };
  } catch (err: any) {
    console.error("[Mailer]", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendAppointmentReminderEmail(params: {
  to: string;
  customerName: string;
  date: string;
  time: string;
  service: string;
}): Promise<SendResult> {
  const { to, customerName, date, time, service } = params;
  return sendEmail({
    to,
    subject: "Promemoria appuntamento – Beauty Backoffice",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Ciao ${customerName}!</h2>
        <p>Ti ricordiamo il tuo appuntamento presso il nostro centro estetico:</p>
        <p><strong>Data:</strong> ${date}<br/>
           <strong>Ora:</strong> ${time}<br/>
           <strong>Servizio:</strong> ${service}</p>
        <p>Per disdire o spostare l'appuntamento, contattaci.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors in `lib/mailer.ts`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/mailer.ts
git commit -m "feat: add Nodemailer-based SMTP mailer for appointment reminders"
```

---

## Task 4: Cron route + Vercel schedule

**Files:**
- Create: `app/api/cron/email-reminder/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `sendAppointmentReminderEmail` from Task 3; `Customer.email` from Task 1
- Produces: `POST /api/cron/email-reminder` and `GET /api/cron/email-reminder`, both requiring `Authorization: Bearer <CRON_SECRET>`

- [ ] **Step 1: Create `app/api/cron/email-reminder/route.ts`**

```ts
/**
 * Cron Job – Reminder Email per appuntamenti del giorno successivo
 * Schedulato in vercel.json: "0 9 * * *" (ogni giorno alle 09:00 UTC)
 *
 * Sicurezza: richiede header Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAppointmentReminderEmail } from "@/lib/mailer";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { it } from "date-fns/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReminderResult {
  customerId: string;
  customerName: string;
  email: string;
  appointmentId: string;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  // ── Verifica autorizzazione cron ──────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Identifica appuntamenti di domani ─────────────────────────────────────
  const tomorrow = addDays(new Date(), 1);
  const from = startOfDay(tomorrow);
  const to = endOfDay(tomorrow);

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: from, lte: to },
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  if (appointments.length === 0) {
    return NextResponse.json({
      message: "Nessun appuntamento per domani",
      sent: 0,
      skipped: 0,
    });
  }

  // ── Invia i reminder ─────────────────────────────────────────────────────
  const results: ReminderResult[] = [];

  for (const apt of appointments) {
    const { customer } = apt;

    if (!customer.email) {
      results.push({
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        email: "",
        appointmentId: apt.id,
        success: false,
        error: "Email mancante",
      });
      continue;
    }

    const sendResult = await sendAppointmentReminderEmail({
      to: customer.email,
      customerName: customer.firstName,
      date: format(apt.startTime, "EEEE d MMMM yyyy", { locale: it }),
      time: format(apt.startTime, "HH:mm"),
      service: apt.serviceType,
    });

    results.push({
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      appointmentId: apt.id,
      ...sendResult,
    });

    // Piccola pausa tra gli invii per rispettare i rate limit dell'SMTP
    await new Promise((r) => setTimeout(r, 200));
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`[Email Cron] ${sent} email inviate, ${failed} fallite`);

  return NextResponse.json({
    message: "Cron completato",
    date: format(tomorrow, "yyyy-MM-dd"),
    total: appointments.length,
    sent,
    failed,
    results,
  });
}

// Vercel invoca i cron job via GET in alcuni casi
export async function GET(req: NextRequest) {
  return POST(req);
}
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/email-reminder",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors in `app/api/cron/email-reminder/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/email-reminder/route.ts vercel.json
git commit -m "feat: add email-reminder cron route and Vercel schedule"
```

---

## Task 5: Restore env vars, update docs, end-to-end verification

**Files:**
- Modify: `.env` (untracked — no commit for this file)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1–4
- Produces: a working, documented, end-to-end reminder flow

- [ ] **Step 1: Restore `CRON_SECRET` in `.env`**

```bash
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env
```

Confirm the `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_API_KEY`, `EMAIL_FROM` lines already in `.env` hold **real** SMTP credentials, not placeholder text — these were pasted from an example spec and may still contain literal example values. Replace any placeholder with real values from your SMTP provider before testing.

- [ ] **Step 2: Update `CLAUDE.md` — Route groups**

In the "Route groups" bullet list, restore the cron line (it was removed when WhatsApp was dropped):

```markdown
- `app/(auth)/` — unauthenticated routes (`/login`, `/forgot-password`, `/reset-password`)
- `app/(dashboard)/` — all protected routes; layout enforces auth and renders Sidebar + MobileNav
- `app/api/cron/` — cron endpoints (not protected by session; use `CRON_SECRET` header instead)
- `app/api/purge/` — data archiving endpoint (ADMIN only)
```

- [ ] **Step 3: Update `CLAUDE.md` — new "Email appointment reminders" section**

Add this new subsection right after the "### Password reset" section (before "### Data purge"):

```markdown
### Email appointment reminders

`lib/mailer.ts` sends transactional email via Nodemailer over SMTP (configured through `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_USER`/`EMAIL_API_KEY`/`EMAIL_FROM`), separate from the Resend integration used for password reset. The cron job at `app/api/cron/email-reminder/route.ts` fires daily at 09:00 UTC (configured in `vercel.json`) and emails next-day appointment reminders to customers with an email on file; customers without one are skipped. It requires `Authorization: Bearer <CRON_SECRET>` on both GET and POST.
```

- [ ] **Step 4: Update `CLAUDE.md` — Required environment variables**

Add these two blocks after the existing "Email – Resend (password reset)" block:

```markdown
# Email – SMTP (appointment reminders)
EMAIL_HOST=            # e.g. smtp.resend.com
EMAIL_PORT=            # e.g. 465
EMAIL_USER=            # SMTP username
EMAIL_API_KEY=         # SMTP password/API key

# Cron
CRON_SECRET=           # shared secret for Authorization: Bearer header on cron routes
```

- [ ] **Step 5: Update `CLAUDE.md` — free-tier cron note**

In the "Free-tier limits" table/list, change:

```markdown
- Cron jobs: 2 max on Hobby plan
```

to:

```markdown
- Cron jobs: 2 max on Hobby plan (currently using 1 for email reminders)
```

- [ ] **Step 6: Full type-check and build**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
npm run build
```

Expected: 0 type errors, `✓ Compiled successfully`.

- [ ] **Step 7: End-to-end manual verification**

```bash
npm run dev
```

- [ ] In `/customers`, create (or edit) a customer with a real, deliverable email address
- [ ] In `/calendar`, create an appointment for that customer for tomorrow
- [ ] In a second terminal, read the secret and call the cron route:
  ```bash
  CRON_SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2)
  curl -i -X POST http://localhost:3000/api/cron/email-reminder \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  Expected: `200 OK`, JSON body with `sent: 1, failed: 0`
- [ ] Check the destination inbox — the reminder email arrived with correct name/date/time/service
- [ ] Create a second appointment for tomorrow for a customer **without** an email, re-run the same curl command
  Expected: `results` array contains an entry with `error: "Email mancante"` for that appointment; `sent`/`failed` counts reflect both appointments
- [ ] Re-run the curl command with a wrong/missing `Authorization` header
  Expected: `401 Unauthorized`

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document email appointment reminders (route, env vars, schedule)"
```

# Email Appointment Reminders — Design Spec
Date: 2026-07-26

## Goal
Sostituire il sistema di promemoria appuntamenti via WhatsApp (rimosso in `d668f16`) con un cron giornaliero che invia promemoria via **email**, usando Nodemailer/SMTP invece di Resend, per non toccare l'infrastruttura Resend già usata dal reset password.

## Context
- Il vecchio sistema (`app/api/cron/whatsapp-reminder/route.ts` + `lib/whatsapp.ts`, cron `0 9 * * *` in `vercel.json`, protetto da `CRON_SECRET`) è stato rimosso interamente insieme a `CRON_SECRET` e alle env var Twilio/Meta.
- `Customer` non ha oggi un campo `email` — solo `phoneNumber`.
- `.env`/`.env.local` contengono già `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_API_KEY` (nuove, per SMTP). `EMAIL_FROM` esiste già ed è usata da `lib/email.ts` (Resend, reset password) — viene riusata anche qui come mittente.
- Il reset password via Resend (`lib/email.ts`, `actions/passwordReset.ts`) **non viene toccato**.

## Decisions
- **Provider:** Nodemailer + SMTP, modulo nuovo e separato da `lib/email.ts` (provider e credenziali diversi).
- **Destinatari:** clienti con `Customer.email` valorizzata; i clienti senza email vengono saltati (stesso comportamento che c'era per `phoneNumber` mancante).
- **Schema:** aggiunto `Customer.email` opzionale, esposto anche in `CustomerForm`.
- **Schedulazione:** stesso pattern del cron rimosso — giornaliero alle 09:00 UTC, `Authorization: Bearer CRON_SECRET`, appuntamenti del giorno successivo.
- **UI:** nessuna modifica a `/settings` in questa iterazione (solo backend).

---

## Section 1 — Database Schema

**File:** `prisma/schema.prisma`

Changes to `model Customer`:
- Add `email String? @map("email")`

**Migration:** `npm run db:migrate` — colonna nullable, nessun backfill necessario.

**Impact:** `CustomerForm.tsx` e `actions/customers.ts` (`createCustomer`, `updateCustomer`) aggiornati per includere `email` opzionale, validata con `z.string().email().optional().or(z.literal(""))`.

---

## Section 2 — Mailer module

**File:** `lib/mailer.ts` (nuovo)

```ts
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

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<SendResult> {
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

Stesso shape `{success, error}` di `lib/email.ts`, stesso pattern di guard su env mancanti.

---

## Section 3 — Cron route

**File:** `app/api/cron/email-reminder/route.ts` (nuovo)

- Verifica `Authorization: Bearer CRON_SECRET` (401 se assente/non valido) — stesso controllo del vecchio `whatsapp-reminder/route.ts`.
- Query Prisma: appuntamenti con `startTime` tra `startOfDay(addDays(new Date(), 1))` e `endOfDay(...)`, con `customer` incluso (`id, firstName, lastName, email`).
- Per ogni appuntamento:
  - Se `customer.email` è assente → risultato `{ success: false, error: "Email mancante" }`, nessun invio.
  - Altrimenti chiama `sendAppointmentReminderEmail` con nome, data (`format(startTime, "EEEE d MMMM yyyy", { locale: it })`), ora (`format(startTime, "HH:mm")`), servizio.
- Pausa di 200ms tra un invio e l'altro (stesso rate-limit precauzionale del vecchio cron).
- Ritorna JSON `{ message, date, total, sent, failed, results }` + `console.log` riepilogativo.
- Espone sia `POST` che `GET` (Vercel a volte invoca cron via GET), `GET` delega a `POST` — stesso pattern del vecchio file.
- `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`.

**File:** `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/email-reminder", "schedule": "0 9 * * *" }
  ]
}
```

(1 cron su 2 disponibili nel piano Hobby.)

---

## Section 4 — Env & security

- `CRON_SECRET` va ripristinato in `.env`/`.env.local` — obbligatorio per la regola CLAUDE.md "il controllo `CRON_SECRET` non va mai rimosso", si applica a qualunque route in `app/api/cron/`.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_API_KEY` già presenti in `.env` (SMTP, per `lib/mailer.ts`).
- `EMAIL_FROM` già presente, condivisa tra `lib/email.ts` (Resend) e `lib/mailer.ts` (SMTP) come mittente.
- Nessuna credenziale hardcoded; `.env`/`.env.local` restano in `.gitignore` (verificato, nessuna traccia in `git ls-files`).
- Dipendenza da aggiungere: `npm install nodemailer` (+ `@types/nodemailer` come devDependency, per coerenza TypeScript).

---

## Section 5 — Docs

**File:** `CLAUDE.md`

- Ripristinare una sezione "Email appointment reminders" (sostituisce la vecchia "WhatsApp reminders"), analoga per struttura, che documenti: `lib/mailer.ts`, la route cron, lo schedule, e il requisito `CRON_SECRET`.
- Ripristinare il blocco env `CRON_SECRET` e le var SMTP nella sezione "Required environment variables".
- Aggiornare la tabella Route (`app/api/cron/` torna a comparire nella sezione Route groups).

---

## Section 6 — Testing

- Manuale: seed/creazione di un cliente con `email` valorizzata e un appuntamento per il giorno successivo, poi:
  ```bash
  curl -X POST http://localhost:3000/api/cron/email-reminder \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  Verifica ricezione email e risposta JSON con `sent: 1, failed: 0`.
- Verifica caso cliente senza email → risultato con `error: "Email mancante"`, nessun invio, nessun crash del loop.
- Verifica 401 se header `Authorization` mancante o errato.

---

## Files Changed

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `Customer.email` |
| `prisma/migrations/` | New migration |
| `components/customers/CustomerForm.tsx` | Add optional email field |
| `actions/customers.ts` | Validate/persist `email` |
| `lib/mailer.ts` | New — Nodemailer/SMTP module |
| `app/api/cron/email-reminder/route.ts` | New — cron route |
| `vercel.json` | Re-add cron config |
| `.env` / `.env.local` | Restore `CRON_SECRET` |
| `package.json` | Add `nodemailer`, `@types/nodemailer` |
| `CLAUDE.md` | Restore docs section + env vars + route table |

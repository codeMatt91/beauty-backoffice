# Password Reset via SMTP Mailer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send password-reset emails through the already-verified Nodemailer/SMTP mailer (`lib/mailer.ts`) instead of the direct Resend SDK (`lib/email.ts`), so the app has one working, verified email channel for both appointment reminders and password reset.

**Architecture:** Add a `sendPasswordResetEmail` export to `lib/mailer.ts` that reuses the existing private `sendEmail()` SMTP helper (same pattern as the existing `sendAppointmentReminderEmail`). Point `actions/passwordReset.ts` at that new export instead of `lib/email.ts`, and drop dead code in that file left over from an earlier Resend-sandbox workaround. `lib/email.ts` and the `resend` npm dependency are left in place, unreferenced — no removal in this iteration.

**Tech Stack:** Next.js 15 Server Actions, Nodemailer over SMTP (`smtp.resend.com`), TypeScript.

## Global Constraints

- No code in Client Components may touch email sending — this logic stays entirely in `"use server"` files (`lib/mailer.ts`, `actions/passwordReset.ts`). (CLAUDE.md security rules)
- Server Actions must call `requireAuth()` before touching the database — **not applicable here**: `requestPasswordReset`/`resetPassword` are pre-auth flows and already intentionally skip `requireAuth()` (documented in CLAUDE.md's "Password reset" section); this plan does not change that.
- `revalidatePath` — not applicable; this plan touches no data the UI caches.
- No test framework exists in this repo (no jest/vitest, no `test` npm script) — verification is `npm run lint`, `npx tsc --noEmit`, and a manual end-to-end run against the dev server, per the spec's Testing section.
- Email content (subject/HTML) must stay byte-for-byte identical to the current `lib/email.ts` version — this is a transport change only, not a copy change.

---

### Task 1: Move password-reset email to the SMTP mailer

**Files:**
- Modify: `lib/mailer.ts`
- Modify: `actions/passwordReset.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: `sendPasswordResetEmail(to: string, resetUrl: string, accountEmail: string): Promise<{ success: boolean; error?: string }>`, exported from `lib/mailer.ts`. Same signature and return shape as the function currently exported from `lib/email.ts`, so the only caller-side change needed is the import path.
- Consumes: the existing private `sendEmail({ to, subject, html }): Promise<SendResult>` helper already defined in `lib/mailer.ts` (used today by `sendAppointmentReminderEmail`). Do not modify `sendEmail()` or the transporter it uses.

- [ ] **Step 1: Add `sendPasswordResetEmail` to `lib/mailer.ts`**

Open `lib/mailer.ts`. After the existing `sendAppointmentReminderEmail` function (currently the last export in the file), add:

```ts
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  accountEmail: string
): Promise<SendResult> {
  return sendEmail({
    to,
    subject: "Reimposta la tua password – Beauty Backoffice",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reimposta la tua password</h2>
        <p>Abbiamo ricevuto una richiesta di reset password per l'account <strong>${accountEmail}</strong>.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#e11d48;color:#fff;border-radius:8px;text-decoration:none;">Reimposta password</a></p>
        <p>Il link scade tra 1 ora. Se non hai richiesto questo reset, ignora questa email.</p>
      </div>
    `,
  });
}
```

This is the exact subject/HTML currently in `lib/email.ts:31-39`, unchanged — only the transport (`sendEmail()` → Nodemailer/SMTP) differs from the Resend SDK call it replaces.

- [ ] **Step 2: Update the import and call site in `actions/passwordReset.ts`**

Change the import on line 7 from:

```ts
import { sendPasswordResetEmail } from "@/lib/email";
```

to:

```ts
import { sendPasswordResetEmail } from "@/lib/mailer";
```

The call site (`await sendPasswordResetEmail(user.email, resetUrl, user.email);`) does not change — same function name, same signature.

- [ ] **Step 3: Remove dead code in `actions/passwordReset.ts`**

Delete these lines (currently lines 12-15):

```ts
// TEMP: Resend è in modalità sandbox senza dominio verificato, quindi può
// inviare solo a questo indirizzo. Rimuovere e usare `user.email` una volta
// verificato un dominio su Resend.
const TEMP_TEST_RECIPIENT_EMAIL = "emanuela94@yopmail.com";
```

This constant is never referenced anywhere in the file (the code already sends to `user.email`) and the comment describes a Resend sandbox limitation that no longer applies once this flow uses SMTP. Confirm before deleting:

```bash
grep -n "TEMP_TEST_RECIPIENT_EMAIL" actions/passwordReset.ts
```

Expected: only the declaration line found (no other usages) — safe to delete.

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both succeed with no errors related to `lib/mailer.ts` or `actions/passwordReset.ts`. (Pre-existing unrelated errors elsewhere in the repo, if any, are out of scope.)

- [ ] **Step 5: Manual end-to-end verification**

Ensure the dev server is running (`npm run dev`, or reuse an already-running one on port 3000). Then, using an email address that belongs to a real `User` row in the database:

1. Open `http://localhost:3000/forgot-password` in the browser.
2. Submit that user's email.
3. Confirm the page shows the generic confirmation message (unchanged behavior — same regardless of whether the email exists).
4. Check that mailbox for an email with subject "Reimposta la tua password – Beauty Backoffice" and a working reset link.
5. Follow the link to `/reset-password?token=...` and confirm the reset form loads.

Expected: email arrives via the SMTP channel (same one already verified for appointment reminders — `lafemme.dev` sender), no Resend-related errors in the server console (`tail -f` the dev server log, or check the terminal running `npm run dev`).

- [ ] **Step 6: Update `CLAUDE.md`**

In the "Password reset" section of `CLAUDE.md`, find this sentence:

> `requestPasswordReset` generates a random token, stores only its SHA-256 hash on `PasswordResetToken` (1 hour expiry, single-use), and emails the raw token as a link via `lib/email.ts` (Resend).

Replace `via lib/email.ts (Resend)` with `via lib/mailer.ts (SMTP)`, so it reads:

> `requestPasswordReset` generates a random token, stores only its SHA-256 hash on `PasswordResetToken` (1 hour expiry, single-use), and emails the raw token as a link via `lib/mailer.ts` (SMTP).

- [ ] **Step 7: Commit**

```bash
git add lib/mailer.ts actions/passwordReset.ts CLAUDE.md
git commit -m "$(cat <<'EOF'
feat: send password reset emails via SMTP mailer instead of Resend

Reuses the already-verified Nodemailer/SMTP channel (lib/mailer.ts)
for password reset, matching the appointment reminder flow, and
drops a dead TEMP_TEST_RECIPIENT_EMAIL constant left over from an
earlier Resend sandbox workaround.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Spec Coverage Check

- Section 1 (Mailer module) → Task 1, Step 1.
- Section 2 (Password reset action) → Task 1, Steps 2-3.
- Section 3 (Docs) → Task 1, Step 6.
- Testing section (manual reset flow, unchanged `resetPassword` logic) → Task 1, Step 5; `resetPassword` itself is untouched by this plan, satisfying "no modification to that function."
- `lib/email.ts` / `resend` dependency left unused, no removal → not modified by any step in this plan (confirmed: no step touches `lib/email.ts` or `package.json`).

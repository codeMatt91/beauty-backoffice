# Password Reset via SMTP Mailer — Design Spec
Date: 2026-07-26

## Goal
Spostare l'invio dell'email di reset password da Resend SDK diretto (`lib/email.ts`) a Nodemailer/SMTP (`lib/mailer.ts`), lo stesso modulo già usato e verificato per i promemoria appuntamento, così da avere un solo canale email operativo e verificato (`lafemme.dev` su `smtp.resend.com`).

## Context
- `actions/passwordReset.ts` chiama oggi `sendPasswordResetEmail` da `lib/email.ts` (Resend SDK, `RESEND_API_KEY`).
- `lib/mailer.ts` espone già `sendAppointmentReminderEmail`, che usa una funzione privata `sendEmail()` con transporter Nodemailer su `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_USER`/`EMAIL_API_KEY`/`EMAIL_FROM` — già testato con invio reale funzionante.
- `actions/passwordReset.ts` contiene una costante morta `TEMP_TEST_RECIPIENT_EMAIL` con un commento obsoleto sulla sandbox Resend; non è mai referenziata (il codice invia già a `user.email`).
- Nessun altro file nel progetto (a parte `CLAUDE.md` e i doc storici) referenzia `lib/email.ts`.

## Decisions
- **Provider:** riuso di `lib/mailer.ts` (SMTP), stesso pattern di `sendAppointmentReminderEmail`.
- **`lib/email.ts` e la dipendenza npm `resend`:** restano nel progetto, non più referenziati da nessun codice (scelta esplicita dell'utente, nessuna rimozione in questa iterazione).
- **Cleanup:** rimossa la costante morta `TEMP_TEST_RECIPIENT_EMAIL` e il relativo commento obsoleto in `actions/passwordReset.ts`, dato che il file viene comunque toccato per il cambio di import.
- **Contenuto email:** invariato (stesso oggetto/HTML già in `lib/email.ts`).
- **Logica token/TTL/single-use/messaggio anti-enumerazione:** invariata.

---

## Section 1 — Mailer module

**File:** `lib/mailer.ts`

Aggiungere una nuova funzione esportata, accanto a `sendAppointmentReminderEmail`, riusando la `sendEmail()` privata già presente:

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

Nessuna modifica alla `sendEmail()` privata esistente né al transporter.

---

## Section 2 — Password reset action

**File:** `actions/passwordReset.ts`

- Import: `sendPasswordResetEmail` da `@/lib/mailer` invece che da `@/lib/email`.
- Rimuovere `TEMP_TEST_RECIPIENT_EMAIL` e il commento associato (righe 12–15 attuali) — dead code non collegato a nessuna chiamata.
- Nessun altro cambio di logica: la chiamata resta `sendPasswordResetEmail(user.email, resetUrl, user.email)`.

---

## Section 3 — Docs

**File:** `CLAUDE.md`, sezione "Password reset"

- Aggiornare la frase che descrive l'invio email per riflettere `lib/mailer.ts` (SMTP) invece di `lib/email.ts` (Resend), coerente con la sezione "Email appointment reminders" già esistente.

---

## Files Changed

| File | Action |
|---|---|
| `lib/mailer.ts` | Add `sendPasswordResetEmail` |
| `actions/passwordReset.ts` | Import da `lib/mailer`; rimuovi dead code `TEMP_TEST_RECIPIENT_EMAIL` |
| `CLAUDE.md` | Aggiorna sezione "Password reset" |

`lib/email.ts` e la dipendenza `resend` in `package.json`: nessuna modifica, restano inutilizzati.

## Testing
- Manuale: richiesta reset password per un utente esistente via `/forgot-password`, verifica ricezione email con link valido tramite SMTP (stesso canale già validato per i promemoria).
- Verifica che il flusso `resetPassword` (validazione token, hash, single-use) resti invariato — nessuna modifica a quella funzione.

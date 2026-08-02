# Notification Bell (Email Reminder Outcomes) — Design Spec
Date: 2026-08-02

## Goal
Ogni email di promemoria appuntamento inviata dal cron `app/api/cron/email-reminder/route.ts` deve generare una notifica interna (nome cliente, tipo appuntamento, esito invio) persistita su DB, visibile tramite l'icona a campanella già presente (ma non funzionante) in `SharedHeader.tsx`. Cliccando la campanella si apre una tendina con lo storico notifiche (lette + non lette), che vengono marcate come lette all'apertura.

## Context
- `SharedHeader.tsx` ha già un `<button aria-label="Notifiche"><Bell/></button>` puramente decorativo, nessuna logica.
- `SharedHeader` è condiviso tra desktop e mobile (non esiste un header mobile separato — `MobileNav.tsx` è solo la barra di navigazione in basso), quindi un solo componente copre entrambi i casi.
- Esiste già un pattern di tendina responsive riutilizzabile: `UserProfileButton.tsx` + `UserProfilePanel.tsx` (overlay fisso + pannello `fixed top-14 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-80`, fetch dati via Server Action in `useEffect`).
- Il cron `email-reminder` produce già, per ogni appuntamento processato, esattamente i dati richiesti (nome cliente, tipo servizio, esito) tramite `sendAppointmentReminderEmail` (`lib/mailer.ts`), incluso il caso "email mancante" (skip, trattato come fallimento).

## Decisions
- **Visibilità:** feed di notifiche condiviso tra tutti gli utenti autenticati (non ADMIN-only, non per-utente). Conseguenza: lo stato "letto" è globale — se un utente apre la campanella, la notifica risulta letta anche per tutti gli altri.
- **Storico:** la tendina mostra le ultime 30 notifiche (lette + non lette insieme, ordinate per data decrescente), non solo le non lette. Le non lette hanno un indicatore visivo (puntino) sulla singola riga.
- **Badge campana:** un singolo puntino (non un contatore numerico) in alto a destra sull'icona, visibile se esiste almeno una notifica non letta.
- **Aggiornamento:** nessun polling. Lo stato iniziale del badge viene calcolato server-side ad ogni caricamento/navigazione (Server Component `app/(dashboard)/layout.tsx`). All'apertura della tendina, il badge si nasconde otticamente in modo ottimistico lato client dopo la chiamata di mark-as-read.
- **Collegamento FK:** `Notification.appointmentId` (opzionale, `onDelete: SetNull`) punta ad `Appointment`. Nome cliente e tipo appuntamento vengono comunque salvati come snapshot testuale sulla notifica, per restare leggibili anche se l'appuntamento viene poi eliminato dal purge (`lib/purge.ts`).
- **Scope:** limitato al cron dei promemoria appuntamento. Il flow di password reset (`actions/passwordReset.ts`) non genera notifiche.
- **Centralizzazione scrittura:** nuovo modulo `lib/notifications.ts` con `logReminderNotification(...)`, richiamato dal cron — evita di inlineare `prisma.notification.create` nella route.
- **Altezza tendina:** lista notifiche scrollabile con altezza massima 50% della viewport (`max-h-[50vh] overflow-y-auto`).

---

## Section 1 — Database Schema

**File:** `prisma/schema.prisma`

Nuovo modello:

```prisma
model Notification {
  id              String       @id @default(cuid())
  customerName    String       @map("customer_name")
  appointmentType String       @map("appointment_type")
  success         Boolean
  errorMessage    String?      @map("error_message")
  read            Boolean      @default(false)
  appointmentId   String?      @map("appointment_id")
  createdAt       DateTime     @default(now()) @map("created_at")

  appointment     Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)

  @@index([read])
  @@index([createdAt])
  @@map("notifications")
}
```

Aggiungere la relazione inversa opzionale su `model Appointment`:

```prisma
notifications Notification[]
```

**Migration:** `npm run db:migrate` (mantiene lo storico migrazioni, come da convenzione del progetto).

---

## Section 2 — Notifications module

**File:** `lib/notifications.ts` (nuovo)

```ts
import { prisma } from "@/lib/prisma";

export async function logReminderNotification(params: {
  customerName: string;
  appointmentType: string;
  success: boolean;
  errorMessage?: string | null;
  appointmentId: string;
}) {
  await prisma.notification.create({ data: params });
}
```

---

## Section 3 — Cron integration

**File:** `app/api/cron/email-reminder/route.ts`

Dentro il loop esistente, subito dopo `sendAppointmentReminderEmail` (e nel branch "email mancante"), aggiungere la chiamata a `logReminderNotification`:

```ts
await logReminderNotification({
  customerName: `${customer.firstName} ${customer.lastName}`,
  appointmentType: apt.serviceType,
  success: sendResult.success,
  errorMessage: sendResult.error ?? null,
  appointmentId: apt.id,
});
```

Il resto della route (verifica `CRON_SECRET`, costruzione di `results[]` per la risposta JSON, pausa 200ms) resta invariato — la scrittura della notifica è additiva, non sostituisce il logging esistente.

---

## Section 4 — Server Actions

**File:** `actions/notifications.ts` (nuovo)

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function getNotifications() {
  await requireAuth();
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationsAsRead() {
  await requireAuth();
  await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });
}

export async function hasUnreadNotifications() {
  await requireAuth();
  const count = await prisma.notification.count({ where: { read: false } });
  return count > 0;
}
```

- Nessun controllo `role === "ADMIN"` — feed condiviso, coerente con la decisione di visibilità.
- `createdAt` serializzato a stringa ISO prima di attraversare il boundary server/client, per coerenza con la regola CLAUDE.md su `Date`/`Decimal`.

---

## Section 5 — UI

**File:** `components/layout/NotificationBell.tsx` (nuovo, client component)

```tsx
"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell({ hasUnread: initialHasUnread }: { hasUnread: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(initialHasUnread);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Notifiche"
        aria-expanded={open}
        className="relative p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
      >
        <Bell className="w-4 h-4" />
        {hasUnread && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <NotificationPanel
          onClose={() => setOpen(false)}
          onRead={() => setHasUnread(false)}
        />
      )}
    </>
  );
}
```

**File:** `components/layout/NotificationPanel.tsx` (nuovo, client component)

- Stessa shell di `UserProfilePanel.tsx`: overlay `fixed inset-0 z-40` per chiusura su click esterno + pannello `fixed top-14 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-80 bg-card border border-border rounded-2xl shadow-2xl`.
- Area lista con `max-h-[50vh] overflow-y-auto` (vincolo altezza richiesto).
- `useEffect` al mount: `getNotifications()` → popola stato locale; poi `markNotificationsAsRead()`; poi `onRead()` per azzerare il puntino sulla campana. Lo stato "non letta" per l'evidenziazione delle righe viene catturato dal valore `read` restituito da `getNotifications()` (prima della mark-as-read), cosi le righe non "saltano" visivamente durante la visualizzazione.
- Ogni riga: nome cliente, tipo appuntamento, indicatore esito (✓ verde se `success`, ✗ `text-destructive` se fallito, con `errorMessage` come tooltip/testo secondario se presente), data relativa (riuso di `formatDate`/date-fns già usato in `UserProfilePanel.tsx`), puntino se non letta al momento del fetch.
- Stato vuoto: messaggio "Nessuna notifica".
- Stato di caricamento: skeleton, stesso pattern di `UserProfilePanel.tsx`.

**File:** `components/layout/SharedHeader.tsx`

- Rimuovere il `<button><Bell/></button>` statico.
- Importare `NotificationBell`, aggiungere prop `hasUnread: boolean`, renderizzarlo al posto del bottone rimosso.

**File:** `app/(dashboard)/layout.tsx`

- Chiamare `hasUnreadNotifications()` (Server Action) accanto ad `auth()`.
- Passare `hasUnread` come prop a `SharedHeader`.

---

## Section 6 — Security check

- `getNotifications`, `markNotificationsAsRead`, `hasUnreadNotifications` chiamano tutte `requireAuth()` come prima istruzione, come richiesto dalle regole CLAUDE.md.
- Nessun controllo ADMIN aggiuntivo (feed condiviso, decisione esplicita).
- Nessun dato sensibile nuovo esposto a Client Components: solo stringhe/boolean già derivate da dati che l'utente autenticato può già vedere altrove (nome cliente, tipo servizio).
- `CRON_SECRET` check in `app/api/cron/email-reminder/route.ts` non viene toccato — `logReminderNotification` viene chiamato solo dopo la verifica esistente.
- Migrazione via `npm run db:migrate`, non `db:push`.
- Nessuna nuova env var, nessuna nuova dipendenza npm.

---

## Section 7 — Testing

- Manuale: seed di un cliente con `email` valorizzata e un appuntamento per il giorno successivo, poi:
  ```bash
  curl -X POST http://localhost:3000/api/cron/email-reminder \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  Verifica che venga creata una riga in `notifications` con `success: true`.
- Verifica caso cliente senza email → notifica con `success: false`, `errorMessage: "Email mancante"`.
- UI: aprire la campanella, verificare che il puntino sparisca e che la lista mostri la nuova notifica; ricaricare la pagina e verificare che la notifica risulti già "letta" (nessun puntino sulla riga, nessun puntino sulla campana).
- Verifica responsive: pannello a larghezza piena (meno margini) su mobile, `w-80` su desktop; lista capped a 50vh con scroll se ci sono molte notifiche.

---

## Files Changed

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `Notification` model + relazione inversa su `Appointment` |
| `prisma/migrations/` | New migration |
| `lib/notifications.ts` | New — `logReminderNotification` |
| `app/api/cron/email-reminder/route.ts` | Call `logReminderNotification` per ogni esito |
| `actions/notifications.ts` | New — `getNotifications`, `markNotificationsAsRead`, `hasUnreadNotifications` |
| `components/layout/NotificationBell.tsx` | New |
| `components/layout/NotificationPanel.tsx` | New |
| `components/layout/SharedHeader.tsx` | Replace static bell button with `NotificationBell` |
| `app/(dashboard)/layout.tsx` | Fetch `hasUnreadNotifications()`, pass to `SharedHeader` |

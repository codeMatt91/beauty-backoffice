# Notification Bell (Email Reminder Outcomes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every reminder email sent by the `app/api/cron/email-reminder` cron writes a `Notification` row (customer name, appointment type, send success/failure) to the DB, surfaced through the (currently decorative) bell icon in `SharedHeader.tsx` — clicking it opens a responsive dropdown showing the last 30 notifications and marks unread ones as read.

**Architecture:** New `Notification` Prisma model + a small `lib/notifications.ts` writer called from the existing cron loop. Three `requireAuth()`-gated Server Actions in `actions/notifications.ts` (`getNotifications`, `markNotificationsAsRead`, `hasUnreadNotifications`). Two new client components (`NotificationBell`, `NotificationPanel`) reusing the exact responsive dropdown shell already proven in `UserProfileButton.tsx`/`UserProfilePanel.tsx`. `app/(dashboard)/layout.tsx` (Server Component) fetches the initial unread state and passes it down — no polling.

**Tech Stack:** Next.js 15 App Router, Prisma 6, Server Actions, React 19 Client Components, Tailwind CSS, `lucide-react` icons, `date-fns` (+ `it` locale, already a dependency and already used the same way in the cron route).

## Global Constraints

- Every Server Action calls `requireAuth()` as its first statement (per CLAUDE.md security rules). No ADMIN check on any of the three new actions — the notification feed is explicitly shared/global across all authenticated users, and "read" state is global (marking read in one session marks it read for everyone).
- Server Actions must never leak a Prisma `Date` object to a Client Component — `Notification.createdAt` is converted to an ISO string (`.toISOString()`) before being returned from `getNotifications()`.
- Schema changes go through `npm run db:migrate` (creates migration history), never `npm run db:push`.
- Tailwind utility classes only — no inline `style`, no CSS modules.
- Icon-only buttons need `aria-label`.
- The `CRON_SECRET` check in `app/api/cron/email-reminder/route.ts` must not be touched or weakened.
- This project has no automated test runner (`package.json` scripts are `dev`, `build`, `start`, `lint`, `db:*` only). Verification per task is `npm run lint` (and `npx tsc --noEmit` where types are introduced) plus manual checks — real DB writes via `curl`/Prisma Studio for backend tasks, and browser verification via the `/run` skill for the UI task.
- No new npm dependencies, no new env vars.

---

### Task 1: Database schema — `Notification` model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `Notification` with fields `id, customerName, appointmentType, success, errorMessage, read, appointmentId, createdAt` and delegate `prisma.notification` used by Task 2 (writer) and Task 3 (Server Actions).

- [ ] **Step 1: Add the `Notification` model**

Append to `prisma/schema.prisma`, after `model MonthlyExpense` and before `model PurgeArchive` (or at the end of the file — position doesn't matter to Prisma):

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

  appointment Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)

  @@index([read])
  @@index([createdAt])
  @@map("notifications")
}
```

- [ ] **Step 2: Add the inverse relation on `Appointment`**

In `prisma/schema.prisma`, find `model Appointment` and add one line inside its field list (near the other relation fields `customer`/`employee`, e.g. right after `employee User? ...`):

```prisma
  notifications Notification[]
```

- [ ] **Step 3: Run the migration**

Run: `npm run db:migrate -- --name add_notifications`
Expected: Prisma prints `Applying migration ...add_notifications`, creates `prisma/migrations/<timestamp>_add_notifications/migration.sql`, and regenerates the Prisma Client (no errors).

- [ ] **Step 4: Verify the table exists**

Run: `npm run db:studio`
Expected: Prisma Studio opens in the browser and lists a `Notification` model / `notifications` table with columns `id, customer_name, appointment_type, success, error_message, read, appointment_id, created_at` and zero rows. Close Prisma Studio (Ctrl+C in the terminal) once confirmed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat: add Notification model for email reminder outcomes

Tracks per-send results (customer, appointment type, success/error,
read state) from the reminder cron, as a foundation for an in-app
notification bell.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Notification writer + cron integration

**Files:**
- Create: `lib/notifications.ts`
- Modify: `app/api/cron/email-reminder/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`; the `Notification` model from Task 1.
- Produces: `logReminderNotification(params: { customerName: string; appointmentType: string; success: boolean; errorMessage?: string | null; appointmentId: string }): Promise<void>`, called by the cron route and available for Task 3/4's manual verification (rows it writes are what the UI will display).

- [ ] **Step 1: Create `lib/notifications.ts`**

```ts
/**
 * Notification writer — persists the outcome of automated email sends
 * (currently only appointment reminders) for display in the header bell.
 */

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

- [ ] **Step 2: Call it from the cron route's "missing email" branch**

In `app/api/cron/email-reminder/route.ts`, add the import:

```ts
import { logReminderNotification } from "@/lib/notifications";
```

Then find this block (inside the `for (const apt of appointments)` loop):

```ts
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
```

Replace it with:

```ts
    if (!customer.email) {
      results.push({
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        email: "",
        appointmentId: apt.id,
        success: false,
        error: "Email mancante",
      });
      await logReminderNotification({
        customerName: `${customer.firstName} ${customer.lastName}`,
        appointmentType: apt.serviceType,
        success: false,
        errorMessage: "Email mancante",
        appointmentId: apt.id,
      });
      continue;
    }
```

- [ ] **Step 3: Call it from the send branch**

Find this block, right after it:

```ts
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
```

Add the notification write right after the `results.push(...)` call (still inside the same loop iteration, before the rate-limit `setTimeout`):

```ts
    await logReminderNotification({
      customerName: `${customer.firstName} ${customer.lastName}`,
      appointmentType: apt.serviceType,
      success: sendResult.success,
      errorMessage: sendResult.error ?? null,
      appointmentId: apt.id,
    });
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no errors in `lib/notifications.ts` or `app/api/cron/email-reminder/route.ts`.

- [ ] **Step 5: Verify with a real cron call**

1. Run: `npm run db:studio`
2. In the `Customer` table, create (or edit an existing) row with a non-empty `email`.
3. In the `Appointment` table, create a row for that customer with `startTime`/`endTime` set to tomorrow (any time), any `serviceType` (e.g. `"Manicure"`), any `price`.
4. Start the dev server in another terminal: `npm run dev`
5. Run:
   ```bash
   curl -X POST http://localhost:3000/api/cron/email-reminder \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   (Use the actual value of `CRON_SECRET` from `.env.local` if the shell variable isn't set.)
6. Expected JSON response: `"total": 1` and either `"sent": 1` or `"failed": 1` (failure is fine here if SMTP env vars aren't configured locally — `sendAppointmentReminderEmail` returns `{ success: false, error: "Provider email non configurato" }`, which is still a valid outcome to persist).
7. Back in Prisma Studio, refresh the `Notification` table: one new row should exist with `customer_name` and `appointment_type` matching the seeded data, and `success`/`error_message` matching the curl response.

- [ ] **Step 6: Commit**

```bash
git add lib/notifications.ts app/api/cron/email-reminder/route.ts
git commit -m "$(cat <<'EOF'
feat: persist a notification for every reminder email outcome

Every appointment processed by the reminder cron now writes a
Notification row (customer, service, success/error), including the
"missing email" skip case, so outcomes are visible in-app instead of
only in cron logs.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Server Actions

**Files:**
- Modify: `types/index.ts`
- Create: `actions/notifications.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`, `requireAuth` from `@/lib/auth` (existing, used by every other action file, e.g. `actions/customers.ts`).
- Produces:
  - `NotificationItem` type (exported from `@/types`): `{ id: string; customerName: string; appointmentType: string; success: boolean; errorMessage: string | null; read: boolean; appointmentId: string | null; createdAt: string }`.
  - `getNotifications(): Promise<NotificationItem[]>` — last 30, newest first.
  - `markNotificationsAsRead(): Promise<void>` — marks all currently-unread rows as read.
  - `hasUnreadNotifications(): Promise<boolean>` — used by Task 4's layout wiring.

- [ ] **Step 1: Add `NotificationItem` to `types/index.ts`**

Add at the end of `types/index.ts`:

```ts
export interface NotificationItem {
  id: string;
  customerName: string;
  appointmentType: string;
  success: boolean;
  errorMessage: string | null;
  read: boolean;
  appointmentId: string | null;
  createdAt: string; // ISO string — Prisma DateTime serialized for the client
}
```

- [ ] **Step 2: Create `actions/notifications.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { NotificationItem } from "@/types";

export async function getNotifications(): Promise<NotificationItem[]> {
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

export async function markNotificationsAsRead(): Promise<void> {
  await requireAuth();
  await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });
}

export async function hasUnreadNotifications(): Promise<boolean> {
  await requireAuth();
  const count = await prisma.notification.count({ where: { read: false } });
  return count > 0;
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors referencing `types/index.ts` or `actions/notifications.ts`.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts actions/notifications.ts
git commit -m "$(cat <<'EOF'
feat: add notification Server Actions

getNotifications/markNotificationsAsRead/hasUnreadNotifications back
the upcoming header bell UI. All three call requireAuth(); no ADMIN
check since the notification feed is shared across all users.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Notification bell UI

**Files:**
- Create: `components/layout/NotificationPanel.tsx`
- Create: `components/layout/NotificationBell.tsx`
- Modify: `components/layout/SharedHeader.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `getNotifications`, `markNotificationsAsRead` (both from Task 3, called client-side) inside `NotificationPanel`; `hasUnreadNotifications` (from Task 3, called server-side) inside `app/(dashboard)/layout.tsx`; `NotificationItem` type from `@/types`.
- Produces: `NotificationBell({ hasUnread: boolean })` — the only new prop `SharedHeader` needs to accept and forward.

- [ ] **Step 1: Create `components/layout/NotificationPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { getNotifications, markNotificationsAsRead } from "@/actions/notifications";
import type { NotificationItem } from "@/types";

interface Props {
  onClose: () => void;
  onRead: () => void;
}

export default function NotificationPanel({ onClose, onRead }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications()
      .then((data) => {
        setNotifications(data);
        setLoading(false);
        return markNotificationsAsRead();
      })
      .then(() => onRead())
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Transparent overlay — closes panel on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed top-14 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-80 bg-card border border-border rounded-2xl shadow-2xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Notifiche</h2>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 bg-secondary animate-pulse rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Nessuna notifica
            </p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0"
                >
                  {n.success ? (
                    <CheckCircle2
                      className="w-4 h-4 text-green-600 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="w-4 h-4 text-destructive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {n.customerName} – {n.appointmentType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {n.success ? "Email inviata" : n.errorMessage ?? "Invio fallito"}
                      {" · "}
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: it,
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <span
                      className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5"
                      aria-label="Non letta"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
```

Note: `notifications` state is set from the `read` values returned by `getNotifications()` *before* `markNotificationsAsRead()` resolves, and is never re-fetched afterward — so unread dots stay visible for the duration this panel instance is open, even though the rows are now marked read in the DB.

- [ ] **Step 2: Create `components/layout/NotificationBell.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import NotificationPanel from "./NotificationPanel";

interface Props {
  hasUnread: boolean;
}

export default function NotificationBell({ hasUnread: initialHasUnread }: Props) {
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
        <NotificationPanel onClose={() => setOpen(false)} onRead={() => setHasUnread(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Wire `NotificationBell` into `SharedHeader.tsx`**

In `components/layout/SharedHeader.tsx`:

1. Change the `lucide-react` import from `import { Bell, LogOut } from "lucide-react";` to `import { LogOut } from "lucide-react";` (`Bell` is no longer used directly here).
2. Add `import NotificationBell from "./NotificationBell";` near the other component imports.
3. Add `hasUnread: boolean;` to the `Props` interface, and destructure it in the function signature: `export default function SharedHeader({ firstName, lastName, email, role, hasUnread }: Props) {`.
4. Replace this block:

```tsx
        <button
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          aria-label="Notifiche"
        >
          <Bell className="w-4 h-4" />
        </button>
```

with:

```tsx
        <NotificationBell hasUnread={hasUnread} />
```

- [ ] **Step 4: Wire `hasUnreadNotifications()` into `app/(dashboard)/layout.tsx`**

In `app/(dashboard)/layout.tsx`:

1. Add `import { hasUnreadNotifications } from "@/actions/notifications";`.
2. After `const user = session.user as any;`, add: `const hasUnread = await hasUnreadNotifications();`.
3. Update the `<SharedHeader ... />` call to include the new prop:

```tsx
        <SharedHeader
          firstName={user.firstName}
          lastName={user.lastName}
          email={user.email}
          role={user.role as Role}
          hasUnread={hasUnread}
        />
```

- [ ] **Step 5: Lint and type-check**

Run: `npm run lint`
Expected: no errors (specifically: no "Bell is defined but never used" in `SharedHeader.tsx`).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual browser verification (use the `/run` skill)**

Prerequisite: at least one `Notification` row must exist — reuse the one created in Task 2 Step 5, or create another via a fresh cron `curl` call.

1. Start the dev server: `npm run dev`
2. Log in and land on `/calendar`.
3. Confirm the bell icon in the header shows a small red dot (unread notification exists).
4. Click the bell. Confirm:
   - A dropdown opens below the header, anchored to the right.
   - It shows the notification(s) with customer name, appointment type, a ✓/✗ indicator, and a relative timestamp (e.g. "circa 2 minuti fa").
   - The unread row(s) have a dot on the right.
   - The dot on the bell icon disappears (without a page reload).
5. Click outside the panel — it closes.
6. Reload the page (`F5`). Confirm the bell no longer shows a dot (state is now read, recomputed server-side by `app/(dashboard)/layout.tsx`).
7. Click the bell again — the same notification(s) are still listed (not "only unread"), just without the unread dot this time.
8. Resize the browser to a mobile width (or use device toolbar). Confirm the panel spans nearly the full width (`w-[calc(100vw-1rem)]`) instead of the fixed `w-80` desktop size, and the list area still scrolls internally if it grows past 50% of the viewport height (can be confirmed visually even with few rows — the `max-h-[50vh] overflow-y-auto` class is present in the DOM).

Expected: all checks pass.

- [ ] **Step 7: Commit**

```bash
git add components/layout/NotificationPanel.tsx components/layout/NotificationBell.tsx components/layout/SharedHeader.tsx "app/(dashboard)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat: add notification bell dropdown to the header

Wires the bell icon (previously decorative) to the new notification
feed: unread state is computed server-side on layout render (no
polling), the dropdown shows the last 30 notifications, and opening
it marks unread ones as read. Responsive shell reuses the pattern
already proven in UserProfilePanel.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan verification

After Task 4 is committed, run the `/verify` skill to confirm the full flow (cron write → DB → bell badge → dropdown → mark-as-read → persistence across reload) works end-to-end in the running app, per CLAUDE.md's skill table. Also run `/security-review`, since this plan adds new Server Actions and a new Prisma-backed data path, per CLAUDE.md's rule to run it "any time auth, role checks, env vars, or Prisma queries change."

# User Profile Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static top-right user section with a consistent, clickable profile button (present on all dashboard pages) that opens a floating panel showing the user's photo, personal info, and photo upload.

**Architecture:** DashboardLayout (Server Component) renders a new `SharedHeader` Client Component that uses `usePathname()` for page titles and passes session user props to `UserProfileButton`. The panel lazy-loads `image` and `createdAt` via `getMyProfile()` Server Action on first open. The `name` DB column is split into `firstName`/`lastName` via a custom migration.

**Tech Stack:** Next.js 15 App Router · Next-Auth v5 JWT · Prisma 6 · Vercel Postgres · Tailwind CSS · Radix UI Dialog · Lucide icons

## Global Constraints

- All Server Actions must call `requireAuth()` before touching the DB
- Tailwind only — no inline `style` props
- `"use client"` only when browser APIs / state / effects are needed
- `revalidatePath` after every DB mutation (except `updateProfileImage` which updates local state only)
- Photo max size: 10 MB; accepted types: `image/jpeg`, `image/png`, `image/svg+xml`
- Naming: camelCase variables/functions, PascalCase components/types, camelCase files (except components = PascalCase)
- DB columns: snake_case via Prisma `@map`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `firstName`, `lastName`, `image`; remove `name` |
| `lib/auth.ts` | Modify | `authorize()` returns `firstName`/`lastName` |
| `auth.config.ts` | Modify | JWT/session callbacks carry `firstName`/`lastName` |
| `types/index.ts` | Modify | `SessionUser` + `AppointmentWithRelations` employee type |
| `actions/users.ts` | Modify | Zod schemas + Prisma selects for `firstName`/`lastName` |
| `components/employees/UserTable.tsx` | Modify | `UserRecord` type + display name |
| `components/employees/UserModal.tsx` | Modify | Two name fields instead of one |
| `actions/appointments.ts` | Modify | Employee select: `firstName`/`lastName` |
| `app/(dashboard)/calendar/page.tsx` | Modify | Remove Header; update employee/user selects |
| `app/(dashboard)/calendar/CalendarClient.tsx` | Modify | Update inline employee/Appointment types |
| `components/calendar/CalendarView.tsx` | Modify | Display `firstName lastName` |
| `components/calendar/AppointmentModal.tsx` | Modify | Employee options show `firstName lastName` |
| `actions/profile.ts` | Create | `getMyProfile()`, `updateProfileImage()` |
| `components/layout/UserProfilePanel.tsx` | Create | Floating panel with photo + info |
| `components/layout/UserProfileButton.tsx` | Create | Avatar button that opens panel |
| `components/layout/SharedHeader.tsx` | Create | Replaces `Header.tsx`; uses `usePathname()` |
| `app/(dashboard)/layout.tsx` | Modify | Add `SharedHeader`; pass `firstName`/`lastName` to Sidebar |
| `app/(dashboard)/customers/page.tsx` | Modify | Remove Header |
| `app/(dashboard)/finance/page.tsx` | Modify | Remove Header |
| `app/(dashboard)/employees/page.tsx` | Modify | Remove Header |
| `app/(dashboard)/settings/page.tsx` | Modify | Remove Header |
| `components/layout/Header.tsx` | Delete | Replaced by SharedHeader |

---

## Task 1: DB Schema — split `name`, add `image`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_split_user_name_add_image/migration.sql` (generated then edited)

**Interfaces:**
- Produces: `User.firstName: String`, `User.lastName: String`, `User.image: String?` in Prisma client

- [ ] **Step 1: Update `prisma/schema.prisma`**

Replace the `name String` line in `model User` with `firstName`, `lastName`, and `image`. The full updated model:

```prisma
model User {
  id           String   @id @default(cuid())
  firstName    String   @map("first_name")
  lastName     String   @map("last_name")
  email        String   @unique
  passwordHash String   @map("password_hash")
  role         Role     @default(EMPLOYEE)
  image        String?
  createdAt    DateTime @default(now()) @map("created_at")

  appointments        Appointment[]       @relation("EmployeeAppointments")
  passwordResetTokens PasswordResetToken[]

  @@map("users")
}
```

- [ ] **Step 2: Create migration with `--create-only` (do NOT apply yet)**

```bash
npx prisma migrate dev --name split_user_name_add_image --create-only
```

Prisma creates `prisma/migrations/<timestamp>_split_user_name_add_image/migration.sql`.

- [ ] **Step 3: Replace generated migration SQL with custom data-migration SQL**

Open the generated `migration.sql` and replace its entire content with:

```sql
-- Step 1: add new columns as nullable
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name"  TEXT;
ALTER TABLE "users" ADD COLUMN "image"      TEXT;

-- Step 2: populate first_name / last_name from existing name
UPDATE "users"
SET
  "first_name" = SPLIT_PART(name, ' ', 1),
  "last_name"  = CASE
    WHEN POSITION(' ' IN name) > 0
    THEN TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1))
    ELSE ''
  END;

-- Step 3: enforce NOT NULL now that rows are populated
ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "last_name"  SET NOT NULL;

-- Step 4: drop the old column
ALTER TABLE "users" DROP COLUMN "name";
```

- [ ] **Step 4: Apply the migration**

```bash
npx prisma migrate dev
```

Expected output: `The following migration(s) have been applied: split_user_name_add_image`

- [ ] **Step 5: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: split User.name into firstName/lastName, add image field"
```

---

## Task 2: Auth & Session types

**Files:**
- Modify: `lib/auth.ts`
- Modify: `auth.config.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Consumes: `User.firstName`, `User.lastName` from Task 1 Prisma client
- Produces: `SessionUser { id, firstName, lastName, email, role }` available in all Server Components and Server Actions via `requireAuth()`

- [ ] **Step 1: Update `types/index.ts` — `SessionUser` and `AppointmentWithRelations`**

Replace the `SessionUser` interface and the employee sub-type in `AppointmentWithRelations`:

```ts
export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export interface AppointmentWithRelations {
  id: string;
  customerId: string;
  employeeId: string | null;
  serviceType: string;
  startTime: Date;
  endTime: Date;
  price: string;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdAt: Date;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}
```

- [ ] **Step 2: Update `lib/auth.ts` — `authorize()` return value**

Inside the `authorize` function, change the return statement from:
```ts
return {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
};
```
to:
```ts
return {
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
};
```

- [ ] **Step 3: Update `auth.config.ts` — JWT and session callbacks**

Replace the `callbacks` object:

```ts
callbacks: {
  jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      token.role = (user as any).role;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      token.firstName = (user as any).firstName;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      token.lastName = (user as any).lastName;
    }
    return token;
  },
  session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).role = token.role;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).firstName = token.firstName;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).lastName = token.lastName;
    }
    return session;
  },
},
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors only from files not yet updated (users.ts, UserModal, etc.) — the auth/types files themselves should be clean.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts lib/auth.ts auth.config.ts
git commit -m "feat: add firstName/lastName to SessionUser and JWT callbacks"
```

---

## Task 3: Update `actions/users.ts`, `UserRecord`, `UserModal`, and Sidebar

**Files:**
- Modify: `actions/users.ts`
- Modify: `components/employees/UserTable.tsx`
- Modify: `components/employees/UserModal.tsx`

**Interfaces:**
- Consumes: `User.firstName`, `User.lastName` from Task 1
- Produces: `UserRecord { id, firstName, lastName, email, role, createdAt }` used by `UserTable` and `UserModal`

- [ ] **Step 1: Rewrite `actions/users.ts`**

Full replacement of the file:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { ActionResult, zodErrorToMessage } from "@/lib/actionResult";

const createUserSchema = z.object({
  firstName: z.string().min(1, "Il nome è obbligatorio.").max(80),
  lastName: z.string().min(1, "Il cognome è obbligatorio.").max(80),
  email: z.string().email("Inserisci un indirizzo email valido."),
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri."),
  role: z.nativeEnum(Role).default("EMPLOYEE"),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri.").optional(),
});

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export async function getEmployees() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    select: USER_SELECT,
    orderBy: { firstName: "asc" },
  });
}

export async function getAllUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { firstName: "asc" },
  });
}

export async function createUser(data: z.infer<typeof createUserSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { success: false, error: "Questa email è già in uso." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
    select: USER_SELECT,
  });

  revalidatePath("/employees");
  return { success: true, data: null };
}

export async function updateUser(id: string, data: z.infer<typeof updateUserSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    delete updateData.password;
  }

  await prisma.user.update({
    where: { id },
    data: updateData,
    select: USER_SELECT,
  });

  revalidatePath("/employees");
  return { success: true, data: null };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.id === id) return { success: false, error: "Non puoi eliminare il tuo account." };

  const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (targetUser?.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { success: false, error: "Non puoi eliminare l'ultimo account Admin." };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/employees");
  return { success: true, data: null };
}
```

- [ ] **Step 2: Update `components/employees/UserTable.tsx` — `UserRecord` type and display**

Change the `UserRecord` interface at the top:

```ts
export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  createdAt: Date;
}
```

Replace every `u.name` with `` `${u.firstName} ${u.lastName}` `` in the component (desktop table `<td>` and mobile card `<p>`, and both `aria-label` attributes and `onDelete` calls):

Desktop table cell (line ~39):
```tsx
<td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
```

Mobile card name (line ~82):
```tsx
<p className="font-medium text-foreground truncate">{u.firstName} {u.lastName}</p>
```

`aria-label` on edit button:
```tsx
aria-label={`Modifica ${u.firstName} ${u.lastName}`}
```

`aria-label` on delete button:
```tsx
aria-label={`Elimina ${u.firstName} ${u.lastName}`}
```

`onDelete` calls (both table and card):
```tsx
onClick={() => onDelete(u.id, `${u.firstName} ${u.lastName}`)}
```

- [ ] **Step 3: Update `components/employees/UserModal.tsx` — split name into two fields**

Full replacement of the file:

```tsx
"use client";

import { useState } from "react";
import { createUser, updateUser } from "@/actions/users";
import * as Dialog from "@radix-ui/react-dialog";
import { Role } from "@prisma/client";
import { X } from "lucide-react";
import type { UserRecord } from "./UserTable";

export default function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user?: UserRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = user
        ? await updateUser(user.id, { firstName, lastName, email, role, ...(password ? { password } : {}) })
        : await createUser({ firstName, lastName, email, password, role });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Errore durante il salvataggio. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl border border-border focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold">
              {user ? "Modifica utente" : "Nuovo utente"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nome *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Cognome *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Password {user ? "(lascia vuoto per non cambiare)" : "*"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!user}
                minLength={8}
                placeholder="Min. 8 caratteri"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ruolo</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="EMPLOYEE">Dipendente</option>
                <option value="ADMIN">Amministratore</option>
              </select>
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50"
              >
                {loading ? "..." : user ? "Aggiorna" : "Crea"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: errors only in appointment-related files (CalendarClient, CalendarView, AppointmentModal) — tasks handled in Task 4.

- [ ] **Step 5: Commit**

```bash
git add actions/users.ts components/employees/UserTable.tsx components/employees/UserModal.tsx
git commit -m "feat: replace User.name with firstName/lastName in users action and employee UI"
```

---

## Task 4: Update Appointments chain for `firstName`/`lastName`

**Files:**
- Modify: `actions/appointments.ts` (line 39)
- Modify: `app/(dashboard)/calendar/page.tsx`
- Modify: `app/(dashboard)/calendar/CalendarClient.tsx`
- Modify: `components/calendar/CalendarView.tsx` (line 274)
- Modify: `components/calendar/AppointmentModal.tsx` (line 195)

**Interfaces:**
- Consumes: `User.firstName`, `User.lastName` from Task 1
- Produces: `Appointment.employee: { id, firstName, lastName }` flowing from action → CalendarClient → CalendarView/AppointmentModal

- [ ] **Step 1: Update `actions/appointments.ts` — employee select**

On line 39, change:
```ts
employee: { select: { id: true, name: true } },
```
to:
```ts
employee: { select: { id: true, firstName: true, lastName: true } },
```

- [ ] **Step 2: Update `app/(dashboard)/calendar/page.tsx`**

Remove `import Header` and the `<Header>` tag, remove the `auth()` call (no longer needed for Header), update employee selects, and simplify the wrapper div.

Full replacement of the file:

```tsx
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const [appointments, employees] = await Promise.all([
    prisma.appointment.findMany({
      where: { startTime: { gte: from, lte: to } },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const serializedAppointments = appointments.map((a) => ({
    ...a,
    price: a.price.toString(),
  }));

  return (
    <div className="flex flex-col h-full">
      <CalendarClient
        initialAppointments={JSON.parse(JSON.stringify(serializedAppointments))}
        employees={employees}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update `app/(dashboard)/calendar/CalendarClient.tsx` — inline types**

Change the `Appointment` interface (lines 19-31) and the `Props` interface (lines 33-36):

```ts
interface Appointment {
  id: string;
  customerId: string;
  employeeId: string | null;
  serviceType: string;
  startTime: Date;
  endTime: Date;
  price: string;
  paymentStatus: PaymentStatus;
  notes: string | null;
  customer: { id: string; firstName: string; lastName: string; phoneNumber: string | null };
  employee: { id: string; firstName: string; lastName: string } | null;
}

interface Props {
  initialAppointments: Appointment[];
  employees: { id: string; firstName: string; lastName: string }[];
}
```

- [ ] **Step 4: Update `components/calendar/CalendarView.tsx` — employee name display**

On line 274, change:
```tsx
{a.employee && ` (${a.employee.name})`} · {formatCurrency(a.price)}
```
to:
```tsx
{a.employee && ` (${a.employee.firstName} ${a.employee.lastName})`} · {formatCurrency(a.price)}
```

- [ ] **Step 5: Update `components/calendar/AppointmentModal.tsx` — employee options**

On line 195, change:
```tsx
<option key={emp.id} value={emp.id}>{emp.name}</option>
```
to:
```tsx
<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors (or only errors from yet-to-be-created files).

- [ ] **Step 7: Commit**

```bash
git add actions/appointments.ts app/\(dashboard\)/calendar/page.tsx app/\(dashboard\)/calendar/CalendarClient.tsx components/calendar/CalendarView.tsx components/calendar/AppointmentModal.tsx
git commit -m "feat: update appointment chain to use firstName/lastName for employees"
```

---

## Task 5: Create `actions/profile.ts`

**Files:**
- Create: `actions/profile.ts`

**Interfaces:**
- Consumes: `requireAuth()` from `lib/auth.ts`; `User.image`, `User.createdAt` from Task 1 Prisma client
- Produces:
  - `getMyProfile(): Promise<{ image: string | null; createdAt: Date }>`
  - `updateProfileImage(dataUrl: string): Promise<{ success: boolean }>`

- [ ] **Step 1: Create `actions/profile.ts`**

```ts
"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getMyProfile(): Promise<{ image: string | null; createdAt: Date }> {
  const user = await requireAuth();
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { image: true, createdAt: true },
  });
  return dbUser;
}

export async function updateProfileImage(dataUrl: string): Promise<{ success: boolean }> {
  const user = await requireAuth();

  const validPrefix = /^data:image\/(jpeg|png|svg\+xml);base64,/;
  if (!validPrefix.test(dataUrl)) {
    throw new Error("Formato immagine non valido. Usa JPEG, PNG o SVG.");
  }

  // base64 encodes 3 bytes as 4 chars; 10 MB * 4/3 ≈ 13 981 013 chars
  if (dataUrl.length > 13_981_013) {
    throw new Error("L'immagine supera il limite di 10 MB.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { image: dataUrl },
  });

  return { success: true };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors in `actions/profile.ts`.

- [ ] **Step 3: Commit**

```bash
git add actions/profile.ts
git commit -m "feat: add getMyProfile and updateProfileImage server actions"
```

---

## Task 6: Create `UserProfilePanel` component

**Files:**
- Create: `components/layout/UserProfilePanel.tsx`

**Interfaces:**
- Consumes: `getMyProfile()`, `updateProfileImage()` from `actions/profile.ts`; `formatDate()` from `lib/utils`
- Produces: `UserProfilePanel({ firstName, lastName, email, role, onClose })` — renders floating panel

- [ ] **Step 1: Create `components/layout/UserProfilePanel.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Role } from "@prisma/client";
import { getMyProfile, updateProfileImage } from "@/actions/profile";
import { formatDate } from "@/lib/utils";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  onClose: () => void;
}

export default function UserProfilePanel({ firstName, lastName, email, role, onClose }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyProfile().then(({ image, createdAt }) => {
      setImage(image);
      setCreatedAt(new Date(createdAt));
      setLoading(false);
    });
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("L'immagine supera il limite di 10 MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await updateProfileImage(dataUrl);
        setImage(dataUrl);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Errore durante il caricamento.";
        setUploadError(message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const initial = firstName.charAt(0).toUpperCase();
  const roleLabel = role === "ADMIN" ? "Amministratore" : "Dipendente";

  return (
    <>
      {/* Transparent overlay — closes panel on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed top-14 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-80 bg-card border border-border rounded-2xl shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-5 space-y-4">

          {/* Avatar + upload */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="Foto profilo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-primary">{initial}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
                aria-label="Cambia foto profilo"
              >
                {uploading ? (
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/svg+xml"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {uploadError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive text-center">
              {uploadError}
            </div>
          )}

          {/* User info */}
          <div className="space-y-3 pt-1">
            <InfoRow label="Nome" value={firstName} />
            <InfoRow label="Cognome" value={lastName} />
            <InfoRow label="Email" value={email} />
            <InfoRow label="Tipo account" value={roleLabel} />
            {loading ? (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Membro dal</span>
                <div className="h-4 w-24 bg-secondary animate-pulse rounded" />
              </div>
            ) : createdAt ? (
              <InfoRow label="Membro dal" value={formatDate(createdAt)} />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground break-all">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors in `components/layout/UserProfilePanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/layout/UserProfilePanel.tsx
git commit -m "feat: add UserProfilePanel floating component"
```

---

## Task 7: Create `UserProfileButton` component

**Files:**
- Create: `components/layout/UserProfileButton.tsx`

**Interfaces:**
- Consumes: `UserProfilePanel({ firstName, lastName, email, role, onClose })` from Task 6
- Produces: `UserProfileButton({ firstName, lastName, email, role })` — avatar button that toggles the panel

- [ ] **Step 1: Create `components/layout/UserProfileButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import UserProfilePanel from "./UserProfilePanel";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export default function UserProfileButton({ firstName, lastName, email, role }: Props) {
  const [open, setOpen] = useState(false);
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity"
        aria-label="Apri profilo utente"
        aria-expanded={open}
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-primary">{initial}</span>
        </div>
        <span className="text-sm font-medium text-foreground hidden md:block">
          {firstName} {lastName}
        </span>
      </button>

      {open && (
        <UserProfilePanel
          firstName={firstName}
          lastName={lastName}
          email={email}
          role={role}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors in the layout component files.

- [ ] **Step 3: Commit**

```bash
git add components/layout/UserProfileButton.tsx
git commit -m "feat: add UserProfileButton component"
```

---

## Task 8: Create `SharedHeader` component

**Files:**
- Create: `components/layout/SharedHeader.tsx`

**Interfaces:**
- Consumes: `UserProfileButton({ firstName, lastName, email, role })` from Task 7; Radix UI Dialog; `signOut` from next-auth/react
- Produces: `SharedHeader({ firstName, lastName, email, role })` — full-width header with title + bell + profile button

- [ ] **Step 1: Create `components/layout/SharedHeader.tsx`**

```tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, LogOut } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Role } from "@prisma/client";
import UserProfileButton from "./UserProfileButton";

const PAGE_TITLES: Record<string, string> = {
  "/calendar": "Calendario",
  "/customers": "Clienti",
  "/finance": "Dashboard Finanziaria",
  "/employees": "Gestione Dipendenti",
  "/settings": "Impostazioni",
};

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export default function SharedHeader({ firstName, lastName, email, role }: Props) {
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const title =
    Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? "";

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card px-4 flex items-center justify-between lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setConfirmOpen(true)}
          aria-label="Esci"
          className="lg:hidden p-1.5 rounded-md hover:bg-secondary"
        >
          <LogOut className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          aria-label="Notifiche"
        >
          <Bell className="w-4 h-4" />
        </button>
        <UserProfileButton
          firstName={firstName}
          lastName={lastName}
          email={email}
          role={role}
        />
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-card shadow-2xl border border-border focus:outline-none p-5">
            <Dialog.Title className="font-semibold text-foreground">
              Esci dall&apos;account?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mt-1">
              Dovrai effettuare nuovamente l&apos;accesso per continuare.
            </Dialog.Description>
            <div className="flex gap-2 pt-4">
              <Dialog.Close asChild>
                <button className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  Annulla
                </button>
              </Dialog.Close>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Esci
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors in all layout component files.

- [ ] **Step 3: Commit**

```bash
git add components/layout/SharedHeader.tsx
git commit -m "feat: add SharedHeader with pathname-based title and profile button"
```

---

## Task 9: Wire DashboardLayout + remove per-page Headers

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/(dashboard)/customers/page.tsx`
- Modify: `app/(dashboard)/finance/page.tsx`
- Modify: `app/(dashboard)/employees/page.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`
- Delete: `components/layout/Header.tsx`

**Interfaces:**
- Consumes: `SharedHeader({ firstName, lastName, email, role })` from Task 8; `SessionUser` from Task 2

- [ ] **Step 1: Update `app/(dashboard)/layout.tsx`**

Full replacement of the file:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import SharedHeader from "@/components/layout/SharedHeader";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={user.role} userName={`${user.firstName} ${user.lastName}`} />

      <div className="flex-1 flex flex-col min-w-0">
        <SharedHeader
          firstName={user.firstName}
          lastName={user.lastName}
          email={user.email}
          role={user.role as Role}
        />
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileNav role={user.role} />
    </div>
  );
}
```

- [ ] **Step 2: Remove Header from `app/(dashboard)/customers/page.tsx`**

Remove the line:
```tsx
import Header from "@/components/layout/Header";
```

Remove the `<Header title="Clienti" userName="" />` tag from the JSX.

- [ ] **Step 3: Remove Header from `app/(dashboard)/finance/page.tsx`**

Remove the line:
```tsx
import Header from "@/components/layout/Header";
```

Remove the `<Header title="Dashboard Finanziaria" userName="" />` tag from the JSX.

- [ ] **Step 4: Remove Header from `app/(dashboard)/employees/page.tsx`**

Remove the line:
```tsx
import Header from "@/components/layout/Header";
```

Remove the `<Header title="Gestione Dipendenti" userName="" />` tag from the JSX.

- [ ] **Step 5: Remove Header from `app/(dashboard)/settings/page.tsx`**

Remove the line:
```tsx
import Header from "@/components/layout/Header";
```

Remove the `<Header title="Impostazioni" userName="" />` tag from the JSX.

- [ ] **Step 6: Delete `components/layout/Header.tsx`**

```bash
rm components/layout/Header.tsx
```

- [ ] **Step 7: Full type-check and build**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: 0 errors.

```bash
npm run build
```

Expected: `✓ Compiled successfully` with no type errors.

- [ ] **Step 8: Verify in browser**

Start dev server:
```bash
npm run dev
```

Check:
- [ ] `/calendar` shows SharedHeader with title "Calendario" and user name/avatar top-right
- [ ] `/customers` shows SharedHeader with title "Clienti"
- [ ] `/finance` shows SharedHeader with title "Dashboard Finanziaria"
- [ ] `/employees` shows SharedHeader with title "Gestione Dipendenti"
- [ ] `/settings` shows SharedHeader with title "Impostazioni"
- [ ] Clicking avatar opens profile panel
- [ ] Panel shows Nome, Cognome, Email, Tipo account, Membro dal (after skeleton)
- [ ] Upload button accepts JPEG/PNG/SVG and updates the avatar in the panel
- [ ] On mobile: panel is full-width and scrollable
- [ ] Mobile logout button (top-left, `lg:hidden`) triggers confirm dialog

- [ ] **Step 9: Commit**

```bash
git add app/\(dashboard\)/layout.tsx app/\(dashboard\)/customers/page.tsx app/\(dashboard\)/finance/page.tsx app/\(dashboard\)/employees/page.tsx app/\(dashboard\)/settings/page.tsx
git rm components/layout/Header.tsx
git commit -m "feat: wire SharedHeader into DashboardLayout, remove per-page Header usage"
```

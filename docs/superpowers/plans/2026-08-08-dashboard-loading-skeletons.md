# Dashboard Loading Skeletons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every dashboard route (`/calendar`, `/customers`, `/employees`, `/finance`, `/settings`) open instantly with a layout-accurate skeleton instead of blocking navigation or flashing empty content, by converting client-side initial fetches to server-side fetches rendered behind route-level `loading.tsx` Suspense boundaries.

**Architecture:** Each `page.tsx` becomes an `async` Server Component that calls the existing "use server" data-reading action directly (no new queries, no new endpoints) and passes the result as props to a new `*Client.tsx` component holding all existing interactive/mutation logic unchanged. A sibling `loading.tsx` per route gives Next.js's automatic Suspense boundary a skeleton to show immediately on navigation, while `app/(dashboard)/layout.tsx` (Sidebar/MobileNav/SharedHeader) stays mounted throughout.

**Tech Stack:** Next.js 15 App Router (Server Components + `loading.tsx` streaming), React 19, existing Server Actions in `actions/`, Tailwind CSS (`animate-pulse` for skeletons), no new dependencies.

## Global Constraints

- No new npm dependencies.
- No changes to Server Actions, Prisma schema, `middleware.ts`, or auth — actions are only *called from a different place* (Server Component instead of client `useEffect`).
- Tailwind utility classes only, no inline `style`, no new CSS files (per CLAUDE.md).
- `Decimal`/`Date` objects crossing the Server → Client prop boundary must go through `JSON.parse(JSON.stringify(...))`, per CLAUDE.md and matching the existing `/calendar` pattern.
- File naming: PascalCase for component files, camelCase untouched for existing action files.
- No test framework exists in this repo (no jest/vitest, no `*.test.*` files) — verification per task is `npx tsc --noEmit`, `npm run lint`, and a manual browser checklist (the user will verify manually per their preference).
- Component files should stay focused; if a `*Client.tsx` exceeds ~150 lines it should be split further, per CLAUDE.md's "small, focused components" rule — flagged per task below where relevant.

---

### Task 1: Skeleton primitive + `/calendar` loading state

**Files:**
- Create: `components/ui/Skeleton.tsx`
- Create: `app/(dashboard)/calendar/loading.tsx`
- Test: manual (no data-flow changes in this task — `calendar/page.tsx` and `CalendarClient.tsx` are untouched)

**Interfaces:**
- Produces: `Skeleton({ className }: { className?: string })` — a single pulsing bar, used by every later task.

- [ ] **Step 1: Create the shared `Skeleton` primitive**

`components/ui/Skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-secondary", className)} />;
}
```

- [ ] **Step 2: Create `app/(dashboard)/calendar/loading.tsx`**

This mirrors the toolbar in `components/calendar/CalendarView.tsx` (lines 288-368) and a generic month-grid placeholder, so the page doesn't jump in height once real content replaces it.

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar skeleton — mirrors CalendarView's toolbar */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-card lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <div className="flex items-center gap-2 flex-1 justify-center lg:flex-none lg:justify-start">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 lg:ml-auto lg:justify-end">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Grid skeleton — generic month-view placeholder */}
      <div className="flex-1 overflow-hidden p-2">
        <div className="grid grid-cols-7 gap-1 h-full">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `Skeleton.tsx` or `calendar/loading.tsx`.

Run: `npm run lint`
Expected: no new errors (the pre-existing warnings in `finance/page.tsx`, `settings/page.tsx`, `lib/chartToImage.ts`, `lib/exportFinancePDF.ts` are unrelated and already present on `main`).

- [ ] **Step 4: Manual check**

Start the dev server (`npm run dev`), log in, and from any other dashboard page click "Calendario" in the Sidebar/MobileNav. Expected: the toolbar + grid skeleton appears immediately (even on a throttled connection via DevTools "Slow 3G"), then swaps to the real calendar once data loads — Sidebar/Header never disappear or flicker.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Skeleton.tsx "app/(dashboard)/calendar/loading.tsx"
git commit -m "feat: add Skeleton primitive and /calendar loading state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `/customers` — Server Component conversion + skeleton

**Files:**
- Modify: `components/customers/CustomerTable.tsx:24` (type fix, `createdAt: Date` → `createdAt: string`)
- Create: `components/customers/CustomersClient.tsx`
- Modify: `app/(dashboard)/customers/page.tsx` (becomes async Server Component)
- Create: `app/(dashboard)/customers/loading.tsx`

**Interfaces:**
- Consumes: `Skeleton` from Task 1 (`@/components/ui/Skeleton`); `getCustomers()` from `actions/customers.ts` (existing, unchanged — returns `Customer[]` with `_count: { appointments: number }` and `createdAt: Date`).
- Produces: `CustomersClient({ initialCustomers }: { initialCustomers: CustomerRecord[] })` where `CustomerRecord` matches `CustomerTable`'s `Customer` interface (with `createdAt: string`).

- [ ] **Step 1: Fix the `createdAt` type in `CustomerTable.tsx`**

`getCustomers()`'s result will now be passed through `JSON.parse(JSON.stringify(...))` before reaching the client (see Step 3), turning `createdAt` into an ISO string — same convention as `NotificationItem.createdAt` in `types/index.ts:67`.

In `components/customers/CustomerTable.tsx`, change:

```tsx
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  age: number | null;
  notes: string | null;
  createdAt: Date;
  _count: { appointments: number };
}
```

to:

```tsx
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  age: number | null;
  notes: string | null;
  createdAt: string; // ISO string — Prisma DateTime serialized for the client
  _count: { appointments: number };
}
```

No other change needed in this file — `formatDate()` (in `lib/utils.ts`) already accepts `Date | string`.

- [ ] **Step 2: Create `components/customers/CustomersClient.tsx`**

This is `app/(dashboard)/customers/page.tsx` today, unchanged except: the `customers` state is seeded from a prop instead of `[]`, and the initial `useEffect(() => { load() }, [])` is removed (data already arrived from the server). `load()` itself (used for post-mutation refresh) is untouched.

```tsx
"use client";

import { useState } from "react";
import { getCustomers } from "@/actions/customers";
import CustomerTable from "@/components/customers/CustomerTable";
import CustomerForm from "@/components/customers/CustomerForm";
import { Plus, Users } from "lucide-react";

interface CustomerRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  age: number | null;
  notes: string | null;
  createdAt: string;
  _count: { appointments: number };
}

interface Props {
  initialCustomers: CustomerRecord[];
}

export default function CustomersClient({ initialCustomers }: Props) {
  const [customers, setCustomers] = useState<any[]>(initialCustomers);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  async function load() {
    const data = await getCustomers();
    setCustomers(data);
  }

  function openCreate() {
    setEditingCustomer(null);
    setFormOpen(true);
  }

  function openEdit(c: any) {
    setEditingCustomer(c);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Anagrafica Clienti</h2>
              <p className="text-sm text-muted-foreground">{customers.length} clienti registrati</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuovo cliente
          </button>
        </div>

        <CustomerTable
          customers={customers}
          onEdit={openEdit}
          onRefresh={load}
        />
      </div>

      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editingCustomer}
        onSaved={load}
      />
    </div>
  );
}
```

Note: `getCustomers()`'s live return type has `createdAt: Date` (client refetch after a mutation returns real `Date` objects via the Server Action RPC channel, not the JSON round-trip used for the initial server-rendered prop) — `customers` is kept as `any[]` here (matching the original file) specifically because it mixes both shapes across its lifetime; `CustomerTable`'s own `Customer` interface (now `createdAt: string`) is what actually gets type-checked against `formatDate()`, and `formatDate` accepts both `Date | string`, so this remains type-safe end to end without over-constraining `customers`' state type.

- [ ] **Step 3: Convert `app/(dashboard)/customers/page.tsx` to a Server Component**

Replace the entire file with:

```tsx
import { getCustomers } from "@/actions/customers";
import CustomersClient from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return <CustomersClient initialCustomers={JSON.parse(JSON.stringify(customers))} />;
}
```

- [ ] **Step 4: Create `app/(dashboard)/customers/loading.tsx`**

Mirrors the header (icon + title + count line + button) and `CustomerTable`'s desktop table (5 columns: Cliente, Telefono, Email, Appuntamenti, actions) and mobile cards, so both breakpoints keep their final size.

```tsx
import { Skeleton } from "@/components/ui/Skeleton";
import { Users, Plus } from "lucide-react";

export default function CustomersLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary/40" />
            <div className="space-y-1.5">
              <h2 className="font-semibold text-foreground">Anagrafica Clienti</h2>
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/50 text-primary-foreground rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuovo cliente
          </button>
        </div>

        <Skeleton className="h-10 w-full rounded-lg" />

        {/* Table – Desktop */}
        <div className="hidden md:block rounded-xl border border-border overflow-hidden">
          <div className="bg-secondary h-11" />
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16 rounded-full" />
                <div className="ml-auto flex gap-1">
                  <Skeleton className="h-6 w-6 rounded-lg" />
                  <Skeleton className="h-6 w-6 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards – Mobile */}
        <div className="md:hidden space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors in `CustomerTable.tsx`, `CustomersClient.tsx`, `customers/page.tsx`, `customers/loading.tsx`.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Manual check**

Log in, navigate to another page, then click "Clienti". Expected: header + table/card skeleton appears immediately, then the real list replaces it with no layout jump. Create, edit, and delete a customer — all three should still work exactly as before (they call `load()` which re-fetches via the same `getCustomers()` Server Action as today).

- [ ] **Step 7: Commit**

```bash
git add components/customers/CustomerTable.tsx components/customers/CustomersClient.tsx "app/(dashboard)/customers/page.tsx" "app/(dashboard)/customers/loading.tsx"
git commit -m "feat: server-render /customers initial data with loading skeleton

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `/employees` — Server Component conversion + skeleton

**Files:**
- Modify: `components/employees/UserTable.tsx:13` (type fix, `createdAt: Date` → `createdAt: string`)
- Create: `components/employees/EmployeesClient.tsx`
- Modify: `app/(dashboard)/employees/page.tsx` (becomes async Server Component)
- Create: `app/(dashboard)/employees/loading.tsx`

**Interfaces:**
- Consumes: `Skeleton` from Task 1; `getAllUsers()`, `deleteUser()` from `actions/users.ts` (existing, unchanged).
- Produces: `EmployeesClient({ initialUsers }: { initialUsers: UserRecord[] })`.

- [ ] **Step 1: Fix the `createdAt` type in `UserTable.tsx`**

In `components/employees/UserTable.tsx`, change:

```tsx
export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  createdAt: Date;
}
```

to:

```tsx
export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  createdAt: string; // ISO string — Prisma DateTime serialized for the client
}
```

- [ ] **Step 2: Create `components/employees/EmployeesClient.tsx`**

Same body as today's `employees/page.tsx`, seeded from a prop instead of `[]`, initial `useEffect` removed.

```tsx
"use client";

import { useState } from "react";
import { getAllUsers, deleteUser } from "@/actions/users";
import { Plus, UserCog } from "lucide-react";
import UserTable, { UserRecord } from "@/components/employees/UserTable";
import UserModal from "@/components/employees/UserModal";

interface Props {
  initialUsers: UserRecord[];
}

export default function EmployeesClient({ initialUsers }: Props) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    const data = await getAllUsers();
    setUsers(data as UserRecord[]);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare l'account di ${name}?`)) return;
    setDeleteError(null);
    try {
      const result = await deleteUser(id);
      if (!result.success) {
        setDeleteError(result.error);
        return;
      }
      load();
    } catch {
      setDeleteError("Errore durante l'eliminazione. Riprova.");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {deleteError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {deleteError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Utenti del sistema</h2>
              <p className="text-sm text-muted-foreground">{users.length} account</p>
            </div>
          </div>
          <button onClick={() => { setEditingUser(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            Nuovo utente
          </button>
        </div>

        <UserTable
          users={users}
          onEdit={(u) => { setEditingUser(u); setModalOpen(true); }}
          onDelete={handleDelete}
        />
      </div>

      {modalOpen && (
        <UserModal
          user={editingUser}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Convert `app/(dashboard)/employees/page.tsx` to a Server Component**

Replace the entire file with:

```tsx
import { getAllUsers } from "@/actions/users";
import EmployeesClient from "@/components/employees/EmployeesClient";
import { UserRecord } from "@/components/employees/UserTable";

export default async function EmployeesPage() {
  const users = await getAllUsers();

  return <EmployeesClient initialUsers={JSON.parse(JSON.stringify(users)) as UserRecord[]} />;
}
```

- [ ] **Step 4: Create `app/(dashboard)/employees/loading.tsx`**

Mirrors `UserTable`'s desktop table (4 columns: Nome, Email, Ruolo, Registrato) and mobile cards.

```tsx
import { Skeleton } from "@/components/ui/Skeleton";
import { UserCog, Plus } from "lucide-react";

export default function EmployeesLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary/40" />
            <div className="space-y-1.5">
              <h2 className="font-semibold">Utenti del sistema</h2>
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <button disabled className="flex items-center gap-1.5 px-3 py-2 bg-primary/50 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            Nuovo utente
          </button>
        </div>

        {/* Table – Desktop */}
        <div className="hidden md:block rounded-xl border border-border overflow-hidden">
          <div className="bg-secondary h-11" />
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3.5 w-16" />
                <div className="ml-auto flex gap-1">
                  <Skeleton className="h-6 w-6 rounded-lg" />
                  <Skeleton className="h-6 w-6 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards – Mobile */}
        <div className="md:hidden space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors in `UserTable.tsx`, `EmployeesClient.tsx`, `employees/page.tsx`, `employees/loading.tsx`.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Manual check**

As an ADMIN user, navigate to "Dipendenti". Expected: skeleton appears immediately, then the real table/cards. Create, edit, and delete a user — unchanged behavior.

- [ ] **Step 7: Commit**

```bash
git add components/employees/UserTable.tsx components/employees/EmployeesClient.tsx "app/(dashboard)/employees/page.tsx" "app/(dashboard)/employees/loading.tsx"
git commit -m "feat: server-render /employees initial data with loading skeleton

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `/settings` — Server Component conversion + skeleton

**Files:**
- Create: `components/settings/SettingsClient.tsx`
- Modify: `app/(dashboard)/settings/page.tsx` (becomes async Server Component)
- Create: `app/(dashboard)/settings/loading.tsx`

**Interfaces:**
- Consumes: `Skeleton` from Task 1; `getServiceTypes()` from `actions/serviceTypes.ts` (existing, unchanged — already returns `defaultPrice` as a string, no `Decimal`/`Date` in the payload).
- Produces: `SettingsClient({ initialServiceTypes }: { initialServiceTypes: ServiceType[] })`.

- [ ] **Step 1: Create `components/settings/SettingsClient.tsx`**

Full body of today's `settings/page.tsx`, seeded from a prop, initial `useEffect` removed. The data-purge section is untouched (it never depended on `serviceTypes`).

```tsx
"use client";

import { useState } from "react";
import { Archive, Download, AlertTriangle, CheckCircle2, Scissors, Plus } from "lucide-react";
import { getServiceTypes } from "@/actions/serviceTypes";
import ServiceTypeList from "@/components/settings/ServiceTypeList";
import ServiceTypeForm from "@/components/settings/ServiceTypeForm";

interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
}

interface Props {
  initialServiceTypes: ServiceType[];
}

export default function SettingsClient({ initialServiceTypes }: Props) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>(initialServiceTypes);
  const [formOpen, setFormOpen] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null);

  async function loadServiceTypes() {
    const data = await getServiceTypes();
    setServiceTypes(data);
  }

  function openCreate() {
    setEditingServiceType(null);
    setFormOpen(true);
  }

  function openEdit(s: ServiceType) {
    setEditingServiceType(s);
    setFormOpen(true);
  }

  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: { filename: string; recordCount: number };
    error?: string;
  } | null>(null);

  async function handlePurge() {
    if (
      !confirm(
        `ATTENZIONE: Questa operazione eliminerà permanentemente gli appuntamenti più vecchi di ${months} mesi dopo averli esportati in ZIP.\n\nContinuare?`
      )
    )
      return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanMonths: months }),
      });

      if (!res.ok) {
        const err = await res.json();
        setResult({ error: err.error ?? "Errore sconosciuto" });
        return;
      }

      // Scarica il file ZIP
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "archive.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Leggi il recordCount dall'header
      const recordCount = parseInt(res.headers.get("X-Record-Count") ?? "0", 10);
      setResult({ success: { filename, recordCount } });
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 max-w-2xl">

        {/* ── Service Types ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Tipologie di Prestazioni</h3>
                <p className="text-sm text-muted-foreground">
                  Gestisci i servizi disponibili per gli appuntamenti
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuova prestazione</span>
            </button>
          </div>

          <div className="p-5">
            <ServiceTypeList
              serviceTypes={serviceTypes}
              onEdit={openEdit}
              onRefresh={loadServiceTypes}
            />
          </div>
        </div>

        {/* ── Data Purge ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900">
            <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Pulizia e Archiviazione Dati</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Esporta e cancella appuntamenti obsoleti per liberare spazio sul database
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 dark:bg-amber-950/40 dark:border-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Operazione irreversibile.</strong> I record verranno eliminati dal database dopo l'esportazione ZIP.
                Assicurati di salvare il file scaricato in un luogo sicuro.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Archivia appuntamenti più vecchi di:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">mesi fa</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Saranno archiviati tutti gli appuntamenti con data antecedente al {
                  new Date(
                    new Date().setMonth(new Date().getMonth() - months)
                  ).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
                }
              </p>
            </div>

            <button
              onClick={handlePurge}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {loading ? "Elaborazione in corso..." : "Esporta e cancella dati"}
            </button>

            {/* Result feedback */}
            {result?.success && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex gap-2 dark:bg-emerald-950/40 dark:border-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
                <div className="text-sm text-emerald-800 dark:text-emerald-300">
                  <p className="font-medium">Archiviazione completata</p>
                  <p>
                    {result.success.recordCount} appuntamenti esportati in{" "}
                    <span className="font-mono text-xs bg-emerald-100 px-1 rounded dark:bg-emerald-900/60 dark:text-emerald-200">
                      {result.success.filename}
                    </span>
                    {" "}e rimossi dal database.
                  </p>
                </div>
              </div>
            )}

            {result?.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{result.error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ServiceTypeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        serviceType={editingServiceType}
        onSaved={loadServiceTypes}
      />
    </div>
  );
}
```

- [ ] **Step 2: Convert `app/(dashboard)/settings/page.tsx` to a Server Component**

Replace the entire file with:

```tsx
import { getServiceTypes } from "@/actions/serviceTypes";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const serviceTypes = await getServiceTypes();

  return <SettingsClient initialServiceTypes={serviceTypes} />;
}
```

(No `JSON.parse(JSON.stringify(...))` needed here — `getServiceTypes()` already returns plain strings/ids only, no `Decimal`/`Date` fields.)

- [ ] **Step 3: Create `app/(dashboard)/settings/loading.tsx`**

Only the "Tipologie di Prestazioni" block depends on fetched data; the "Pulizia e Archiviazione Dati" block is static and is rendered in full (matches the design spec's explicit call-out).

```tsx
import { Skeleton } from "@/components/ui/Skeleton";
import { Archive, Download, AlertTriangle, Scissors, Plus } from "lucide-react";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 max-w-2xl">

        {/* ── Service Types (skeleton) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-primary/40" />
              <div>
                <h3 className="font-semibold text-foreground">Tipologie di Prestazioni</h3>
                <p className="text-sm text-muted-foreground">
                  Gestisci i servizi disponibili per gli appuntamenti
                </p>
              </div>
            </div>
            <button disabled className="flex items-center gap-1.5 px-3 py-2 bg-primary/50 text-primary-foreground rounded-lg text-sm font-medium shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuova prestazione</span>
            </button>
          </div>

          <div className="p-5 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="hidden md:block rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary h-11" />
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <div className="ml-auto flex gap-1">
                      <Skeleton className="h-6 w-6 rounded-lg" />
                      <Skeleton className="h-6 w-6 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:hidden space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Data Purge (static, rendered in full — doesn't depend on fetched data) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900">
            <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Pulizia e Archiviazione Dati</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Esporta e cancella appuntamenti obsoleti per liberare spazio sul database
              </p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 dark:bg-amber-950/40 dark:border-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Operazione irreversibile.</strong> I record verranno eliminati dal database dopo l'esportazione ZIP.
                Assicurati di salvare il file scaricato in un luogo sicuro.
              </p>
            </div>
            <button disabled className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/50 text-white rounded-lg text-sm font-medium">
              <Download className="w-4 h-4" />
              Esporta e cancella dati
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors in `SettingsClient.tsx`, `settings/page.tsx`, `settings/loading.tsx`.

Run: `npm run lint`
Expected: no new errors (the pre-existing `react/no-unescaped-entities` warning at `settings/page.tsx:141` will move — verify it now points at the equivalent line inside `SettingsClient.tsx` instead of vanishing silently, since that's expected, not a regression).

- [ ] **Step 5: Manual check**

As ADMIN, navigate to "Impostazioni". Expected: "Pulizia e Archiviazione Dati" is visible immediately (never skeletoned), "Tipologie di Prestazioni" shows a skeleton briefly then the real list. Create/edit/delete a service type — unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/settings/SettingsClient.tsx "app/(dashboard)/settings/page.tsx" "app/(dashboard)/settings/loading.tsx"
git commit -m "feat: server-render /settings initial data with loading skeleton

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `/finance` — Server Component conversion + skeleton

**Files:**
- Create: `components/finance/FinanceClient.tsx`
- Modify: `app/(dashboard)/finance/page.tsx` (becomes async Server Component)
- Create: `app/(dashboard)/finance/loading.tsx`

**Interfaces:**
- Consumes: `Skeleton` from Task 1; `getFinancialSummary(from, to)`, `getExpenses(from, to)`, `createExpense()`, `deleteExpense()` from `actions/expenses.ts`; `getServiceTypes()` from `actions/serviceTypes.ts` (all existing, unchanged).
- Produces: `FinanceClient({ initialData, initialExpenses, initialServiceTypes }: { initialData: FinancialData; initialExpenses: ExpenseRecord[]; initialServiceTypes: { id: string; name: string }[] })`.

This is the largest of the four client-fetch pages (530 lines today). Per CLAUDE.md's "small, focused components" rule, `StatCard` and `AddExpenseModal` (currently defined inline in `finance/page.tsx`) move into their own files as part of this task, instead of being copy-pasted again into `FinanceClient.tsx` — this also means the file that changes together (the filter/KPI/table shell) stays isolated from the two general-purpose pieces.

- [ ] **Step 1: Extract `StatCard` into its own file**

Create `components/finance/StatCard.tsx`:

```tsx
export function StatCard({ label, value, icon: Icon, trend }: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`p-2 rounded-lg ${
          trend === "up" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" :
          trend === "down" ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400" :
          "bg-secondary text-muted-foreground"
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Extract `AddExpenseModal` into its own file**

Create `components/finance/AddExpenseModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { createExpense } from "@/actions/expenses";
import { ExpenseCategory } from "@prisma/client";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "AFFITTO", "UTENZE", "MATERIALI", "PERSONALE", "MARKETING", "MANUTENZIONE", "ALTRO",
];

export function AddExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("ALTRO");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await createExpense({
        amount: parseFloat(amount),
        description,
        category,
        date: new Date(date).toISOString(),
      });
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
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-card shadow-2xl border border-border focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold">Nuova spesa</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Importo (€) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Descrizione *</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary">
                Annulla
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50">
                {loading ? "..." : "Aggiungi"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Create `components/finance/FinanceClient.tsx`**

Same logic as today's `finance/page.tsx` main component, with three changes: (1) imports `StatCard`/`AddExpenseModal` from their new files instead of defining them inline, (2) `data`/`expenses`/`serviceTypes` state seeded from props, (3) the two initial-mount `useEffect`s are removed (the first one — fetching on `[dateFrom, dateTo]` — is **kept**, since it's also what re-fetches on filter changes, not just on mount; only the `useEffect(() => { getServiceTypes().then(setServiceTypes) }, [])` mount-only effect is removed).

```tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval } from "date-fns";
import { it } from "date-fns/locale";
import { getFinancialSummary, getExpenses, deleteExpense } from "@/actions/expenses";
import { StatCard } from "@/components/finance/StatCard";
import { AddExpenseModal } from "@/components/finance/AddExpenseModal";
import FinancialChart from "@/components/finance/FinancialChart";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Filter,
  Trash2,
  X,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialData {
  appointments: { startTime: string; price: string; serviceType: string }[];
  expenses: { date: string; amount: string; category: string }[];
}

interface ExpenseRecord {
  id: string;
  amount: string;
  description: string;
  category: string;
  date: string;
}

type Granularity = "day" | "month";

// ─── Main Client Component ─────────────────────────────────────────────────────

interface Props {
  initialData: FinancialData;
  initialExpenses: ExpenseRecord[];
  initialServiceTypes: { id: string; name: string }[];
}

export default function FinanceClient({ initialData, initialExpenses, initialServiceTypes }: Props) {
  const [data, setData] = useState<FinancialData>(initialData);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses);
  const [serviceTypes] = useState<{ id: string; name: string }[]>(initialServiceTypes);
  const [loading, startTransition] = useTransition();

  // Filters
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [serviceFilter, setServiceFilter] = useState("Tutti");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [exportingMonth, setExportingMonth] = useState(false);
  const [exportingYear, setExportingYear] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<"month" | "year" | null>(null);
  const [isFirstRender, setIsFirstRender] = useState(true);

  async function loadData() {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    const [fin, exp] = await Promise.all([
      getFinancialSummary(from, to),
      getExpenses(from, to),
    ]);
    setData(fin);
    setExpenses(exp as ExpenseRecord[]);
  }

  useEffect(() => {
    // Skip the redundant fetch on mount — initialData/initialExpenses already
    // cover the default range (this month), fetched server-side.
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }
    startTransition(() => { loadData(); });
  }, [dateFrom, dateTo]);

  // ── Compute chart data ──────────────────────────────────────────────────────

  const chartData = (() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    const filteredApts = serviceFilter === "Tutti"
      ? data.appointments
      : data.appointments.filter((a) => a.serviceType === serviceFilter);

    if (granularity === "day") {
      const days = eachDayOfInterval({ start: from, end: to });
      return days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const entrate = filteredApts
          .filter((a) => format(new Date(a.startTime), "yyyy-MM-dd") === dayStr)
          .reduce((sum, a) => sum + parseFloat(a.price), 0);
        const uscite = data.expenses
          .filter((e) => format(new Date(e.date), "yyyy-MM-dd") === dayStr)
          .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        return { label: format(day, "d/M"), entrate, uscite, profitto: entrate - uscite };
      });
    } else {
      const months = eachMonthOfInterval({ start: from, end: to });
      return months.map((month) => {
        const monthStr = format(month, "yyyy-MM");
        const entrate = filteredApts
          .filter((a) => format(new Date(a.startTime), "yyyy-MM") === monthStr)
          .reduce((sum, a) => sum + parseFloat(a.price), 0);
        const uscite = data.expenses
          .filter((e) => format(new Date(e.date), "yyyy-MM") === monthStr)
          .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        return { label: format(month, "MMM yy", { locale: it }), entrate, uscite, profitto: entrate - uscite };
      });
    }
  })();

  // ── KPI totals ──────────────────────────────────────────────────────────────

  const totaleEntrate = chartData.reduce((s, d) => s + d.entrate, 0);
  const totaleUscite = chartData.reduce((s, d) => s + d.uscite, 0);
  const profittoNetto = totaleEntrate - totaleUscite;

  // ── Quick date presets ──────────────────────────────────────────────────────

  const presets: { label: string; id: "month" | "year"; fn: () => void }[] = [
    {
      label: "Questo mese",
      id: "month",
      fn: () => {
        setDateFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(new Date()), "yyyy-MM-dd"));
        setGranularity("day");
        setActivePreset("month");
      },
    },
    {
      label: "Quest'anno",
      id: "year",
      fn: () => {
        setDateFrom(format(startOfYear(new Date()), "yyyy-MM-dd"));
        setDateTo(format(endOfYear(new Date()), "yyyy-MM-dd"));
        setGranularity("month");
        setActivePreset("year");
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-5">

        {/* ── Filters bar ── */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filtri
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setActivePreset(null); }}
                className="w-full min-w-0 sm:w-auto px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="hidden sm:inline text-muted-foreground text-sm">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setActivePreset(null); }}
                className="w-full min-w-0 sm:w-auto px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full lg:w-auto px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {["Tutti", ...serviceTypes.map((s) => s.name)].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="flex items-center rounded-lg border border-border overflow-hidden w-full lg:w-auto">
              <button
                onClick={() => setGranularity("day")}
                className={`flex-1 lg:flex-none px-3 py-1.5 text-sm font-medium transition-colors ${granularity === "day" ? "bg-primary text-white" : "hover:bg-secondary"}`}
              >
                Giornaliero
              </button>
              <button
                onClick={() => setGranularity("month")}
                className={`flex-1 lg:flex-none px-3 py-1.5 text-sm font-medium transition-colors ${granularity === "month" ? "bg-primary text-white" : "hover:bg-secondary"}`}
              >
                Mensile
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:flex lg:gap-3">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={p.fn}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    activePreset === p.id
                      ? "bg-primary text-white border-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-1 lg:border-t-0 lg:pt-0 lg:flex lg:gap-3">
              <button
                onClick={async () => {
                  setExportError(null);
                  setExportingMonth(true);
                  try {
                    const { exportFinancePDF } = await import("@/lib/exportFinancePDF");
                    await exportFinancePDF("month");
                  } catch (e) {
                    setExportError(e instanceof Error ? e.message : "Errore durante l'export. Riprova.");
                  } finally {
                    setExportingMonth(false);
                  }
                }}
                disabled={exportingMonth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {exportingMonth ? "..." : "Esporta mese"}
              </button>

              <button
                onClick={async () => {
                  setExportError(null);
                  setExportingYear(true);
                  try {
                    const { exportFinancePDF } = await import("@/lib/exportFinancePDF");
                    await exportFinancePDF("year");
                  } catch (e) {
                    setExportError(e instanceof Error ? e.message : "Errore durante l'export. Riprova.");
                  } finally {
                    setExportingYear(false);
                  }
                }}
                disabled={exportingYear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {exportingYear ? "..." : "Esporta anno"}
              </button>
            </div>
          </div>

          {exportError !== null && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-center justify-between gap-2">
              <span>{exportError}</span>
              <button
                onClick={() => setExportError(null)}
                aria-label="Chiudi errore"
                className="shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Entrate totali" value={formatCurrency(totaleEntrate)} icon={TrendingUp} trend="up" />
          <StatCard label="Uscite totali" value={formatCurrency(totaleUscite)} icon={TrendingDown} trend="down" />
          <StatCard
            label="Profitto netto"
            value={formatCurrency(profittoNetto)}
            icon={DollarSign}
            trend={profittoNetto >= 0 ? "up" : "down"}
          />
        </div>

        {/* ── Chart ── */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4">
            Entrate vs Uscite
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({granularity === "day" ? "giornaliero" : "mensile"})
            </span>
          </h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Caricamento...
            </div>
          ) : (
            <FinancialChart data={chartData} granularity={granularity} />
          )}
        </div>

        {/* ── Expenses table ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Spese del periodo</h3>
            <button
              onClick={() => setAddExpenseOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Aggiungi spesa
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Descrizione</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Categoria</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Importo</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {format(new Date(e.date), "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-2.5">{e.description}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded-full">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">
                      -{formatCurrency(parseFloat(e.amount))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm("Eliminare questa spesa?")) return;
                          await deleteExpense(e.id);
                          loadData();
                        }}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        aria-label={`Elimina spesa: ${e.description}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Nessuna spesa registrata nel periodo
                    </td>
                  </tr>
                )}
              </tbody>
              {expenses.length > 0 && (
                <tfoot className="border-t border-border bg-secondary">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 font-semibold text-sm">Totale</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                      -{formatCurrency(expenses.reduce((s, e) => s + parseFloat(e.amount), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {addExpenseOpen && (
        <AddExpenseModal
          onClose={() => setAddExpenseOpen(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
```

Note on the `isFirstRender` guard: today's `useEffect(() => { startTransition(() => { loadData() }) }, [dateFrom, dateTo])` runs on mount too (empty-array semantics don't apply — it depends on `[dateFrom, dateTo]`, which are set on first render, so the effect always fires once on mount in the current code). Since the server already fetched the same default range, firing it again on mount would be a wasted duplicate request the instant the page loads — the `isFirstRender` flag skips exactly that one redundant call while preserving every subsequent filter-change fetch unchanged.

- [ ] **Step 4: Convert `app/(dashboard)/finance/page.tsx` to a Server Component**

Replace the entire file with:

```tsx
import { startOfMonth, endOfMonth } from "date-fns";
import { getFinancialSummary, getExpenses } from "@/actions/expenses";
import { getServiceTypes } from "@/actions/serviceTypes";
import FinanceClient from "@/components/finance/FinanceClient";

export default async function FinancePage() {
  const from = startOfMonth(new Date());
  const to = endOfMonth(new Date());
  to.setHours(23, 59, 59, 999);

  const [financialData, expenses, serviceTypes] = await Promise.all([
    getFinancialSummary(from, to),
    getExpenses(from, to),
    getServiceTypes(),
  ]);

  return (
    <FinanceClient
      initialData={financialData}
      initialExpenses={expenses}
      initialServiceTypes={serviceTypes.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
```

(No `JSON.parse(JSON.stringify(...))` needed — `getFinancialSummary`/`getExpenses` already return only strings/ISO dates, `getServiceTypes` too.)

- [ ] **Step 5: Create `app/(dashboard)/finance/loading.tsx`**

Filters bar is static-shaped (doesn't depend on fetched data, other than the service-type `<select>`, which shows just "Tutti" while loading) — still gets a skeleton because it's part of the same suspended segment, matching the design spec's accepted trade-off (nested Suspense is out of scope for now).

```tsx
import { Skeleton } from "@/components/ui/Skeleton";
import { Filter, TrendingUp, TrendingDown, DollarSign, Plus } from "lucide-react";

export default function FinanceLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-5">

        {/* Filters bar */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filtri
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <Skeleton className="h-8 w-full sm:w-64 rounded-lg" />
            <Skeleton className="h-8 w-full lg:w-40 rounded-lg" />
            <Skeleton className="h-8 w-full lg:w-48 rounded-lg" />
            <Skeleton className="h-8 w-full lg:w-56 rounded-lg" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[TrendingUp, TrendingDown, DollarSign].map((Icon, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Icon className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-card rounded-xl border border-border p-4">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>

        {/* Expenses table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Spese del periodo</h3>
            <button disabled className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/50 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
              Aggiungi spesa
            </button>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Delete the dead code left in `finance/page.tsx`'s old location**

Confirm `StatCard` and `AddExpenseModal` no longer exist anywhere except their new files — they were fully removed as part of Step 4's full-file replacement, this step is just the double-check.

Run: `grep -rn "function StatCard\|function AddExpenseModal" app/ components/`
Expected: only `components/finance/StatCard.tsx` and `components/finance/AddExpenseModal.tsx` match.

- [ ] **Step 7: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors in `StatCard.tsx`, `AddExpenseModal.tsx`, `FinanceClient.tsx`, `finance/page.tsx`, `finance/loading.tsx`.

Run: `npm run lint`
Expected: the pre-existing `react-hooks/exhaustive-deps` warning (today at `finance/page.tsx:214`) should still exist, now inside `FinanceClient.tsx`, referring to the same `useEffect`. No *new* warnings/errors beyond that.

- [ ] **Step 8: Manual check**

As ADMIN, navigate to "Finanza". Expected: skeleton appears immediately, then filters/KPI/chart/table populate with the current month's data (matching what today's page shows after its initial fetch). Change date range, granularity, service filter, add/delete an expense, and use both PDF export buttons — all should work exactly as before. Confirm the Network tab shows no duplicate `getFinancialSummary`/`getExpenses` call firing immediately on page load (only on an actual filter change).

- [ ] **Step 9: Commit**

```bash
git add components/finance/StatCard.tsx components/finance/AddExpenseModal.tsx components/finance/FinanceClient.tsx "app/(dashboard)/finance/page.tsx" "app/(dashboard)/finance/loading.tsx"
git commit -m "feat: server-render /finance initial data with loading skeleton

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Full-project verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors anywhere in the project.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: only the four pre-existing warnings/errors that were already present on `main` before this plan (`finance` hook dependency warning, `settings` unescaped entity, two `lib/*.ts` `no-explicit-any` errors) — no new ones.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds. This also statically verifies every new `loading.tsx`/`page.tsx` pair compiles as valid Server/Client Components (a Client Component accidentally imported into a Server Component without `"use client"` boundaries fails the build, not just lint).

- [ ] **Step 4: Full manual walkthrough**

Log in and, for each of `/calendar`, `/customers`, `/employees`, `/finance`, `/settings`:
1. Navigate to it from the Sidebar (desktop) and from MobileNav (resize to mobile width or use device toolbar).
2. Confirm the skeleton appears immediately and matches the final content's layout (no visible height/width jump when real content swaps in).
3. Confirm Sidebar/MobileNav/SharedHeader never flicker or remount during the transition.
4. Exercise at least one mutation per page (create/edit/delete) and confirm it still works and refreshes the list.

- [ ] **Step 5: Merge decision**

This is the last task — hand off to the `superpowers:finishing-a-development-branch` skill to decide how to integrate `feat/dashboard-loading-skeletons` (the design spec was committed there in the brainstorming phase; all task commits from this plan land on the same branch).

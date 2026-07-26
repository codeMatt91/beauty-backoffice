# Service Types Settings Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded, duplicated `SERVICE_TYPES`/`SERVICE_FILTERS` arrays with an admin-manageable `ServiceType` catalog, exposed via a new CRUD section on `/settings`, and consumed by the calendar's appointment modal and the finance filter.

**Architecture:** A new denormalized `ServiceType` Prisma model (no FK from `Appointment`) backs a small CRUD Server Actions module (`actions/serviceTypes.ts`), a settings-page UI built by copying the existing `CustomerTable`/`CustomerForm` pattern, and two call-site swaps (`AppointmentModal.tsx`, `finance/page.tsx`) that replace their hardcoded arrays with a `getServiceTypes()` fetch.

**Tech Stack:** Next.js 15 Server Actions, Prisma 6 / Postgres, Zod, Radix UI Dialog, Tailwind CSS, lucide-react icons.

## Global Constraints

- `Appointment.serviceType` stays a plain `String` — no foreign key, no migration of existing appointment data. (spec Decisions)
- All service-type mutations (create/update/delete) must call `requireAdmin()`; the read (`getServiceTypes`) must call only `requireAuth()` so non-admin `EMPLOYEE` users can still use it from `/calendar`. (spec Decisions, CLAUDE.md security rules)
- Every mutating Server Action must call `revalidatePath` for `/settings`, `/calendar`, and `/finance`. (spec Section 2, CLAUDE.md Vercel/React best practices)
- No test framework exists in this repo (no jest/vitest, no `test` npm script) — verification is `npx tsc --noEmit`, `npm run lint`, and manual runs against the dev server, per established project convention.
- UI must reuse the exact Tailwind classes/breakpoints already used in `components/customers/CustomerTable.tsx` and `CustomerForm.tsx` (`hidden md:block` table / `md:hidden` cards, same modal shell) — no new visual patterns. (spec Decisions)
- "Altro" is seeded as an ordinary row — not specially protected in code or UI. (spec Decisions)

---

### Task 1: Database schema, migration, and seed data

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_service_types/migration.sql` (generated, then hand-edited)

**Interfaces:**
- Produces: Postgres table `service_types` (columns: `id text primary key`, `name text unique not null`, `created_at timestamp not null default now()`), pre-populated with 10 rows, and the corresponding Prisma model `ServiceType { id: String, name: String, createdAt: DateTime }` available to later tasks via `prisma.serviceType`.

- [ ] **Step 1: Add the `ServiceType` model to the schema**

Open `prisma/schema.prisma`. Immediately after the closing `}` of `model Customer` (the model ends at line 82, right before `model Appointment {` on line 84), insert:

```prisma
model ServiceType {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")

  @@map("service_types")
}

```

(Placement isn't load-bearing — anywhere at the top level of the file is fine — but keeping it near `Customer`/`Appointment`, which it conceptually relates to, matches how this file is already organized.)

- [ ] **Step 2: Generate the migration SQL without applying it**

```bash
npx prisma migrate dev --create-only --name add_service_types
```

This creates `prisma/migrations/<timestamp>_add_service_types/migration.sql` containing a `CREATE TABLE "service_types" (...)` statement, but does not run it yet.

- [ ] **Step 3: Append seed data to the generated migration file**

Open the newly created `migration.sql` file and append this block after the `CREATE TABLE` statement (and after any `CREATE UNIQUE INDEX` statements Prisma generated alongside it — leave those untouched, just add this at the end of the file):

```sql
-- Seed the 10 service types that were previously hardcoded in
-- components/calendar/AppointmentModal.tsx and app/(dashboard)/finance/page.tsx,
-- so existing behavior is unchanged immediately after this migration runs.
INSERT INTO "service_types" ("id", "name", "created_at") VALUES
  (md5(random()::text || clock_timestamp()::text), 'Pulizia viso', now()),
  (md5(random()::text || clock_timestamp()::text), 'Massaggio rilassante', now()),
  (md5(random()::text || clock_timestamp()::text), 'Trattamento corpo', now()),
  (md5(random()::text || clock_timestamp()::text), 'Manicure', now()),
  (md5(random()::text || clock_timestamp()::text), 'Pedicure', now()),
  (md5(random()::text || clock_timestamp()::text), 'Ceretta', now()),
  (md5(random()::text || clock_timestamp()::text), 'Laser', now()),
  (md5(random()::text || clock_timestamp()::text), 'Radiofrequenza', now()),
  (md5(random()::text || clock_timestamp()::text), 'Pressoterapia', now()),
  (md5(random()::text || clock_timestamp()::text), 'Altro', now())
ON CONFLICT ("name") DO NOTHING;
```

`md5(random()::text || clock_timestamp()::text)` generates a unique-enough string id using only built-in Postgres functions (no `pgcrypto`/`uuid-ossp` extension dependency, since extension availability on the Vercel Postgres free tier shouldn't be assumed). `ON CONFLICT ("name") DO NOTHING` makes this block safe to re-run (matches the idempotent-`upsert` spirit of `prisma/seed.ts` elsewhere in this repo).

- [ ] **Step 4: Apply the migration locally**

```bash
npx prisma migrate dev
```

Expected output: `Applying migration <timestamp>_add_service_types` followed by success, and `✔ Generated Prisma Client`.

- [ ] **Step 5: Verify the table and seed data**

Create a temporary file at the repo root (tsx needs a real file — not `-e` — to reliably resolve `@/`-style and relative imports against this project's `tsconfig.json`):

```bash
cat > .tmp-verify-service-types.ts <<'EOF'
import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.serviceType.findMany({ orderBy: { name: "asc" } });
  console.log(rows.length, "rows");
  console.log(rows.map((r) => r.name));
  process.exit(0);
}
main();
EOF
npx tsx .tmp-verify-service-types.ts
rm .tmp-verify-service-types.ts
```

Expected: `10 rows` and the array contains exactly `['Ceretta', 'Laser', 'Manicure', 'Massaggio rilassante', 'Pedicure', 'Pressoterapia', 'Pulizia viso', 'Radiofrequenza', 'Trattamento corpo', 'Altro']` (in that alphabetical order — note 'Altro' sorts after 'Trattamento corpo' alphabetically, that's expected). Make sure the temporary file is deleted afterward — confirm with `git status` that it doesn't show up as untracked before committing this task.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ServiceType model with seeded default service types"
```

---

### Task 2: Server Actions for service type CRUD

**Files:**
- Create: `actions/serviceTypes.ts`

**Interfaces:**
- Consumes: `prisma.serviceType` (from Task 1), `requireAuth`/`requireAdmin` from `@/lib/auth`, `ActionResult`/`zodErrorToMessage` from `@/lib/actionResult` (existing, unchanged).
- Produces (used by Tasks 3, 4, 5):
  - `getServiceTypes(): Promise<{id: string; name: string; createdAt: Date}[]>`
  - `createServiceType(data: {name: string}): Promise<ActionResult>`
  - `updateServiceType(id: string, data: {name: string}): Promise<ActionResult>`
  - `deleteServiceType(id: string): Promise<ActionResult>`

- [ ] **Step 1: Write `actions/serviceTypes.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ActionResult, zodErrorToMessage } from "@/lib/actionResult";

const serviceTypeSchema = z.object({
  name: z.string().min(2, "Il nome è obbligatorio (min. 2 caratteri).").max(50, "Il nome è troppo lungo."),
});

export async function getServiceTypes() {
  await requireAuth();
  return prisma.serviceType.findMany({ orderBy: { name: "asc" } });
}

export async function createServiceType(data: z.infer<typeof serviceTypeSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = serviceTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const existing = await prisma.serviceType.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { success: false, error: "Esiste già una prestazione con questo nome." };

  await prisma.serviceType.create({ data: parsed.data });
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  return { success: true, data: null };
}

export async function updateServiceType(id: string, data: z.infer<typeof serviceTypeSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = serviceTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const existing = await prisma.serviceType.findUnique({ where: { name: parsed.data.name } });
  if (existing && existing.id !== id) return { success: false, error: "Esiste già una prestazione con questo nome." };

  await prisma.serviceType.update({ where: { id }, data: parsed.data });
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  return { success: true, data: null };
}

export async function deleteServiceType(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.serviceType.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  return { success: true, data: null };
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `actions/serviceTypes.ts`.

- [ ] **Step 3: Verify the underlying Prisma queries directly**

`getServiceTypes`/`createServiceType`/`updateServiceType`/`deleteServiceType` all call `requireAuth()`/`requireAdmin()` first, which read the current request's session via Next.js's request-scoped `headers()`/`cookies()` — that context doesn't exist when a function is invoked from a plain script, so calling the exported actions directly outside a real HTTP request is not a reliable way to test them here (unlike `actions/passwordReset.ts`'s `requestPasswordReset`/`resetPassword`, which deliberately skip `requireAuth()` since they're pre-auth flows). Instead, verify the Prisma-level behavior the actions build on — the unique-name constraint — directly:

```bash
cat > .tmp-verify-service-types-crud.ts <<'EOF'
import { prisma } from "@/lib/prisma";

async function main() {
  const before = await prisma.serviceType.count();

  const created = await prisma.serviceType.create({ data: { name: "Test Verifica Plan" } });
  console.log("created:", created.name);

  try {
    await prisma.serviceType.create({ data: { name: "Test Verifica Plan" } });
    console.log("duplicate insert: DID NOT throw (unexpected)");
  } catch (err: any) {
    console.log("duplicate insert correctly rejected:", err.code === "P2002");
  }

  const updated = await prisma.serviceType.update({
    where: { id: created.id },
    data: { name: "Test Verifica Plan (rinominato)" },
  });
  console.log("updated:", updated.name);

  await prisma.serviceType.delete({ where: { id: created.id } });
  const after = await prisma.serviceType.count();
  console.log("count matches before:", after === before);
  process.exit(0);
}
main();
EOF
npx tsx .tmp-verify-service-types-crud.ts
rm .tmp-verify-service-types-crud.ts
```

Expected: `created: Test Verifica Plan`, `duplicate insert correctly rejected: true` (Prisma error code `P2002` = unique constraint violation, confirming the `@unique` on `name` from Task 1 works), `updated: Test Verifica Plan (rinominato)`, `count matches before: true`. This confirms the data layer the actions rely on behaves correctly; the actions' own `requireAuth()`/`requireAdmin()` gating and duplicate-name error message are verified end-to-end through the real app in Task 3 Step 6, where a logged-in ADMIN session actually exists.

- [ ] **Step 4: Commit**

```bash
git add actions/serviceTypes.ts
git commit -m "feat: add service type CRUD server actions"
```

---

### Task 3: Settings UI — list, form, and page wiring

**Files:**
- Create: `components/settings/ServiceTypeList.tsx`
- Create: `components/settings/ServiceTypeForm.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `getServiceTypes`, `createServiceType`, `updateServiceType`, `deleteServiceType` from `@/actions/serviceTypes` (Task 2).
- Produces: `ServiceTypeList` (props `{ serviceTypes: {id:string;name:string}[]; onEdit: (s: {id:string;name:string}) => void; onRefresh: () => void }`) and `ServiceTypeForm` (props `{ open: boolean; onClose: () => void; serviceType?: {id:string;name:string} | null; onSaved: () => void }`), both default exports, consumed only by `app/(dashboard)/settings/page.tsx` in this plan.

- [ ] **Step 1: Write `components/settings/ServiceTypeList.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Pencil, Trash2, Search } from "lucide-react";
import { deleteServiceType } from "@/actions/serviceTypes";

interface ServiceType {
  id: string;
  name: string;
}

interface Props {
  serviceTypes: ServiceType[];
  onEdit: (s: ServiceType) => void;
  onRefresh: () => void;
}

export default function ServiceTypeList({ serviceTypes, onEdit, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = serviceTypes.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Eliminare la prestazione "${name}"? Gli appuntamenti esistenti non verranno modificati.`
      )
    )
      return;
    setDeleting(id);
    try {
      await deleteServiceType(id);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  const emptyMessage = serviceTypes.length === 0 ? "Nessuna prestazione configurata" : "Nessuna prestazione trovata";

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cerca prestazione..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table – Desktop */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Nome
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onEdit(s)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      aria-label={`Modifica ${s.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deleting === s.id}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
                      aria-label={`Elimina ${s.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Cards – Mobile/Tablet */}
      <div className="md:hidden space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">{s.name}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(s)}
                  className="p-2 rounded-lg hover:bg-secondary"
                  aria-label={`Modifica ${s.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                  aria-label={`Elimina ${s.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/settings/ServiceTypeForm.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { createServiceType, updateServiceType } from "@/actions/serviceTypes";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  serviceType?: ServiceType | null;
  onSaved: () => void;
}

export default function ServiceTypeForm({ open, onClose, serviceType, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(serviceType?.name ?? "");
  }, [open, serviceType]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = serviceType
        ? await updateServiceType(serviceType.id, { name })
        : await createServiceType({ name });
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
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl border border-border focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold text-foreground">
              {serviceType ? "Modifica prestazione" : "Nuova prestazione"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="serviceTypeName">Nome *</label>
              <input
                id="serviceTypeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Es. Manicure"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Salvataggio..." : serviceType ? "Aggiorna" : "Crea"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Wire both components into `app/(dashboard)/settings/page.tsx`**

The current file starts like this:

```tsx
"use client";

import { useState } from "react";
import { Archive, Download, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [months, setMonths] = useState(12);
```

Replace that opening block with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Archive, Download, AlertTriangle, CheckCircle2, Scissors, Plus } from "lucide-react";
import { getServiceTypes } from "@/actions/serviceTypes";
import ServiceTypeList from "@/components/settings/ServiceTypeList";
import ServiceTypeForm from "@/components/settings/ServiceTypeForm";

interface ServiceType {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null);

  async function loadServiceTypes() {
    const data = await getServiceTypes();
    setServiceTypes(data);
  }

  useEffect(() => { loadServiceTypes(); }, []);

  function openCreate() {
    setEditingServiceType(null);
    setFormOpen(true);
  }

  function openEdit(s: ServiceType) {
    setEditingServiceType(s);
    setFormOpen(true);
  }

  const [months, setMonths] = useState(12);
```

(The rest of the existing function body — `loading`, `result`, `handlePurge` — stays exactly as-is, just now preceded by the new state/handlers above it.)

Next, find this exact block near the end of the file:

```tsx
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 max-w-2xl">

        {/* ── Data Purge ── */}
```

Replace it with:

```tsx
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
```

Finally, find the closing of the component's returned JSX:

```tsx
        </div>
      </div>
    </div>
  );
}
```

Replace it with:

```tsx
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

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors/new warnings from `app/(dashboard)/settings/page.tsx`, `components/settings/ServiceTypeList.tsx`, or `components/settings/ServiceTypeForm.tsx`.

- [ ] **Step 5: Start the dev server if it isn't already running**

```bash
lsof -i :3000 -sTCP:LISTEN || (npm run dev > /tmp/beauty-dev.log 2>&1 & disown; sleep 5)
```

- [ ] **Step 6: Manual verification in the browser (or via curl for a first-pass structural check)**

```bash
curl -s "http://localhost:3000/settings" -o /tmp/settings-page.html
grep -o "Tipologie di Prestazioni\|Nuova prestazione" /tmp/settings-page.html | sort | uniq -c
```

Expected: both strings found. Then, in an actual browser logged in as ADMIN (`admin@beauty.it`, seeded in `prisma/seed.ts` — the password is whatever `prisma/seed.ts` sets, check that file if needed), navigate to `/settings` and confirm:
- The "Tipologie di Prestazioni" card lists the 10 seeded service types (desktop table).
- Resize the window to mobile width (or use browser devtools device toolbar) and confirm the same list renders as stacked cards instead of a table.
- Click "Nuova prestazione", create one named "Test UI", confirm it appears in the list without a page reload.
- Click the pencil icon on "Test UI", rename it to "Test UI Rinominato", confirm the list updates.
- Click the trash icon on "Test UI Rinominato", confirm the browser `confirm()` dialog appears with the expected copy, confirm it, and confirm the row disappears from the list.
- Try creating a service type with a name that already exists (e.g. "Manicure") and confirm the form shows the "Esiste già una prestazione con questo nome." error instead of silently succeeding.

- [ ] **Step 7: Commit**

```bash
git add components/settings/ServiceTypeList.tsx components/settings/ServiceTypeForm.tsx "app/(dashboard)/settings/page.tsx"
git commit -m "feat: add service types CRUD section to settings page"
```

---

### Task 4: Wire AppointmentModal's service select to the catalog

**Files:**
- Modify: `components/calendar/AppointmentModal.tsx`

**Interfaces:**
- Consumes: `getServiceTypes` from `@/actions/serviceTypes` (Task 2).

- [ ] **Step 1: Add the import**

Find this line near the top of the file:

```tsx
import { getCustomers } from "@/actions/customers";
```

Add immediately after it:

```tsx
import { getServiceTypes } from "@/actions/serviceTypes";
```

- [ ] **Step 2: Remove the hardcoded `SERVICE_TYPES` constant**

Delete this entire block:

```tsx
const SERVICE_TYPES = [
  "Pulizia viso",
  "Massaggio rilassante",
  "Trattamento corpo",
  "Manicure",
  "Pedicure",
  "Ceretta",
  "Laser",
  "Radiofrequenza",
  "Pressoterapia",
  "Altro",
];
```

- [ ] **Step 3: Add `serviceTypes` state and change the `serviceType` initializer**

Find:

```tsx
  const [customerId, setCustomerId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
```

Replace with:

```tsx
  const [customerId, setCustomerId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string }[]>([]);
```

- [ ] **Step 4: Fetch service types alongside customers**

Find:

```tsx
  useEffect(() => {
    if (!open) return;
    getCustomers().then(setCustomers);
  }, [open]);
```

Replace with:

```tsx
  useEffect(() => {
    if (!open) return;
    getCustomers().then(setCustomers);
    getServiceTypes().then(setServiceTypes);
  }, [open]);
```

- [ ] **Step 5: Stop defaulting to `SERVICE_TYPES[0]` when opening the form**

Find:

```tsx
    setServiceType(appointment?.serviceType ?? SERVICE_TYPES[0]);
```

Replace with:

```tsx
    setServiceType(appointment?.serviceType ?? "");
```

- [ ] **Step 6: Update the service `<select>` to use `serviceTypes` and require an explicit choice**

Find:

```tsx
            <div className="space-y-1">
              <label className="text-sm font-medium">Prestazione *</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
```

Replace with:

```tsx
            <div className="space-y-1">
              <label className="text-sm font-medium">Prestazione *</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleziona prestazione</option>
                {serviceTypes.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
```

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors/new warnings from `components/calendar/AppointmentModal.tsx`. Specifically confirm there is no leftover reference to `SERVICE_TYPES` anywhere in the file:

```bash
grep -n "SERVICE_TYPES" components/calendar/AppointmentModal.tsx
```

Expected: no output (zero matches).

- [ ] **Step 8: Manual verification**

With the dev server running and logged in (any role), open `/calendar`, click a day to create a new appointment, and confirm:
- The "Prestazione" select shows "Seleziona prestazione" first, then the 10 seeded names (plus "Test UI"/renamed test rows if Task 3's manual testing left any behind — clean those up in Task 3 if so).
- Submitting without picking a service is blocked by the native `required` validation (browser shows "Please select an item in the list").
- Creating an appointment with a selected service type works and the calendar shows it as before.
- Editing an existing appointment (e.g. one of the seeded ones from `prisma/seed.ts`, which used `serviceType: "Pulizia viso"` etc.) pre-selects the matching option correctly.

- [ ] **Step 9: Commit**

```bash
git add components/calendar/AppointmentModal.tsx
git commit -m "feat: load appointment service options from the service type catalog"
```

---

### Task 5: Wire the finance service filter to the catalog

**Files:**
- Modify: `app/(dashboard)/finance/page.tsx`

**Interfaces:**
- Consumes: `getServiceTypes` from `@/actions/serviceTypes` (Task 2).

- [ ] **Step 1: Add the import**

Find:

```tsx
import { getFinancialSummary, getExpenses, createExpense, deleteExpense } from "@/actions/expenses";
```

Add immediately after it:

```tsx
import { getServiceTypes } from "@/actions/serviceTypes";
```

- [ ] **Step 2: Remove the hardcoded `SERVICE_FILTERS` constant**

Delete this entire block:

```tsx
const SERVICE_FILTERS = [
  "Tutti",
  "Pulizia viso",
  "Massaggio rilassante",
  "Trattamento corpo",
  "Manicure",
  "Pedicure",
  "Ceretta",
  "Laser",
  "Radiofrequenza",
  "Pressoterapia",
  "Altro",
];
```

- [ ] **Step 3: Add `serviceTypes` state and fetch it once on mount**

Find:

```tsx
  const [data, setData] = useState<FinancialData>({ appointments: [], expenses: [] });
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, startTransition] = useTransition();
```

Replace with:

```tsx
  const [data, setData] = useState<FinancialData>({ appointments: [], expenses: [] });
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, startTransition] = useTransition();
```

Then find:

```tsx
  useEffect(() => {
    startTransition(() => { loadData(); });
  }, [dateFrom, dateTo]);
```

Replace with:

```tsx
  useEffect(() => {
    startTransition(() => { loadData(); });
  }, [dateFrom, dateTo]);

  useEffect(() => {
    getServiceTypes().then(setServiceTypes);
  }, []);
```

(A separate effect with an empty dependency array, so the service-type list is fetched once and doesn't re-run every time the date filter changes.)

- [ ] **Step 4: Replace the hardcoded filter options with the catalog**

Find:

```tsx
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full lg:w-auto px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {SERVICE_FILTERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
```

Replace with:

```tsx
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full lg:w-auto px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {["Tutti", ...serviceTypes.map((s) => s.name)].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
```

(No change needed to `serviceFilter`'s own `useState("Tutti")` initializer, or to the filtering logic on line 234-236 (`data.appointments.filter((a) => a.serviceType === serviceFilter)`) — both already work with the raw string values this produces.)

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
grep -n "SERVICE_FILTERS" "app/(dashboard)/finance/page.tsx"
```

Expected: no errors/new warnings, and the `grep` produces zero matches (constant fully removed).

- [ ] **Step 6: Manual verification**

As ADMIN, open `/finance` and confirm:
- The service filter dropdown shows "Tutti" plus the 10 seeded service names.
- Selecting a specific service (e.g. "Manicure") filters the chart/KPIs the same way it did before this change.
- Create a new service type via `/settings` (e.g. "Test Finance Filter"), return to `/finance` without a full page reload, and confirm... note this specific case requires a re-mount or a manual refresh, since the finance page's service-type fetch only runs once on mount — refreshing the `/finance` tab after adding a service type elsewhere is the expected way to see it appear, which is consistent with how `data`/`expenses` also only refresh on date-range change or manual reload today.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/finance/page.tsx"
git commit -m "feat: load finance service filter options from the service type catalog"
```

---

## Spec Coverage Check

- Section 1 (Database Schema) → Task 1.
- Section 2 (Server Actions) → Task 2.
- Section 3 (Settings UI components) → Task 3, Steps 1-2.
- Section 4 (Settings page integration) → Task 3, Step 3.
- Section 5 (Calendar integration) → Task 4.
- Section 6 (Finance integration) → Task 5.
- Spec Testing section: duplicate-name rejection → Task 3 Step 6 and Task 2 Step 3; select requires explicit choice → Task 4 Step 8; deletion doesn't affect existing appointments → covered implicitly by the denormalized-string design (Task 1) and callable out explicitly in Task 3 Step 6's delete-confirmation copy; EMPLOYEE read access → Task 4 Step 8 (any role can open the calendar modal); finance filter sync → Task 5 Step 6.

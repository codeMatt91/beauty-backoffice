# Service Types Management in Settings — Design Spec
Date: 2026-07-26

## Goal
Replace the hardcoded list of appointment service types (currently a `SERVICE_TYPES` const duplicated in `components/calendar/AppointmentModal.tsx` and, as `SERVICE_FILTERS`, in `app/(dashboard)/finance/page.tsx`) with an admin-manageable catalog: a new dedicated section on `/settings` where an ADMIN can view, create, edit, and delete service types, with the calendar and finance dropdowns reading from that catalog instead of a hardcoded array.

## Context
- `Appointment.serviceType` is currently a free-text `String` column (`prisma/schema.prisma:88`), not a foreign key.
- `components/calendar/AppointmentModal.tsx` hardcodes `SERVICE_TYPES` (10 values, including a generic "Altro") to populate the service `<select>` when creating/editing an appointment.
- `app/(dashboard)/finance/page.tsx` independently hardcodes `SERVICE_FILTERS` (`"Tutti"` + the same 10 values) for its service filter dropdown — a second, already-duplicated copy of the same list.
- `/settings` (`app/(dashboard)/settings/page.tsx`) is a `"use client"` page, currently containing only the Data Purge card; it fetches nothing server-side itself.
- `/customers` (`app/(dashboard)/customers/page.tsx` + `components/customers/CustomerTable.tsx` + `CustomerForm.tsx`) is the established CRUD reference pattern in this codebase: a client page that loads data via a Server Action in `useEffect`, a responsive table/card list component (`hidden md:block` table, `md:hidden` cards), and a Radix `Dialog`-based create/edit modal, backed by `actions/customers.ts` (Zod validation, `requireAuth()`, `revalidatePath`).
- `/settings` is ADMIN-only (enforced by `middleware.ts`), but the resulting service-type catalog must also be readable by non-admin `EMPLOYEE` users, since they use `AppointmentModal` on `/calendar` (`All` access).
- `actions/users.ts` and `actions/expenses.ts` (both feeding ADMIN-only pages) call `requireAdmin()` on every mutation — the convention this spec follows for service-type mutations.

## Decisions
- **Data model:** `Appointment.serviceType` stays a plain `String`, unchanged. The new `ServiceType` table is a denormalized catalog only — it feeds the pickers but has no foreign-key relationship to `Appointment`. Renaming or deleting a service type never touches existing appointments; deletion is always safe (no referential-integrity constraint to violate). This was an explicit choice over a foreign-key relation (rejected: would require migrating existing `Appointment.serviceType` data, deciding on-delete behavior for in-use service types, and touching every place that currently reads `serviceType` as a plain string — `app/api/cron/email-reminder/route.ts`, `lib/exportFinancePDF.ts`, `lib/purge.ts`, `actions/expenses.ts` — for no benefit this feature needs).
- **Fields:** `ServiceType` has only `id`, `name` (unique), `createdAt`. No price/duration/active-flag — out of scope (YAGNI), can be added later if needed.
- **"Altro" entry:** becomes a regular seeded row, editable and deletable like any other — no special-cased/protected entry in the UI or data model.
- **Access control:** `getServiceTypes()` requires only `requireAuth()` (any authenticated role — `EMPLOYEE` needs it for `AppointmentModal`). `createServiceType`/`updateServiceType`/`deleteServiceType` require `requireAdmin()`, matching `actions/users.ts`/`actions/expenses.ts` convention, as defense-in-depth alongside the `/settings` route already being ADMIN-gated by `middleware.ts`.
- **Finance filter:** `SERVICE_FILTERS` in `app/(dashboard)/finance/page.tsx` is replaced with a dynamic `["Tutti", ...serviceTypes.map(s => s.name)]` built from the same `getServiceTypes()` call, so it can never drift from the managed catalog again.
- **Seed data:** a migration/seed step inserts the current 10 hardcoded names into `ServiceType` so behavior is unchanged immediately after deploy (no empty dropdown).
- **UI pattern:** components are modeled directly on `CustomerTable.tsx`/`CustomerForm.tsx` — same responsive breakpoints, same icon buttons, same Radix Dialog modal shell, same Tailwind utility classes — for automatic visual and structural consistency with the rest of the site (desktop table, mobile/tablet cards).

---

## Section 1 — Database Schema

**File:** `prisma/schema.prisma`

Add:
```prisma
model ServiceType {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")

  @@map("service_types")
}
```

**Migration:** `npm run db:migrate` (creates `service_types` table only; no changes to `Appointment`).

**Seed:** a one-off data migration (SQL executed via the generated Prisma migration, or a follow-up script run once) inserts the 10 existing names as rows: `Pulizia viso`, `Massaggio rilassante`, `Trattamento corpo`, `Manicure`, `Pedicure`, `Ceretta`, `Laser`, `Radiofrequenza`, `Pressoterapia`, `Altro`.

---

## Section 2 — Server Actions

**File:** `actions/serviceTypes.ts` (new)

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

Note: `revalidatePath` on `/calendar` and `/finance` is defensive — those pages fetch service types client-side via Server Action call, not via a cached server-rendered prop, so this mainly future-proofs against any server-rendered usage; it is cheap and matches the "call `revalidatePath` after every mutation" project convention.

---

## Section 3 — Settings UI components

**Files:** `components/settings/ServiceTypeList.tsx`, `components/settings/ServiceTypeForm.tsx` (new)

`ServiceTypeList.tsx` — props `{ serviceTypes: {id:string; name:string}[], onEdit: (s) => void, onRefresh: () => void }`:
- Search input (filters by name, client-side), matching `CustomerTable`'s search bar.
- Desktop: `hidden md:block` table, one column ("Nome") + trailing action column (Pencil/Trash2 icons, `aria-label`).
- Mobile/tablet: `md:hidden` stacked cards, name + Pencil/Trash2 icons, same as `CustomerTable`'s card layout.
- Delete: `confirm("Eliminare la prestazione \"{name}\"? Gli appuntamenti esistenti non verranno modificati.")`, then `deleteServiceType(id)`, then `onRefresh()`. The confirm copy explicitly tells the admin deletion doesn't touch past appointments (per the denormalized-string decision).
- Empty state: "Nessuna prestazione trovata" (search) / "Nessuna prestazione configurata" (no data at all), same style as `CustomerTable`'s empty state.

`ServiceTypeForm.tsx` — props `{ open: boolean, onClose: () => void, serviceType?: {id:string;name:string} | null, onSaved: () => void }`:
- Radix `Dialog.Root`/`Dialog.Content`, identical shell/classes to `CustomerForm.tsx` (`w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl border border-border`).
- Single field: "Nome *" text input.
- Submit calls `serviceType ? updateServiceType(serviceType.id, {name}) : createServiceType({name})`; same loading/error/onSaved/onClose flow as `CustomerForm.tsx`.
- Title: "Modifica prestazione" / "Nuova prestazione"; submit button label: "Aggiorna" / "Crea".

---

## Section 4 — Settings page integration

**File:** `app/(dashboard)/settings/page.tsx`

Add local state (`serviceTypes`, `formOpen`, `editingServiceType`) and a `load()` function calling `getServiceTypes()` in a `useEffect`, mirroring `CustomersPage`. Render a new card above or below the existing "Pulizia e Archiviazione Dati" card:
- Header: icon (`Scissors` or `Tag` from `lucide-react`) + title "Tipologie di Prestazioni" + subtitle "Gestisci i servizi disponibili per gli appuntamenti" + a "Nuova prestazione" button (top-right of the card header, same placement/style as `CustomersPage`'s "Nuovo cliente" button).
- Body: `<ServiceTypeList serviceTypes={serviceTypes} onEdit={openEdit} onRefresh={load} />`.
- `<ServiceTypeForm open={formOpen} onClose={...} serviceType={editingServiceType} onSaved={load} />` rendered once, outside the scrollable card area (same placement as `CustomerForm` in `CustomersPage`).

The page's existing `max-w-2xl` wrapper is kept, so the new card inherits the same width/spacing as the Data Purge card.

---

## Section 5 — Calendar integration

**File:** `components/calendar/AppointmentModal.tsx`

- Remove the hardcoded `SERVICE_TYPES` const.
- Add `const [serviceTypes, setServiceTypes] = useState<{id:string;name:string}[]>([]);` and fetch it in the existing customer-loading `useEffect` (`Promise.all([getCustomers(), getServiceTypes()])` or a second parallel call), so both lists load together when the modal opens.
- Change the service `<select>`: add a `<option value="">Seleziona prestazione</option>` placeholder (matching the customer select's pattern) and map over `serviceTypes` instead of `SERVICE_TYPES`.
- `serviceType` state initializer changes from `useState(SERVICE_TYPES[0])` to `useState("")`, since the list is no longer synchronously available at mount — same reasoning as `customerId`'s existing `useState("")`.
- No change to `handleSubmit` — it already sends `serviceType` (the selected string) unchanged to `createAppointment`/`updateAppointment`.

---

## Section 6 — Finance integration

**File:** `app/(dashboard)/finance/page.tsx`

- Remove the hardcoded `SERVICE_FILTERS` const.
- Add `const [serviceTypes, setServiceTypes] = useState<{id:string;name:string}[]>([]);`, fetched via `getServiceTypes()` in the page's existing data-loading `useEffect` (alongside `getFinancialSummary`/`getExpenses`).
- Replace `{SERVICE_FILTERS.map((s) => ...)}` with `{["Tutti", ...serviceTypes.map((s) => s.name)].map((s) => ...)}`.
- No change to the filtering logic itself (`data.appointments.filter((a) => a.serviceType === serviceFilter)`), since it already compares against the raw string.

---

## Files Changed

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `ServiceType` model |
| `prisma/migrations/` | New migration (creates table + seeds 10 existing names) |
| `actions/serviceTypes.ts` | New — CRUD Server Actions |
| `components/settings/ServiceTypeList.tsx` | New — responsive list (table/cards) |
| `components/settings/ServiceTypeForm.tsx` | New — create/edit modal |
| `app/(dashboard)/settings/page.tsx` | Add service-types card, load/state wiring |
| `components/calendar/AppointmentModal.tsx` | Replace hardcoded `SERVICE_TYPES` with `getServiceTypes()` |
| `app/(dashboard)/finance/page.tsx` | Replace hardcoded `SERVICE_FILTERS` with `getServiceTypes()` |

## Testing
No automated test framework in this repo (manual verification, per existing project convention):
- `/settings` (as ADMIN): create, rename (incl. duplicate-name rejection), and delete a service type; confirm the list updates and the delete confirmation copy is accurate.
- `/calendar`: confirm the service `<select>` in `AppointmentModal` reflects the current catalog (including a just-created/just-renamed entry) and requires an explicit selection (no silent default).
- `/finance`: confirm the service filter dropdown reflects the same catalog.
- As `EMPLOYEE` (non-admin): confirm `AppointmentModal`'s service select still loads (read access works), and that there is no way to reach the settings CRUD (already enforced by existing `/settings` ADMIN gate in `middleware.ts` — not re-tested here, out of scope of this change).
- Confirm deleting a service type that is already used by an existing appointment does not affect that appointment's displayed `serviceType` text (denormalized-string behavior).

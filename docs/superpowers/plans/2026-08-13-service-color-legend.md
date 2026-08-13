# Service Color Legend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `color` field to `ServiceType`, configurable via colorpicker in `/settings`, and use it to replace the payment-status legend and appointment-block coloring in `/calendar` with a per-service color scheme.

**Architecture:** One new DB column + a small `lib/colors.ts` contrast utility (Task 1, backend), one new form field + list swatch in `/settings` (Task 2), and a data-flow + rendering change in `/calendar` (Task 3, frontend-only — consumes what Tasks 1–2 already expose via the existing `getServiceTypes()` action). Each task produces independently testable, working software.

**Tech Stack:** Next.js 15 (Server Components + Server Actions), Prisma 6 / Postgres, React 19 Client Components, Tailwind CSS, native HTML5 `<input type="color">` (no new dependencies).

## Global Constraints

- `color` is a **required** `String` column with a DB default of `'#CCCCCC'` — unlike the earlier `durationMinutes` (nullable), every `ServiceType` always has a color.
- Format is `#RRGGBB` only — **no alpha channel**. Validated with `/^#[0-9A-Fa-f]{6}$/` on both client and server.
- Migration is additive and non-destructive: existing rows all get the single flat default `#CCCCCC` (confirmed with the user — no per-row palette rotation).
- **This repo's `prisma migrate dev` cannot run** — the migration history starts from an intentionally-empty baseline (`20250101000000_baseline`), so its shadow-database replay fails on the very next migration. Do not attempt `npm run db:migrate` / `prisma migrate dev` for this or any future schema change in this repo. Use the `migrate diff` + manual folder + `migrate deploy` recipe in Task 1 instead (already proven in the prior `durationMinutes` and other schema-touching work on this project).
- Duplicate-color detection is a **client-side-only, non-blocking warning** — no server validation, no blocking of save. Confirmed with the user and the spec itself.
- No new npm dependencies. No Server Action / auth changes beyond extending the existing `serviceTypeSchema` Zod object in `actions/serviceTypes.ts`.
- Dynamic per-record colors are rendered via inline `style` (not Tailwind classes) — this is a deliberate, narrow, confirmed exception to the project's "Tailwind only" rule, because Tailwind cannot generate classes for runtime-arbitrary hex values.
- No automated test framework exists in this repo (confirmed in prior features: no `test` script, no Jest/Vitest config, no `__tests__` directory). Verification is manual: `tsc --noEmit`, `npm run lint`, small `tsx`-run verification scripts for pure functions, and end-to-end checks via the dev server (Playwright driver script against disposable test data, or direct browser interaction) — not a new test suite.
- This repo's dev database is the developer's real, shared Postgres instance with real user accounts. Never use an existing real account for verification — always create a disposable throwaway ADMIN account and disposable `ServiceType`/data rows, and delete them afterward.
- `<input type="color">` cannot be driven with Playwright's `.fill()` (color inputs aren't natively fillable that way). Task 2/3 verification uses the paired plain-text hex `<input>` instead — it updates the same React state, so it's an equally valid way to set the color in an automated check.

---

### Task 1: Data layer — `color` column, migration, contrast utility, validation

**Files:**
- Modify: `prisma/schema.prisma:84-92` (`ServiceType` model)
- Create: `prisma/migrations/<timestamp>_add_service_type_color/migration.sql`
- Create: `lib/colors.ts`
- Modify: `actions/serviceTypes.ts:9-12` (`serviceTypeSchema`)

**Interfaces:**
- Produces: `DEFAULT_SERVICE_COLOR: string` (`"#CCCCCC"`) and `getContrastingTextColor(hex: string): "#000000" | "#FFFFFF"`, both exported from `lib/colors.ts`. Tasks 2 and 3 import both.
- Produces: `ServiceType.color: string`, always present (never null) on every row `getServiceTypes()` returns — Tasks 2 and 3 rely on this field always being a valid `#RRGGBB` string, never `null`/`undefined`.

- [ ] **Step 1: Add `color` to the Prisma schema**

In `prisma/schema.prisma`, current `ServiceType` model:
```prisma
model ServiceType {
  id              String   @id @default(cuid())
  name            String   @unique
  defaultPrice    Decimal  @default(0) @db.Decimal(10, 2) @map("default_price")
  durationMinutes Int?     @map("duration_minutes")
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("service_types")
}
```
Replace with:
```prisma
model ServiceType {
  id              String   @id @default(cuid())
  name            String   @unique
  defaultPrice    Decimal  @default(0) @db.Decimal(10, 2) @map("default_price")
  durationMinutes Int?     @map("duration_minutes")
  color           String   @default("#CCCCCC")
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("service_types")
}
```

- [ ] **Step 2: Generate and apply the migration (diff + deploy recipe — do NOT use `migrate dev`)**

```bash
cd /Users/matteoimbimbo/Desktop/beauty-backoffice
set -a; source .env; set +a
npx prisma migrate diff --from-url "$POSTGRES_URL_NON_POOLING" --to-schema-datamodel prisma/schema.prisma --script > /tmp/color_migration.sql
cat /tmp/color_migration.sql
```
Expected output (additive, non-destructive):
```sql
-- AlterTable
ALTER TABLE "service_types" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#CCCCCC';
```
If the printed SQL contains anything else (drops, renames, other tables), STOP and report — do not proceed.

Create the migration folder with the exact Prisma naming convention and copy the SQL in:
```bash
TS=$(date +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_add_service_type_color"
mkdir -p "$DIR"
cp /tmp/color_migration.sql "$DIR/migration.sql"
cat "$DIR/migration.sql"
```

Apply it (no shadow database involved — safe for this repo's baseline):
```bash
npx prisma migrate deploy
```
Expected: `1 migration(s) applied` (or similar), no errors.

- [ ] **Step 3: Verify zero drift and regenerate the Prisma Client**

```bash
set -a; source .env; set +a
npx prisma migrate diff --from-url "$POSTGRES_URL_NON_POOLING" --to-schema-datamodel prisma/schema.prisma --script
```
Expected: `-- This is an empty migration.` (confirms the live DB now exactly matches `schema.prisma`).

```bash
npx prisma generate
```
Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Confirm existing rows got the default color**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.serviceType.findMany({ select: { name: true, color: true } });
  console.log(rows);
  await prisma.\$disconnect();
})();
"
```
Expected: every row shows `color: '#CCCCCC'` (no `null`/`undefined` — the column is `NOT NULL` with that default, so this is guaranteed, but confirm it visually against the real data).

- [ ] **Step 5: Create the contrast utility**

Create `lib/colors.ts`:
```typescript
export const DEFAULT_SERVICE_COLOR = "#CCCCCC";

/**
 * Given a hex color ("#RRGGBB"), returns black or white — whichever gives
 * better text contrast against that background — using the YIQ formula
 * (threshold 128 out of 255, the commonly-cited value for this method).
 */
export function getContrastingTextColor(hex: string): "#000000" | "#FFFFFF" {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}
```

- [ ] **Step 6: Verify the contrast utility with a throwaway script**

Create `verify-colors.tmp.ts` at the project root (so the relative import resolves):
```typescript
import { getContrastingTextColor, DEFAULT_SERVICE_COLOR } from "./lib/colors";

const cases: [string, "#000000" | "#FFFFFF"][] = [
  ["#FFFFFF", "#000000"],
  ["#000000", "#FFFFFF"],
  ["#CCCCCC", "#000000"],
  ["#3B82F6", "#FFFFFF"],
];

let failures = 0;
for (const [input, expected] of cases) {
  const actual = getContrastingTextColor(input);
  if (actual !== expected) {
    console.error(`FAIL: getContrastingTextColor(${input}) = ${actual}, expected ${expected}`);
    failures++;
  } else {
    console.log(`PASS: getContrastingTextColor(${input}) = ${actual}`);
  }
}
if (DEFAULT_SERVICE_COLOR !== "#CCCCCC") {
  console.error(`FAIL: DEFAULT_SERVICE_COLOR = ${DEFAULT_SERVICE_COLOR}, expected #CCCCCC`);
  failures++;
}
process.exit(failures > 0 ? 1 : 0);
```
Run it (this repo already has `tsx` as a devDependency, used for `prisma/seed.ts`):
```bash
npx tsx verify-colors.tmp.ts
```
Expected: 4 `PASS` lines, exit code 0. Then delete the throwaway file:
```bash
rm verify-colors.tmp.ts
```

- [ ] **Step 7: Extend the Zod validation schema**

In `actions/serviceTypes.ts`, current schema:
```typescript
const serviceTypeSchema = z.object({
  name: z.string().min(2, "Il nome è obbligatorio (min. 2 caratteri).").max(50, "Il nome è troppo lungo."),
  defaultPrice: z.coerce.number().nonnegative("Il prezzo non può essere negativo."),
  durationMinutes: z.coerce
    .number()
    .int("La durata deve essere un numero intero di minuti.")
    .min(1, "La durata deve essere di almeno 1 minuto.")
    .max(1440, "La durata non può superare i 1440 minuti (24 ore).")
    .nullable()
    .optional(),
});
```
Replace with:
```typescript
const serviceTypeSchema = z.object({
  name: z.string().min(2, "Il nome è obbligatorio (min. 2 caratteri).").max(50, "Il nome è troppo lungo."),
  defaultPrice: z.coerce.number().nonnegative("Il prezzo non può essere negativo."),
  durationMinutes: z.coerce
    .number()
    .int("La durata deve essere un numero intero di minuti.")
    .min(1, "La durata deve essere di almeno 1 minuto.")
    .max(1440, "La durata non può superare i 1440 minuti (24 ore).")
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Il colore deve essere in formato esadecimale (#RRGGBB)."),
});
```
Note `color` has no `.nullable()`/`.optional()` — it's always required, matching the DB column. **Do not change** `createServiceType`, `updateServiceType`, `deleteServiceType`, or `getServiceTypes()` bodies — `parsed.data` (now including `color`) already flows straight into Prisma via the existing spread pattern, exactly like `durationMinutes` before it. `getServiceTypes()`'s `...s` spread already carries `color` through untouched (it's a plain `String`, not a `Decimal`, so no serialization step is needed).

- [ ] **Step 8: Verify the regex directly**

```bash
node -e "
const re = /^#[0-9A-Fa-f]{6}\$/;
const cases = [
  ['#FFFFFF', true],
  ['#000', false],
  ['CCCCCC', false],
  ['#12345g', false],
  ['#AbCdEf', true],
  ['#123456', true],
];
let failures = 0;
for (const [input, expected] of cases) {
  const actual = re.test(input);
  if (actual !== expected) { console.error('FAIL', input, actual, expected); failures++; }
  else console.log('PASS', input, actual);
}
process.exit(failures > 0 ? 1 : 0);
"
```
Expected: 6 `PASS` lines, exit code 0.

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/colors.ts actions/serviceTypes.ts
git commit -m "feat: add color field to ServiceType with contrast utility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Settings UI — colorpicker, duplicate warning, list swatch

**Files:**
- Modify: `components/settings/ServiceTypeForm.tsx`
- Modify: `components/settings/ServiceTypeList.tsx`
- Modify: `components/settings/SettingsClient.tsx`

**Interfaces:**
- Consumes: `DEFAULT_SERVICE_COLOR`, `getContrastingTextColor` from `lib/colors.ts` (Task 1). `ServiceType.color: string` on every row from `getServiceTypes()` (Task 1).
- Produces: nothing new consumed by Task 3 (Task 3 gets `color` from `getServiceTypes()`/Prisma directly, not from these components) — this task is self-contained and independently testable via `/settings` alone.

- [ ] **Step 1: Extend `ServiceTypeForm.tsx` — type, state, duplicate-warning lookup**

Current local interface and imports (top of file):
```tsx
"use client";

import { useState, useEffect } from "react";
import { createServiceType, updateServiceType } from "@/actions/serviceTypes";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  serviceType?: ServiceType | null;
  onSaved: () => void;
}
```
Replace with:
```tsx
"use client";

import { useState, useEffect } from "react";
import { createServiceType, updateServiceType } from "@/actions/serviceTypes";
import { DEFAULT_SERVICE_COLOR } from "@/lib/colors";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  serviceType?: ServiceType | null;
  existingServiceTypes: ServiceType[];
  onSaved: () => void;
}
```

Current component signature and state:
```tsx
export default function ServiceTypeForm({ open, onClose, serviceType, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(serviceType?.name ?? "");
    setDefaultPrice(serviceType?.defaultPrice ?? "");
    setDurationMinutes(serviceType?.durationMinutes != null ? String(serviceType.durationMinutes) : "");
  }, [open, serviceType]);

  if (!open) return null;
```
Replace with:
```tsx
export default function ServiceTypeForm({ open, onClose, serviceType, existingServiceTypes, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [color, setColor] = useState(DEFAULT_SERVICE_COLOR);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(serviceType?.name ?? "");
    setDefaultPrice(serviceType?.defaultPrice ?? "");
    setDurationMinutes(serviceType?.durationMinutes != null ? String(serviceType.durationMinutes) : "");
    setColor(serviceType?.color ?? DEFAULT_SERVICE_COLOR);
  }, [open, serviceType]);

  if (!open) return null;

  const duplicateColorName = existingServiceTypes.find(
    (s) => s.id !== serviceType?.id && s.color.toLowerCase() === color.toLowerCase()
  )?.name;
```

- [ ] **Step 2: Include `color` in the submit payload**

Current:
```tsx
    try {
      const durationValue = durationMinutes.trim() === "" ? null : Number(durationMinutes);
      const result = serviceType
        ? await updateServiceType(serviceType.id, { name, defaultPrice: parseFloat(defaultPrice), durationMinutes: durationValue })
        : await createServiceType({ name, defaultPrice: parseFloat(defaultPrice), durationMinutes: durationValue });
```
Replace with:
```tsx
    try {
      const durationValue = durationMinutes.trim() === "" ? null : Number(durationMinutes);
      const result = serviceType
        ? await updateServiceType(serviceType.id, { name, defaultPrice: parseFloat(defaultPrice), durationMinutes: durationValue, color })
        : await createServiceType({ name, defaultPrice: parseFloat(defaultPrice), durationMinutes: durationValue, color });
```

- [ ] **Step 3: Add the color field JSX**

Current JSX has the Durata field block immediately followed by the error block:
```tsx
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="serviceTypeDuration">Durata (minuti)</label>
              <input
                id="serviceTypeDuration"
                type="number"
                min="1"
                max="1440"
                step="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="Es. 30"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && (
```
Insert a new field block between them:
```tsx
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="serviceTypeDuration">Durata (minuti)</label>
              <input
                id="serviceTypeDuration"
                type="number"
                min="1"
                max="1440"
                step="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="Es. 30"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="serviceTypeColor">Colore</label>
              <div className="flex items-center gap-2">
                <input
                  id="serviceTypeColor"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 rounded-lg border border-input bg-background cursor-pointer p-1"
                  aria-label="Selettore colore prestazione"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  required
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#CCCCCC"
                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Codice colore esadecimale"
                />
              </div>
              <p className="text-xs text-muted-foreground">Colore identificativo della prestazione, mostrato in calendario.</p>
              {duplicateColorName && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Colore già usato da &quot;{duplicateColorName}&quot;. Puoi salvare comunque, ma sarà meno distinguibile in calendario.
                </p>
              )}
            </div>

            {error && (
```
Both inputs share the same `color` state and `onChange`, so typing in the hex text field updates the native color swatch (once the value is a complete valid hex) and vice versa.

- [ ] **Step 4: Update `ServiceTypeList.tsx` — type and swatch**

Current top of file:
```tsx
"use client";

import { useState } from "react";
import { Pencil, Trash2, Search } from "lucide-react";
import { deleteServiceType } from "@/actions/serviceTypes";

interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
}
```
Replace the interface with:
```tsx
interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
  color: string;
}
```

Current desktop table name cell:
```tsx
                <td className="px-4 py-3 font-medium">{s.name}</td>
```
Replace with:
```tsx
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    {s.name}
                  </div>
                </td>
```

Current mobile card name:
```tsx
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(s.defaultPrice)} · {formatDuration(s.durationMinutes)}
                </p>
              </div>
```
Replace with:
```tsx
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <p className="font-medium text-foreground">{s.name}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(s.defaultPrice)} · {formatDuration(s.durationMinutes)}
                </p>
              </div>
```

- [ ] **Step 5: Update `SettingsClient.tsx` — type and new prop**

Current interface:
```tsx
interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
}
```
Replace with:
```tsx
interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
  color: string;
}
```

Current `<ServiceTypeForm>` mount:
```tsx
      <ServiceTypeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        serviceType={editingServiceType}
        onSaved={loadServiceTypes}
      />
```
Replace with:
```tsx
      <ServiceTypeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        serviceType={editingServiceType}
        existingServiceTypes={serviceTypes}
        onSaved={loadServiceTypes}
      />
```

- [ ] **Step 6: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors; lint shows only the same pre-existing warnings as before this task (unrelated files).

- [ ] **Step 7: Manual end-to-end verification via dev server**

Start the dev server:
```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npm run dev > /tmp/beauty-dev.log 2>&1 & disown
i=0; until curl -sf http://localhost:3000 >/dev/null || [ $i -ge 45 ]; do sleep 1; i=$((i+1)); done
curl -sf http://localhost:3000 >/dev/null && echo "SERVER UP" || tail -50 /tmp/beauty-dev.log
```

Create a disposable ADMIN test account (never use a real account in this repo's dev DB):
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('TempVerify123!', 12);
  await prisma.user.upsert({
    where: { email: 'verify-tmp@test.local' },
    update: { passwordHash: hash, role: 'ADMIN' },
    create: { firstName: 'Verify', lastName: 'Tmp', email: 'verify-tmp@test.local', passwordHash: hash, role: 'ADMIN' },
  });
  console.log('temp admin ready');
  await prisma.\$disconnect();
})();
"
```

Drive it with a throwaway Playwright script (run from the project root so `require('playwright')` resolves) — save as `verify-settings-color.tmp.js`:
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('#email');
  await page.fill('#email', 'verify-tmp@test.local');
  await page.fill('#password', 'TempVerify123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Tipologie di Prestazioni');

  // Create service A with a distinct color
  await page.click('button:has-text("Nuova prestazione")');
  await page.waitForSelector('#serviceTypeName');
  await page.fill('#serviceTypeName', 'Colore Test A');
  await page.fill('#serviceTypePrice', '10');
  await page.fill('[aria-label="Codice colore esadecimale"]', '#3B82F6');
  await page.click('button:has-text("Crea")');
  await page.waitForTimeout(1000);

  // Create service B with the SAME color -> duplicate warning must appear, non-blocking
  await page.click('button:has-text("Nuova prestazione")');
  await page.waitForSelector('#serviceTypeName');
  await page.fill('#serviceTypeName', 'Colore Test B');
  await page.fill('#serviceTypePrice', '12');
  await page.fill('[aria-label="Codice colore esadecimale"]', '#3B82F6');
  const warningVisible = await page.locator('text=Colore già usato da').isVisible();
  console.log('Duplicate warning visible before save:', warningVisible);
  await page.click('button:has-text("Crea")');
  await page.waitForTimeout(1000);
  const bodyAfterB = await page.textContent('body');
  console.log('Service B saved despite duplicate (non-blocking)?', bodyAfterB.includes('Colore Test B'));

  // Confirm swatches render in the list
  await page.screenshot({ path: '/tmp/settings-color-verify.png', fullPage: true });

  console.log('Console errors:', JSON.stringify(consoleErrors));
  await browser.close();
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
```
```bash
node verify-settings-color.tmp.js
```
Confirm:
- `Duplicate warning visible before save: true`
- `Service B saved despite duplicate (non-blocking)?: true`
- `Console errors: []`
- Open `/tmp/settings-color-verify.png` and confirm both "Colore Test A" and "Colore Test B" show a blue swatch next to their name.

Clean up:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.serviceType.deleteMany({ where: { name: { in: ['Colore Test A', 'Colore Test B'] } } });
  await prisma.user.deleteMany({ where: { email: 'verify-tmp@test.local' } });
  console.log('cleaned up');
  await prisma.\$disconnect();
})();
"
rm -f verify-settings-color.tmp.js
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
git checkout -- tsconfig.tsbuildinfo 2>/dev/null || true
```

- [ ] **Step 8: Commit**

```bash
git add components/settings/ServiceTypeForm.tsx components/settings/ServiceTypeList.tsx components/settings/SettingsClient.tsx
git commit -m "feat: add color picker and swatch to service type settings UI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Calendar — dynamic legend and appointment coloring

**Files:**
- Modify: `app/globals.css:61-64` (append `.no-scrollbar`)
- Modify: `app/(dashboard)/calendar/page.tsx`
- Modify: `app/(dashboard)/calendar/CalendarClient.tsx`
- Modify: `components/calendar/CalendarView.tsx`

**Interfaces:**
- Consumes: `DEFAULT_SERVICE_COLOR`, `getContrastingTextColor` from `lib/colors.ts` (Task 1). `ServiceType.color: string` via a new direct Prisma query in `page.tsx` (does NOT depend on Task 2's UI — only on Task 1's schema/migration being applied).
- Produces: nothing consumed elsewhere — this is the final, user-visible integration point.

- [ ] **Step 1: Add the `.no-scrollbar` utility**

In `app/globals.css`, current end of file:
```css
/* Calendar custom styles */
.appointment-block {
  @apply rounded-md px-2 py-1 text-xs font-medium truncate cursor-pointer transition-opacity hover:opacity-80;
}
```
Append immediately after:
```css
/* Calendar custom styles */
.appointment-block {
  @apply rounded-md px-2 py-1 text-xs font-medium truncate cursor-pointer transition-opacity hover:opacity-80;
}

.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 2: Fetch `ServiceType` colors in the calendar page**

In `app/(dashboard)/calendar/page.tsx`, current:
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
        employees={JSON.parse(JSON.stringify(employees))}
      />
    </div>
  );
}
```
Replace with:
```tsx
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const [appointments, employees, serviceTypes] = await Promise.all([
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
    prisma.serviceType.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
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
        employees={JSON.parse(JSON.stringify(employees))}
        serviceTypes={JSON.parse(JSON.stringify(serviceTypes))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Thread `serviceTypes` through `CalendarClient.tsx`**

Current `Props` interface and component signature:
```tsx
interface Props {
  initialAppointments: Appointment[];
  employees: { id: string; firstName: string; lastName: string }[];
}

export default function CalendarClient({ initialAppointments, employees }: Props) {
```
Replace with:
```tsx
interface Props {
  initialAppointments: Appointment[];
  employees: { id: string; firstName: string; lastName: string }[];
  serviceTypes: { id: string; name: string; color: string }[];
}

export default function CalendarClient({ initialAppointments, employees, serviceTypes }: Props) {
```

Current `<CalendarView>` mount:
```tsx
      <CalendarView
        appointments={appointments}
        employees={employees}
        currentDate={currentDate}
        view={view}
        isPending={isPending}
        onNavigate={handleNavigate}
        onViewChange={handleViewChange}
        onGoToToday={handleGoToToday}
        onRefresh={handleRefresh}
      />
```
Replace with:
```tsx
      <CalendarView
        appointments={appointments}
        employees={employees}
        serviceTypes={serviceTypes}
        currentDate={currentDate}
        view={view}
        isPending={isPending}
        onNavigate={handleNavigate}
        onViewChange={handleViewChange}
        onGoToToday={handleGoToToday}
        onRefresh={handleRefresh}
      />
```
No re-fetch logic needed — `serviceTypes` is static per page load, same treatment as `employees`.

- [ ] **Step 4: `CalendarView.tsx` — imports, types, remove `STATUS_COLORS`, add color lookup**

Current imports and top-of-file:
```tsx
"use client";

import { useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Grid3x3, Calendar } from "lucide-react";
import { cn, formatTime, formatCurrency } from "@/lib/utils";
import AppointmentModal from "./AppointmentModal";
import { useState } from "react";
import { PaymentStatus } from "@prisma/client";

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

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

type ViewMode = "month" | "week" | "day";

interface Props {
  appointments: Appointment[];
  employees: Employee[];
  currentDate: Date;
  view: ViewMode;
  isPending?: boolean;
  onNavigate: (dir: 1 | -1) => void;
  onViewChange: (view: ViewMode) => void;
  onGoToToday: () => void;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  OPTIONAL: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
};

export default function CalendarView({
  appointments,
  employees,
  currentDate,
  view,
  isPending,
  onNavigate,
  onViewChange,
  onGoToToday,
  onRefresh,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const openNew = (date: Date) => {
    setSelectedAppointment(null);
    setSelectedDate(date);
    setModalOpen(true);
  };

  const openEdit = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setSelectedDate(undefined);
    setModalOpen(true);
  };

  const getAppointmentsForDay = useCallback(
    (date: Date) =>
      appointments.filter((a) => isSameDay(new Date(a.startTime), date)),
    [appointments]
  );
```
Replace with:
```tsx
"use client";

import { useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Grid3x3, Calendar } from "lucide-react";
import { cn, formatTime, formatCurrency } from "@/lib/utils";
import { DEFAULT_SERVICE_COLOR, getContrastingTextColor } from "@/lib/colors";
import AppointmentModal from "./AppointmentModal";
import { useState } from "react";
import { PaymentStatus } from "@prisma/client";

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

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface ServiceType {
  id: string;
  name: string;
  color: string;
}

type ViewMode = "month" | "week" | "day";

interface Props {
  appointments: Appointment[];
  employees: Employee[];
  serviceTypes: ServiceType[];
  currentDate: Date;
  view: ViewMode;
  isPending?: boolean;
  onNavigate: (dir: 1 | -1) => void;
  onViewChange: (view: ViewMode) => void;
  onGoToToday: () => void;
  onRefresh: () => void;
}

export default function CalendarView({
  appointments,
  employees,
  serviceTypes,
  currentDate,
  view,
  isPending,
  onNavigate,
  onViewChange,
  onGoToToday,
  onRefresh,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const openNew = (date: Date) => {
    setSelectedAppointment(null);
    setSelectedDate(date);
    setModalOpen(true);
  };

  const openEdit = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setSelectedDate(undefined);
    setModalOpen(true);
  };

  const getAppointmentsForDay = useCallback(
    (date: Date) =>
      appointments.filter((a) => isSameDay(new Date(a.startTime), date)),
    [appointments]
  );

  const getServiceColor = useCallback(
    (serviceTypeName: string) =>
      serviceTypes.find((s) => s.name === serviceTypeName)?.color ?? DEFAULT_SERVICE_COLOR,
    [serviceTypes]
  );
```
Note `PaymentStatus` import is kept — it's still used by the `Appointment` interface's `paymentStatus` field and by `AppointmentModal`'s own payment-status `<select>`, which is untouched by this feature.

- [ ] **Step 5: Month view — color the appointment block**

Current (inside `renderMonthView`):
```tsx
                <div className="mt-1 space-y-0.5">
                  {dayApts.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                      className={cn(
                        "appointment-block border",
                        STATUS_COLORS[a.paymentStatus]
                      )}
                    >
                      {formatTime(a.startTime)} {a.customer.lastName}
                    </div>
                  ))}
                  {dayApts.length > 3 && (
```
Replace with:
```tsx
                <div className="mt-1 space-y-0.5">
                  {dayApts.slice(0, 3).map((a) => {
                    const bg = getServiceColor(a.serviceType);
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                        className="appointment-block border"
                        style={{ backgroundColor: bg, borderColor: bg, color: getContrastingTextColor(bg) }}
                      >
                        {formatTime(a.startTime)} {a.customer.lastName}
                      </div>
                    );
                  })}
                  {dayApts.length > 3 && (
```

- [ ] **Step 6: Week view — color the appointment block**

Current (inside `renderWeekView`):
```tsx
                  {slotApts.map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                      className={cn(
                        "appointment-block border mb-0.5",
                        STATUS_COLORS[a.paymentStatus]
                      )}
                    >
                      {a.customer.lastName} – {a.serviceType}
                    </div>
                  ))}
```
Replace with:
```tsx
                  {slotApts.map((a) => {
                    const bg = getServiceColor(a.serviceType);
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                        className="appointment-block border mb-0.5"
                        style={{ backgroundColor: bg, borderColor: bg, color: getContrastingTextColor(bg) }}
                      >
                        {a.customer.lastName} – {a.serviceType}
                      </div>
                    );
                  })}
```

- [ ] **Step 7: Day view — color the appointment block**

Current (inside `renderDayView`):
```tsx
                {slotApts.map((a) => (
                  <div
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                    className={cn(
                      "appointment-block border mb-0.5",
                      STATUS_COLORS[a.paymentStatus]
                    )}
                  >
                    {formatTime(a.startTime)} {a.customer.lastName} – {a.serviceType}
                    {a.employee && ` (${a.employee.firstName} ${a.employee.lastName})`} · {formatCurrency(a.price)}
                  </div>
                ))}
```
Replace with:
```tsx
                {slotApts.map((a) => {
                  const bg = getServiceColor(a.serviceType);
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                      className="appointment-block border mb-0.5"
                      style={{ backgroundColor: bg, borderColor: bg, color: getContrastingTextColor(bg) }}
                    >
                      {formatTime(a.startTime)} {a.customer.lastName} – {a.serviceType}
                      {a.employee && ` (${a.employee.firstName} ${a.employee.lastName})`} · {formatCurrency(a.price)}
                    </div>
                  );
                })}
```

- [ ] **Step 8: Replace the legend**

Current:
```tsx
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border bg-card text-[11px]">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={cn("px-2 py-0.5 rounded border font-medium", cls)}>
            {status === "PAID" ? "Pagato" : status === "PENDING" ? "Da pagare" : "Opzionale"}
          </span>
        ))}
      </div>
```
Replace with:
```tsx
      {/* Legend */}
      <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain snap-x snap-proximity no-scrollbar px-4 py-1.5 border-b border-border bg-card text-[11px]">
        {serviceTypes.map((s) => (
          <span
            key={s.id}
            className="shrink-0 snap-start px-2 py-0.5 rounded border font-medium"
            style={{ backgroundColor: s.color, borderColor: s.color, color: getContrastingTextColor(s.color) }}
          >
            {s.name}
          </span>
        ))}
      </div>
```

- [ ] **Step 9: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors; lint shows only the same pre-existing warnings as before this task.

- [ ] **Step 10: Manual end-to-end verification via dev server**

Start the dev server (same pattern as Task 2):
```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npm run dev > /tmp/beauty-dev.log 2>&1 & disown
i=0; until curl -sf http://localhost:3000 >/dev/null || [ $i -ge 45 ]; do sleep 1; i=$((i+1)); done
curl -sf http://localhost:3000 >/dev/null && echo "SERVER UP" || tail -50 /tmp/beauty-dev.log
```

Create a disposable ADMIN account and two disposable `ServiceType` rows with distinct colors:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('TempVerify123!', 12);
  await prisma.user.upsert({
    where: { email: 'verify-tmp@test.local' },
    update: { passwordHash: hash, role: 'ADMIN' },
    create: { firstName: 'Verify', lastName: 'Tmp', email: 'verify-tmp@test.local', passwordHash: hash, role: 'ADMIN' },
  });
  await prisma.serviceType.upsert({
    where: { name: 'Calendario Colore Rosso' },
    update: { defaultPrice: 20, color: '#EF4444' },
    create: { name: 'Calendario Colore Rosso', defaultPrice: 20, color: '#EF4444' },
  });
  await prisma.serviceType.upsert({
    where: { name: 'Calendario Colore Verde' },
    update: { defaultPrice: 25, color: '#22C55E' },
    create: { name: 'Calendario Colore Verde', defaultPrice: 25, color: '#22C55E' },
  });
  console.log('temp admin + service types ready');
  await prisma.\$disconnect();
})();
"
```

Drive it with a throwaway Playwright script, run from the project root, saved as `verify-calendar-color.tmp.js`:
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('#email');
  await page.fill('#email', 'verify-tmp@test.local');
  await page.fill('#password', 'TempVerify123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  await page.goto('http://localhost:3000/calendar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Legend: confirm old payment-status labels are gone, new service badges present
  const bodyText = await page.textContent('body');
  console.log('Old "Pagato" label gone:', !bodyText.includes('Pagato'));
  console.log('Old "Da pagare" label gone:', !bodyText.includes('Da pagare'));
  console.log('New legend badge "Calendario Colore Rosso" present:', bodyText.includes('Calendario Colore Rosso'));
  console.log('New legend badge "Calendario Colore Verde" present:', bodyText.includes('Calendario Colore Verde'));

  // Create an appointment using the red service, confirm the block picks up the color
  const newButton = page.locator('button:has-text("Appuntamento")').first();
  await newButton.click();
  await page.waitForSelector('text=Prestazione');
  await page.fill('input[type="datetime-local"] >> nth=0', '2026-08-20T14:00');
  await page.fill('input[type="datetime-local"] >> nth=1', '2026-08-20T15:00');
  const customerSelect = page.locator('input[placeholder*="Cerca cliente"]');
  await customerSelect.click();
  const firstCustomer = page.locator('[role="option"], li, button').filter({ hasText: /.+/ }).first();
  if (await firstCustomer.count()) await firstCustomer.click();
  await page.locator('select').first().selectOption({ label: 'Calendario Colore Rosso' }).catch(async () => {
    await page.locator('select:near(:text("Prestazione"))').selectOption({ label: 'Calendario Colore Rosso' });
  });
  await page.click('button:has-text("Crea")');
  await page.waitForTimeout(1000);

  const blockBg = await page.locator('.appointment-block', { hasText: 'Calendario Colore Rosso' }).first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)
    .catch(() => null);
  console.log('Appointment block background-color (expect rgb(239, 68, 68) for #EF4444):', blockBg);

  await page.screenshot({ path: '/tmp/calendar-color-verify.png', fullPage: true });
  console.log('Console errors:', JSON.stringify(consoleErrors));
  await browser.close();
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
```
```bash
node verify-calendar-color.tmp.js
```
Confirm:
- Old payment-status labels are gone from the page.
- Both new service-type badges appear in the legend.
- The created appointment's block resolves to `rgb(239, 68, 68)` (i.e. `#EF4444`), proving the color lookup works end to end.
- `Console errors: []`.
- Open `/tmp/calendar-color-verify.png` and visually confirm: the legend renders as colored badges (not the old 3-badge payment status row), and it's screenshotted at a typical viewport — if you want to specifically confirm the touch-scroll behavior, resize the Playwright page to a narrow mobile viewport (e.g. `page.setViewportSize({ width: 375, height: 667 })`) before this screenshot and confirm the legend row doesn't overflow the visible page width (i.e. it's scrollable, not wrapped/broken).

If the script's calendar-popup selectors (customer picker, appointment creation) don't match exactly — the `AppointmentModal` UI may have details not fully captured here — inspect `components/calendar/AppointmentModal.tsx` directly and adjust the script's selectors; the important assertions are the legend content checks and the final `backgroundColor` check, not this exact script verbatim.

Clean up:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.appointment.deleteMany({ where: { serviceType: 'Calendario Colore Rosso' } });
  await prisma.serviceType.deleteMany({ where: { name: { in: ['Calendario Colore Rosso', 'Calendario Colore Verde'] } } });
  await prisma.user.deleteMany({ where: { email: 'verify-tmp@test.local' } });
  console.log('cleaned up');
  await prisma.\$disconnect();
})();
"
rm -f verify-calendar-color.tmp.js
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
git checkout -- tsconfig.tsbuildinfo 2>/dev/null || true
```

- [ ] **Step 11: Commit**

```bash
git add app/globals.css "app/(dashboard)/calendar/page.tsx" "app/(dashboard)/calendar/CalendarClient.tsx" components/calendar/CalendarView.tsx
git commit -m "feat: replace payment-status calendar legend with per-service colors

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** §4.1 data model → Task 1. §4.2 Settings colorpicker + hex entry + preview + default-on-create → Task 2 Step 3 (paired native color input + text input + swatch preview via the color input itself, default state `DEFAULT_SERVICE_COLOR`). §4.1 duplicate-color non-blocking warning → Task 2 Step 1/3. §4.3 dynamic legend, all 3 views, responsive scroll → Task 3 Steps 4-8, verified in Step 10. §4.4 appointment coloring in all 3 views + default-color fallback + text contrast → Task 3 Steps 5-8 (`getServiceColor` fallback to `DEFAULT_SERVICE_COLOR`, `getContrastingTextColor` on every render site). §6 migration/retrocompatibility (single default color, no rotation) → Task 1 Steps 1-4. §7 open questions → all resolved and stated in Global Constraints (payment status removed from calendar visuals, no alpha channel, non-blocking duplicate warning, click-filter explicitly out of scope per the functional spec's own §2).
- **Placeholder scan:** no TBDs; every step has literal, complete code. The one acknowledged soft spot is Task 3 Step 10's Playwright script for the appointment-creation flow, which explicitly tells the implementer to adapt selectors against the real `AppointmentModal.tsx` if they don't match — this is flagged inline as expected adaptation, not a placeholder, since the exact popup interaction sequence can't be fully pinned down without re-deriving `AppointmentModal.tsx`'s full JSX here (the important, non-negotiable assertions — legend content and computed background-color — are given in full).
- **Type consistency:** `ServiceType` shape is `{ id: string; name: string; color: string }` in Task 3 (calendar, no `defaultPrice`/`durationMinutes` needed there) vs. the fuller `{ id, name, defaultPrice, durationMinutes, color }` in Task 2 (settings forms, which need every field) — this is intentional, not drift: `page.tsx`'s Prisma `select` in Task 3 only requests `id, name, color`, matching its narrower interface exactly. `getServiceColor(serviceTypeName: string): string` (Task 3) and `getContrastingTextColor(hex: string): "#000000" | "#FFFFFF"` (Task 1) are defined once and used with matching signatures at every call site (legend badge, 3 appointment-block sites). `DEFAULT_SERVICE_COLOR` is the single source of truth for the fallback color, imported (never redefined) in both Task 2 and Task 3.

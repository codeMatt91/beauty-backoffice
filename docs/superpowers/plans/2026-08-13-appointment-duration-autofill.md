# Appointment Duration Auto-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the appointment popup (`/calendar`), auto-compute the Fine (end time) as `Inizio + duration_minutes` whenever the user selects/changes a Prestazione or changes Inizio, using the already-existing `ServiceType.durationMinutes`.

**Architecture:** One pure helper function (`calculateEndTime`) added to `components/calendar/AppointmentModal.tsx`, called from two existing/new event handlers — `handleServiceTypeChange` (extended) and `handleStartTimeChange` (new, replaces the inline `onChange` on the Inizio input). No other files change.

**Tech Stack:** React 19 Client Component, `date-fns` (`addMinutes`, `format` — both already imported/used in this file), TypeScript.

## Global Constraints

- Single file: `components/calendar/AppointmentModal.tsx`. No Server Action, Prisma, auth, or routing changes.
- No new npm dependencies — `date-fns` is already a project dependency; only `addMinutes` needs importing in addition to the already-imported `format`.
- **No test framework exists in this repo** (confirmed during the prior `ServiceType.durationMinutes` work: no `test` script, no Jest/Vitest config, no `__tests__` directory; Playwright is installed but unconfigured as a test runner). Per project convention, verification is manual end-to-end via the running dev server, driven with a throwaway Playwright script (same approach used to verify the `/settings` duration field), not automated unit tests. Do not add a test framework as part of this task.
- Option A (always-synced, no manual-override tracking) is the confirmed behavior — every Prestazione or Inizio change recomputes Fine when duration is known, unconditionally overwriting whatever was there.
- Prestazione without a configured duration (`durationMinutes === null`) → Fine is left untouched, no warning UI (confirmed: silent).
- The reset `useEffect` that pre-populates fields when the modal opens for an existing appointment (lines 74–92) must NOT be touched — it must keep setting `startTime`/`endTime` directly from the `appointment` prop, not through the new handler, so opening an existing appointment never silently recomputes its saved Fine.

---

### Task 1: Add duration-aware end-time auto-fill to AppointmentModal

**Files:**
- Modify: `components/calendar/AppointmentModal.tsx:4` (import), `:61` (state type), `:96–100` (`handleServiceTypeChange`), `:219` (Inizio input `onChange`)

**Interfaces:**
- Produces: `calculateEndTime(startTimeLocal: string, durationMinutes: number): string` — a module-level pure function in this file. Input/output both use the `"yyyy-MM-dd'T'HH:mm"` shape already used by `startTime`/`endTime` state and the `datetime-local` inputs.
- Produces: `handleStartTimeChange(value: string): void` — replaces the inline arrow function currently on the Inizio input's `onChange`.
- Consumes: existing `serviceTypes` state (extended with `durationMinutes: number | null`), existing `serviceType`/`startTime` state, existing `setEndTime`.

- [ ] **Step 1: Extend the `serviceTypes` state type with `durationMinutes`**

Current (line 61):
```typescript
const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string; defaultPrice: string }[]>([]);
```
Replace with:
```typescript
const [serviceTypes, setServiceTypes] = useState<
  { id: string; name: string; defaultPrice: string; durationMinutes: number | null }[]
>([]);
```
`getServiceTypes()` (in `actions/serviceTypes.ts`) already returns `durationMinutes` on every row — no action-layer change needed, this is purely widening the local type to match what's already being returned.

- [ ] **Step 2: Import `addMinutes` and add the `calculateEndTime` helper**

Current import (line 4):
```typescript
import { format } from "date-fns";
```
Replace with:
```typescript
import { addMinutes, format } from "date-fns";
```

Add this module-level function directly below the `PAYMENT_OPTIONS` constant (after line 51, before `export default function AppointmentModal`):
```typescript
function calculateEndTime(startTimeLocal: string, durationMinutes: number): string {
  return format(addMinutes(new Date(startTimeLocal), durationMinutes), "yyyy-MM-dd'T'HH:mm");
}
```

- [ ] **Step 3: Extend `handleServiceTypeChange` to recompute Fine when duration is known**

Current (lines 96–100):
```typescript
function handleServiceTypeChange(name: string) {
  setServiceType(name);
  const found = serviceTypes.find((s) => s.name === name);
  if (found) setPrice(found.defaultPrice);
}
```
Replace with:
```typescript
function handleServiceTypeChange(name: string) {
  setServiceType(name);
  const found = serviceTypes.find((s) => s.name === name);
  if (found) setPrice(found.defaultPrice);
  if (found?.durationMinutes != null && startTime) {
    setEndTime(calculateEndTime(startTime, found.durationMinutes));
  }
}
```
- `found?.durationMinutes != null` covers both "prestazione not found" and "prestazione has no configured duration" — in either case Fine is left alone.
- `&& startTime` covers "Inizio not set yet" — nothing to compute from.

- [ ] **Step 4: Add `handleStartTimeChange` and wire it to the Inizio input**

Add this function directly after `handleServiceTypeChange` (i.e. right after the block from Step 3):
```typescript
function handleStartTimeChange(value: string) {
  setStartTime(value);
  const found = serviceTypes.find((s) => s.name === serviceType);
  if (found?.durationMinutes != null) {
    setEndTime(calculateEndTime(value, found.durationMinutes));
  }
}
```

Current Inizio input (lines 216–222):
```tsx
<input
  type="datetime-local"
  value={startTime}
  onChange={(e) => setStartTime(e.target.value)}
  required
  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
/>
```
Replace the `onChange` line with:
```tsx
onChange={(e) => handleStartTimeChange(e.target.value)}
```
(Leave everything else — `type`, `value`, `required`, `className` — unchanged. The Fine input right below it is untouched entirely: it keeps its own direct `onChange={(e) => setEndTime(e.target.value)}`, since manual edits to Fine must still work when no Prestazione/duration is active, and Option A means any subsequent Inizio/Prestazione change will overwrite a manual Fine edit anyway.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. In particular, confirm no error at the call site of `getServiceTypes().then(setServiceTypes)` (line 71) now that the local state type requires `durationMinutes` — `getServiceTypes()`'s inferred return already includes this field (verified during the prior `/settings` duration work), so this should pass with zero additional changes.

- [ ] **Step 6: Manual end-to-end verification via dev server**

Start the dev server and confirm it's serving:
```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npm run dev > /tmp/beauty-dev.log 2>&1 & disown
i=0; until curl -sf http://localhost:3000 >/dev/null || [ $i -ge 45 ]; do sleep 1; i=$((i+1)); done
curl -sf http://localhost:3000 >/dev/null && echo "SERVER UP" || tail -50 /tmp/beauty-dev.log
```

This repo's real dev database has real user accounts — do not use them. Create a disposable ADMIN test account first (delete it in the last step):
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

Also ensure at least one `ServiceType` row exists with a non-null `durationMinutes` (reuse or create one, e.g. via `/settings` UI or directly):
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.serviceType.upsert({
    where: { name: 'Verifica Durata' },
    update: { defaultPrice: 20, durationMinutes: 27 },
    create: { name: 'Verifica Durata', defaultPrice: 20, durationMinutes: 27 },
  });
  await prisma.serviceType.upsert({
    where: { name: 'Verifica Senza Durata' },
    update: { defaultPrice: 10, durationMinutes: null },
    create: { name: 'Verifica Senza Durata', defaultPrice: 10, durationMinutes: null },
  });
  console.log('temp service types ready');
  await prisma.\$disconnect();
})();
"
```

Drive the app with a throwaway Playwright script run from the project root (so it resolves the local `playwright` module) — save as `verify-duration-autofill.tmp.js` in the project root, then `node verify-duration-autofill.tmp.js`:
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

  // Open "new appointment" — adjust selector if the calendar's create trigger differs.
  await page.click('text=Calendario >> xpath=..').catch(() => {});
  // Fallback: click a day cell or a "Nuovo" button if present.
  const newButton = page.locator('button:has-text("Nuovo appuntamento"), button:has-text("Nuovo")').first();
  if (await newButton.count()) await newButton.click();
  await page.waitForSelector('text=Prestazione', { timeout: 10000 });

  // Case 1: Inizio set first, then select a service WITH duration -> Fine should auto-update
  await page.fill('input[type="datetime-local"] >> nth=0', '2026-08-20T14:00');
  await page.selectOption('select:near(:text("Prestazione"))', { label: 'Verifica Durata' }).catch(async () => {
    // fallback if selectOption-by-label needs the raw select
    await page.locator('select').first().selectOption({ label: 'Verifica Durata' });
  });
  await page.waitForTimeout(300);
  const endValue1 = await page.locator('input[type="datetime-local"] >> nth=1').inputValue();
  console.log('Case 1 - Fine after selecting duration service (expect 2026-08-20T14:27):', endValue1);

  // Case 2: change Inizio -> Fine should recompute keeping same duration
  await page.fill('input[type="datetime-local"] >> nth=0', '2026-08-20T23:50');
  await page.waitForTimeout(300);
  const endValue2 = await page.locator('input[type="datetime-local"] >> nth=1').inputValue();
  console.log('Case 2 - Fine after Inizio 23:50 (+27min, expect 2026-08-21T00:17, midnight rollover):', endValue2);

  // Case 3: switch to a service WITHOUT duration -> Fine must stay untouched
  await page.locator('select').first().selectOption({ label: 'Verifica Senza Durata' });
  await page.waitForTimeout(300);
  const endValue3 = await page.locator('input[type="datetime-local"] >> nth=1').inputValue();
  console.log('Case 3 - Fine after switching to no-duration service (expect unchanged, still', endValue2, '):', endValue3);

  console.log('Console errors:', JSON.stringify(consoleErrors));
  await browser.close();
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
```

Confirm:
- Case 1 output is `2026-08-20T14:27`
- Case 2 output is `2026-08-21T00:17` (midnight rollover handled)
- Case 3 output is unchanged from Case 2's value (no-duration service leaves Fine alone)
- `Console errors` is `[]`

Then separately, open an **existing** appointment that has a Prestazione with a configured duration, and confirm its saved Fine displays unchanged (not recomputed) until you explicitly touch Inizio or Prestazione — this is the one behavior a scripted flow above doesn't cover, so check it by hand in the browser (or extend the script to click an existing appointment cell before asserting the Fine input's initial value).

Also confirm Prezzo auto-fill still works (select any prestazione, verify Prezzo updates) — regression check on the untouched part of `handleServiceTypeChange`.

- [ ] **Step 7: Clean up verification artifacts**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.serviceType.deleteMany({ where: { name: { in: ['Verifica Durata', 'Verifica Senza Durata'] } } });
  await prisma.user.deleteMany({ where: { email: 'verify-tmp@test.local' } });
  console.log('cleaned up');
  await prisma.\$disconnect();
})();
"
rm -f verify-duration-autofill.tmp.js
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
```

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: no new errors/warnings introduced in `components/calendar/AppointmentModal.tsx` (pre-existing warnings in unrelated files are expected and not in scope).

- [ ] **Step 9: Commit**

```bash
git add components/calendar/AppointmentModal.tsx
git commit -m "feat: auto-fill appointment end time from service duration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Trigger 1 (Prestazione change) → Step 3. Trigger 2 (Inizio change) → Step 4. Midnight rollover → covered by `addMinutes` + Case 2 verification. No-duration silent behavior → `!= null` guards + Case 3 verification. Option A (always overwrite) → no override-tracking state introduced, by construction. Edit-mode initial load not recomputing → enforced by leaving the reset `useEffect` (lines 74–92) untouched, called out explicitly in Global Constraints and this task's diff scope. Price auto-fill untouched → verified as a regression check in Step 6.
- **Placeholder scan:** no TBDs; all code blocks are complete and copy-pasteable diffs against the current file content (verified against the file as of this plan's writing).
- **Type consistency:** `calculateEndTime(startTimeLocal: string, durationMinutes: number): string` is defined once (Step 2) and called identically in both Step 3 and Step 4 with matching argument order/types. `serviceTypes` entries' `durationMinutes: number | null` field name matches the `ServiceType`/`getServiceTypes()` shape established in the prior `/settings` feature — no naming drift.

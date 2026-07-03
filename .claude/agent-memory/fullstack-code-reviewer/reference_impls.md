---
name: reference-impls
description: Which files to hold up as correct vs incorrect examples when reviewing beauty-backoffice
metadata:
  type: project
---

**Correct reference implementations** (cite these when suggesting fixes):
- `app/(dashboard)/calendar/page.tsx` — Server Component fetching Prisma directly, serializing Decimal via `.toString()` + `JSON.parse(JSON.stringify(...))` before passing to client. The canonical data-fetch pattern.
- `actions/expenses.ts` — every action calls `requireAdmin()`, Zod-validates, `revalidatePath`. Good ADMIN-guard example (though it returns Decimal unserialized — see [[anti-patterns]] #4).
- `actions/users.ts` — good: `select` excludes `passwordHash`, hashes with bcrypt cost 12, blocks self-delete.

**Weak spots to compare against:**
- `actions/appointments.ts` `updateAppointment` — the one mutation that does NOT Zod-validate (spreads `data` straight into Prisma). Contrast with `updateCustomer`/`updateExpense` which do.
- `app/(dashboard)/calendar/CalendarClient.tsx` — `handleRefresh` uses `window.location.reload()` and CalendarView navigates months purely client-side over only the current month's data, so other months render empty.

**How to apply:** When flagging an issue, point to the sibling that does it right — the team clearly knows the correct pattern in at least one place.

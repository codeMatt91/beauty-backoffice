---
name: anti-patterns
description: Recurring code issues across beauty-backoffice to check on every review, not documented in CLAUDE.md
metadata:
  type: project
---

Recurring anti-patterns observed in the codebase (verify still present before citing — they may get fixed):

1. **Client pages fetch via Server Action in `useEffect`** instead of being Server Components that query Prisma directly. Seen in `customers/page.tsx`, `employees/page.tsx`, `finance/page.tsx`. Contradicts CLAUDE.md "prefer Server Components for data-fetching pages". The good pattern is `calendar/page.tsx`.

2. **Custom modal `<div>` implementations** (fixed inset-0 overlays) instead of Radix `Dialog`, even though `@radix-ui/react-dialog` is installed. Seen in `AppointmentModal`, `CustomerForm`, `UserModal` (employees), `AddExpenseModal` (finance). No focus trap / ESC / aria.

3. **`requireAuth`/`requireAdmin` duplicated per action file** (`actions/*.ts`) with `session.user as any` casts, instead of one shared helper in `lib/auth.ts`. CLAUDE.md talks about `requireAuth()` as if central, but it isn't.

4. **Prisma `Decimal` returned unserialized from Server Actions** that feed client components (`getFinancialSummary`, `getExpenses`). Only `calendar/page.tsx` serializes correctly. Watch every new action returning `price`/`amount`.

5. **Icon-only buttons missing `aria-label`** throughout (calendar nav chevrons, modal close X, table edit/delete). CLAUDE.md requires aria-label on icon-only buttons.

6. **Exported functions in `"use server"` files that skip auth** become public unauthenticated endpoints. `getTomorrowAppointments` in `actions/appointments.ts` has no `requireAuth` and leaks customer PII.

**How to apply:** Scan for these first on any PR touching actions/, pages, or components — they recur and are the highest-value findings.

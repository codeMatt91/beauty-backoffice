# Customer Form State Sync — Design Spec

**Date:** 2026-07-11  
**Status:** Approved

## Problem

When a user clicks the edit button (pencil icon) on a customer in `/customers`, the `CustomerForm` modal opens with all fields empty: nome, cognome, età, numero di telefono are not pre-populated.

### Root Cause

Identical to the bug fixed in `AppointmentModal` (see `2026-07-11-appointment-modal-state-sync-design.md`). `CustomerForm` is always mounted unconditionally in `CustomersPage` (line 62 of `app/(dashboard)/customers/page.tsx`). React's `useState` hooks initialize only once at the first mount — at that point `customer` is `null`, so all fields default to empty strings. The `if (!open) return null` guard on line 33 controls rendering only; it does not unmount the component, so hooks are never re-initialized when `customer` changes.

## Solution

**`useEffect` to sync state with props** (same approach as AppointmentModal fix)

Add a single `useEffect` in `CustomerForm` that fires whenever `open` transitions to `true`. It resets all form fields from the incoming `customer` prop (or empty strings for a new customer).

### Why this approach

- No component remount → Radix Dialog animations preserved
- Targeted: one effect added, no structural changes to CustomersPage or page.tsx
- Consistent pattern with the AppointmentModal fix already applied

## Implementation

**File:** `components/customers/CustomerForm.tsx`

Neutralize the `useState` initial values (lines 27–31) and add:

```typescript
useEffect(() => {
  if (!open) return;
  setFirstName(customer?.firstName ?? "");
  setLastName(customer?.lastName ?? "");
  setPhoneNumber(customer?.phoneNumber ?? "");
  setAge(customer?.age?.toString() ?? "");
  setNotes(customer?.notes ?? "");
}, [open, customer]);
```

## Scope

- **1 file changed:** `components/customers/CustomerForm.tsx`
- No database queries, Server Actions, auth, or routing changes required
- No new dependencies

# Appointment Modal State Sync — Design Spec

**Date:** 2026-07-11  
**Status:** Approved

## Problem

When a user clicks an existing appointment in the calendar, the `AppointmentModal` opens but all fields are empty: cliente, operatrice, prestazione, and orario are not pre-populated.

### Root Cause

`AppointmentModal` is always mounted in `CalendarView`'s JSX tree (unconditionally). React's `useState` hooks are initialized only once at the first mount — at that point `appointment` is `null`, so all fields default to empty. The `if (!open) return null` guard on line 86 controls rendering only; it does not unmount the component, so hooks are never re-initialized when `appointment` changes.

## Solution

**Option A — `useEffect` to sync state with props** (selected)

Add a single `useEffect` in `AppointmentModal` that fires whenever `open` transitions to `true`. It resets all form fields from the incoming `appointment` prop (or from defaults for a new appointment).

### Why this approach

- No component remount → Radix Dialog animations are preserved
- Targeted: only one effect added, no structural changes to CalendarView or page.tsx
- The existing `useState` declarations stay; their initial values become irrelevant (empty string / defaults) since the effect immediately overwrites them on open

## Implementation

**File:** `components/calendar/AppointmentModal.tsx`

Replace the initial `useState` values that depend on `appointment` with neutral defaults, and add:

```typescript
useEffect(() => {
  if (!open) return;
  setCustomerId(appointment?.customerId ?? "");
  setEmployeeId(appointment?.employeeId ?? "");
  setServiceType(appointment?.serviceType ?? SERVICE_TYPES[0]);
  setStartTime(
    appointment
      ? format(new Date(appointment.startTime), "yyyy-MM-dd'T'HH:mm")
      : format(defaultDate ?? new Date(), "yyyy-MM-dd'T'09:00")
  );
  setEndTime(
    appointment
      ? format(new Date(appointment.endTime), "yyyy-MM-dd'T'HH:mm")
      : format(defaultDate ?? new Date(), "yyyy-MM-dd'T'10:00")
  );
  setPrice(appointment?.price ?? "0");
  setPaymentStatus(appointment?.paymentStatus ?? "PENDING");
  setNotes(appointment?.notes ?? "");
}, [open, appointment]);
```

## Scope

- **1 file changed:** `components/calendar/AppointmentModal.tsx`
- No database queries, Server Actions, auth, or routing changes required
- No new dependencies

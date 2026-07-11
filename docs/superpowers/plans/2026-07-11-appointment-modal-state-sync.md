# Appointment Modal State Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-populate AppointmentModal form fields with the selected appointment's data when the modal opens in edit mode.

**Architecture:** Add a single `useEffect` in `AppointmentModal` that fires when `open` transitions to `true`, resetting all form state from the `appointment` prop. No structural changes to CalendarView, page.tsx, or any Server Action.

**Tech Stack:** React 19 (useEffect, useState), date-fns (format), Next.js 15 App Router, Tailwind CSS

## Global Constraints

- No external libraries beyond those already installed
- No inline `style` props — Tailwind only
- `"use client"` directive must remain at top of file
- Do not add comments unless the WHY is non-obvious

---

### Task 1: Fix form state initialization in AppointmentModal

**Files:**
- Modify: `components/calendar/AppointmentModal.tsx`

**Interfaces:**
- Consumes: `appointment` prop (type `Appointment | null | undefined`), `open` prop (`boolean`), `defaultDate` prop (`Date | undefined`)
- Produces: corrected form pre-population on every modal open

- [ ] **Step 1: Neutralize useState initial values**

Open `components/calendar/AppointmentModal.tsx`. Replace lines 68–79 (the existing `useState` declarations) with neutral defaults — the `useEffect` will handle actual initialization:

```typescript
const [customerId, setCustomerId] = useState("");
const [employeeId, setEmployeeId] = useState("");
const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
const [startTime, setStartTime] = useState("");
const [endTime, setEndTime] = useState("");
const [price, setPrice] = useState("0");
const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PENDING");
const [notes, setNotes] = useState("");
```

- [ ] **Step 2: Add the sync useEffect**

Insert the following effect immediately after the existing `useEffect` that fetches customers (after line 84):

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

- [ ] **Step 3: Verify the dev server compiles without errors**

```bash
npm run dev
```

Expected: server starts, no TypeScript or compilation errors in the terminal.

- [ ] **Step 4: Manual verification — edit existing appointment**

1. Open the app at `http://localhost:3000/calendar`
2. Click on any existing appointment block in the calendar
3. Verify the modal opens with all fields pre-populated:
   - **Cliente** select shows the correct customer
   - **Operatrice** select shows the assigned employee (or "Nessuna assegnazione")
   - **Prestazione** select shows the correct service type
   - **Inizio** and **Fine** datetime inputs show the correct times
   - **Prezzo** shows the correct amount
   - **Pagamento** shows the correct status
   - **Note** shows any existing notes

- [ ] **Step 5: Manual verification — create new appointment**

1. Click on an empty day cell in the calendar
2. Verify the modal opens with empty/default fields (cliente empty, prestazione = first option, orario = 09:00–10:00 on the clicked date, prezzo = 0, pagamento = Da pagare)

- [ ] **Step 6: Manual verification — switch between appointments**

1. Open an existing appointment, note its values, close the modal
2. Open a different existing appointment
3. Verify the fields updated to the second appointment's values (not the first)

- [ ] **Step 7: Commit**

```bash
git add components/calendar/AppointmentModal.tsx
git commit -m "fix: pre-populate AppointmentModal fields when editing existing appointment"
```

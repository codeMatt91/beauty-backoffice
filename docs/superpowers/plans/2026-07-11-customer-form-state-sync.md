# Customer Form State Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-populate CustomerForm fields with the selected customer's data when the modal opens in edit mode.

**Architecture:** Add a single `useEffect` in `CustomerForm` that fires when `open` transitions to `true`, resetting all form state from the `customer` prop. No structural changes to CustomersPage or any Server Action.

**Tech Stack:** React 19 (useEffect, useState), Next.js 15 App Router, Tailwind CSS

## Global Constraints

- No external libraries beyond those already installed
- No inline `style` props — Tailwind only
- `"use client"` directive must remain at top of file
- Do not add comments unless the WHY is non-obvious
- No new npm dependencies

---

### Task 1: Fix form state initialization in CustomerForm

**Files:**
- Modify: `components/customers/CustomerForm.tsx`

**Interfaces:**
- Consumes: `customer` prop (type `Customer | null | undefined`), `open` prop (`boolean`)
- Produces: corrected form pre-population on every modal open

- [ ] **Step 1: Neutralize useState initial values**

Open `components/customers/CustomerForm.tsx`. Replace lines 27–31 (the existing `useState` declarations) with neutral defaults:

```typescript
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [phoneNumber, setPhoneNumber] = useState("");
const [age, setAge] = useState("");
const [notes, setNotes] = useState("");
```

- [ ] **Step 2: Add the sync useEffect**

Add the `useEffect` import to the existing import on line 3 (it already imports `useState` — add `useEffect` alongside it):

```typescript
import { useState, useEffect } from "react";
```

Then insert the following effect immediately after the `useState` declarations (before the `if (!open) return null` line):

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

- [ ] **Step 3: Verify the dev server compiles without errors**

```bash
npm run dev
```

Expected: server starts, no TypeScript or compilation errors in the terminal.

- [ ] **Step 4: Manual verification — edit existing customer**

1. Open the app at `http://localhost:3000/customers`
2. Click the pencil icon on any existing customer row
3. Verify the modal opens with all fields pre-populated:
   - **Nome** shows the customer's first name
   - **Cognome** shows the customer's last name
   - **Telefono** shows the phone number (or empty if none)
   - **Età** shows the age (or empty if none)
   - **Note** shows any existing notes

- [ ] **Step 5: Manual verification — create new customer**

1. Click "Nuovo cliente"
2. Verify the modal opens with all fields empty

- [ ] **Step 6: Manual verification — switch between customers**

1. Open an existing customer, note the values, close the modal
2. Open a different customer
3. Verify the fields updated to the second customer's values

- [ ] **Step 7: Commit**

```bash
git add components/customers/CustomerForm.tsx
git commit -m "fix: pre-populate CustomerForm fields when editing existing customer"
```

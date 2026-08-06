# Searchable Customer Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `<select>` cliente in `AppointmentModal.tsx` with a searchable field: the user types a name/surname, the customer list filters on every keystroke, and the result is shown in a Radix Popover dropdown that stays usable on mobile/tablet.

**Architecture:** One new generic Client Component, `components/ui/SearchableSelect.tsx`, built on `@radix-ui/react-popover` (already a dependency, not yet used anywhere in the codebase). It exposes an `items`/`value`/`onChange` API with no knowledge of the `Customer` domain type. `AppointmentModal.tsx` maps its already-loaded `customers` array into `{ id, label }` items and swaps the `<select>` block for this component.

**Tech Stack:** Next.js 15 App Router, React 19 Client Component (`"use client"`), `@radix-ui/react-popover`, Tailwind CSS, `lucide-react` (`X` icon).

## Global Constraints

- Tailwind utility classes only — no inline `style`, no CSS modules (CLAUDE.md frontend guidelines).
- Mark a component `"use client"` only if it uses browser APIs, event handlers, or React state/effects — `SearchableSelect` qualifies (state + event handlers).
- Use Radix UI for interactive primitives instead of building custom accessible dropdowns from scratch (CLAUDE.md).
- Icon-only buttons need `aria-label` (CLAUDE.md a11y rule) — applies to the "clear selection" `X` button.
- Mobile-first: no layout change to the surrounding form; the dropdown must not be clipped by the modal's `overflow-y-auto` container.
- No new npm dependencies — `@radix-ui/react-popover` is already installed.
- This project has no automated test runner (`package.json` scripts are `dev`, `build`, `start`, `lint`, `db:*` only). Verification per task is `npm run lint` and `npx tsc --noEmit`, plus manual browser verification via the `/run` skill for the UI-integration task.
- Server Actions/database/auth are untouched by this plan — no `requireAuth()` or Prisma changes apply here.

---

### Task 1: `SearchableSelect` generic component

**Files:**
- Create: `components/ui/SearchableSelect.tsx`

**Interfaces:**
- Produces: `SearchableSelectItem` (`{ id: string; label: string }`), default-exported `SearchableSelect({ items, value, onChange, placeholder?, emptyMessage?, ariaLabel }: { items: SearchableSelectItem[]; value: string; onChange: (id: string) => void; placeholder?: string; emptyMessage?: string; ariaLabel: string })`. Consumed by Task 2.

- [ ] **Step 1: Create `components/ui/SearchableSelect.tsx`**

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { X } from "lucide-react";

export interface SearchableSelectItem {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  ariaLabel: string;
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = "Cerca...",
  emptyMessage = "Nessun risultato",
  ariaLabel,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((i) => i.id === value);

  const filteredItems = useMemo(() => {
    const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items;
    return items.filter((item) => {
      const label = normalize(item.label);
      return tokens.every((t) => label.includes(t));
    });
  }, [items, query]);

  function handleSelect(item: SearchableSelectItem) {
    onChange(item.id);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (selectedItem) {
    return (
      <div className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
        <span className="truncate">{selectedItem.label}</span>
        <button
          type="button"
          onClick={handleClear}
          aria-label="Cambia cliente"
          className="p-0.5 rounded hover:bg-secondary text-muted-foreground shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-[60] w-[var(--radix-popover-trigger-width)] max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-1"
        >
          {filteredItems.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2.5 rounded-md text-sm hover:bg-secondary focus:bg-secondary focus:outline-none"
              >
                {item.label}
              </button>
            ))
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

Notes on two details that matter:
- `onOpenAutoFocus={(e) => e.preventDefault()}` on `Popover.Content` stops Radix from stealing focus away from the `<input>` when the popover opens — without it, the user's next keystroke wouldn't land in the input.
- `Popover.Anchor` (not `Popover.Trigger`) wraps the input: `Trigger` toggles `open` on click, which would fight with the `open`/`onFocus` control flow here. `Anchor` only marks the position Radix positions `Popover.Content` against; visibility stays fully controlled by the `open`/`onOpenChange` props on `Popover.Root` (this also means outside clicks and Escape close it via `onOpenChange`, for free).

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/ui/SearchableSelect.tsx`.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/SearchableSelect.tsx
git commit -m "$(cat <<'EOF'
feat: add generic SearchableSelect combobox component

Radix Popover-based search-as-you-type select, portaled outside any
scroll-clipping ancestor. No domain dependency (id/label items only)
so it can be reused beyond the customer picker.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire into `AppointmentModal.tsx`

**Files:**
- Modify: `components/calendar/AppointmentModal.tsx`

**Interfaces:**
- Consumes: `SearchableSelect`, `SearchableSelectItem` from `@/components/ui/SearchableSelect` (Task 1). Existing `customers: Customer[]` state, `customerId`/`setCustomerId` state, `handleSubmit` — all already defined in this file.

- [ ] **Step 1: Import `SearchableSelect`**

In `components/calendar/AppointmentModal.tsx`, add to the imports (near the top, after the other component imports):

```tsx
import SearchableSelect from "@/components/ui/SearchableSelect";
```

- [ ] **Step 2: Replace the cliente `<select>` block**

Find this block (the `Cliente *` field):

```tsx
            <div className="space-y-1">
              <label className="text-sm font-medium">Cliente *</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleziona cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName} {c.firstName}
                  </option>
                ))}
              </select>
            </div>
```

Replace it with:

```tsx
            <div className="space-y-1">
              <label className="text-sm font-medium">Cliente *</label>
              <SearchableSelect
                items={customers.map((c) => ({ id: c.id, label: `${c.lastName} ${c.firstName}` }))}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Cerca cliente per nome o cognome..."
                emptyMessage="Nessun cliente trovato"
                ariaLabel="Cliente"
              />
            </div>
```

- [ ] **Step 3: Add the required-field check to `handleSubmit`**

The old `<select required>` relied on native browser validation, which `SearchableSelect` doesn't provide. Find the start of `handleSubmit`:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
```

Replace it with (the check must run **before** `setLoading(true)` — otherwise an early `return` on a missing customer would leave the submit button permanently stuck on "Salvataggio..."):

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Seleziona un cliente");
      return;
    }
    setLoading(true);
    setError(null);

    try {
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual browser verification (use the `/run` skill)**

Prerequisite: at least 2-3 customers exist with distinct first/last names (check via `npm run db:studio` or the `/customers` page; add some if needed).

1. Start the dev server: `npm run dev`.
2. Log in, go to `/calendar`, click a day to open "Nuovo appuntamento".
3. Confirm the Cliente field is now a text input with placeholder "Cerca cliente per nome o cognome...", not a dropdown arrow.
4. Click/focus it. Confirm a popup list of all customers appears below the field, formatted "Cognome Nome".
5. Type a few letters of an existing customer's surname. Confirm the list narrows on every keystroke to matching customers only.
6. Clear the input and type part of a first name instead (e.g. "Maria" for a customer whose label shows "Rossi Maria"). Confirm it still matches (word-order-independent search).
7. Type gibberish that matches no customer. Confirm "Nessun cliente trovato" is shown instead of an empty list.
8. Click a customer in the filtered list. Confirm: the field now shows that customer's name in a bordered, non-editable-looking box with an `X` button, and the popup closes.
9. Click the `X`. Confirm the field returns to search mode, empty, focused, ready to type again.
10. Leave the Cliente field empty and try to submit the form (fill in the other required fields). Confirm the red error box shows "Seleziona un cliente" and the submit button does **not** get stuck showing "Salvataggio...".
11. Select a customer, fill in the rest, submit. Confirm the appointment is created normally and appears on the calendar.
12. Resize the browser to a mobile width (~375px) or use device toolbar. Repeat steps 4-8. Confirm the dropdown list matches the input's width, doesn't overflow the viewport horizontally, and stays reachable/scrollable if it's near the bottom of the screen (Radix's collision detection should flip it above the input if there's no room below).
13. Open an **existing** appointment (edit mode) that already has a customer assigned. Confirm the Cliente field opens already showing that customer's name in the locked/selected state (not empty search mode).

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add components/calendar/AppointmentModal.tsx
git commit -m "$(cat <<'EOF'
feat: replace customer select with searchable combobox

The Cliente field in AppointmentModal now uses SearchableSelect: the
operator types a name or surname and the list filters live instead
of scrolling a native <select>. Required-field validation moves from
the native `required` attribute into handleSubmit, since the check
now needs to run before the loading state flips (an early return
after setLoading(true) would have left the submit button stuck).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan verification

After Task 2 is committed, run `/verify` to confirm the end-to-end flow (open modal → search → select → submit → appointment persisted and visible on the calendar) works in the running app, per CLAUDE.md's skill table. No `/security-review` is needed — this plan touches no auth, role checks, env vars, or Prisma queries.

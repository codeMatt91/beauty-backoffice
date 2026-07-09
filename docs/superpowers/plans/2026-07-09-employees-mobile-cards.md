# Employees Page Mobile Card View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `/employees` on mobile viewports (table currently overflows/gets cut off) by giving it a responsive card layout, and extract the page's inline `UserModal` and user-list markup into `components/employees/`, matching the existing `/customers` file layout.

**Architecture:** Two new Client Components in `components/employees/`: `UserTable.tsx` (desktop `<table>`, unchanged markup, plus a new `md:hidden` card list — same dual-layout pattern as `components/customers/CustomerTable.tsx`) and `UserModal.tsx` (the existing create/edit modal, moved verbatim). `app/(dashboard)/employees/page.tsx` shrinks to state + data-fetching orchestration only.

**Tech Stack:** Next.js 15 App Router, React Client Components, Tailwind CSS, `lucide-react` icons, `@radix-ui/react-dialog` (unchanged, already used by the existing modal).

## Global Constraints

- Tailwind utility classes only — no inline `style`, no CSS modules (CLAUDE.md Frontend design guidelines).
- Mobile-first: mobile card list uses `md:hidden`, desktop table uses `hidden md:block` — same breakpoint convention as `CustomerTable.tsx`.
- Small, focused components: if a page file exceeds ~150 lines, extract sub-components into `components/<feature>/` (CLAUDE.md).
- Semantic HTML + basic a11y: icon-only buttons keep their existing `aria-label`s.
- No changes to `actions/users.ts` (server actions, validation, `deleteUser` business rules stay as-is) — per spec non-goals.
- No new features (no search/filter) — per spec non-goals.
- This project has no automated test runner (`package.json` scripts are `dev`, `build`, `start`, `lint`, `db:*` only) — verification is `npm run lint` plus manual browser check via the `/run` skill, not `jest`/`playwright`-style automated tests.
- Spec reference: `docs/superpowers/specs/2026-07-09-employees-mobile-cards-design.md`.

---

### Task 1: Extract `UserTable` with desktop table + mobile cards, wire into `page.tsx`

**Files:**
- Create: `components/employees/UserTable.tsx`
- Modify: `app/(dashboard)/employees/page.tsx:1-17` (imports + `UserRecord` interface removal), `app/(dashboard)/employees/page.tsx:165-214` (inline table replaced with `<UserTable>`)

**Interfaces:**
- Produces: `export interface UserRecord { id: string; name: string; email: string; role: Role; createdAt: Date }` and `export default function UserTable({ users, onEdit, onDelete }: { users: UserRecord[]; onEdit: (user: UserRecord) => void; onDelete: (id: string, name: string) => void })` — both consumed by Task 2 (`UserModal.tsx` imports the `UserRecord` type) and by `page.tsx`.

- [ ] **Step 1: Create `components/employees/UserTable.tsx`**

```tsx
"use client";

import { Pencil, Trash2, Shield, User as UserIcon } from "lucide-react";
import { Role } from "@prisma/client";
import { formatDate } from "@/lib/utils";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

interface Props {
  users: UserRecord[];
  onEdit: (user: UserRecord) => void;
  onDelete: (id: string, name: string) => void;
}

export default function UserTable({ users, onEdit, onDelete }: Props) {
  return (
    <>
      {/* Table – Desktop */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ruolo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Registrato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    u.role === "ADMIN"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                    {u.role === "ADMIN" ? "Admin" : "Dipendente"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onEdit(u)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      aria-label={`Modifica ${u.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(u.id, u.name)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label={`Elimina ${u.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards – Mobile */}
      <div className="md:hidden space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{u.name}</p>
                <p className="text-sm text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onEdit(u)}
                  className="p-2 rounded-lg hover:bg-secondary"
                  aria-label={`Modifica ${u.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(u.id, u.name)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                  aria-label={`Elimina ${u.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                u.role === "ADMIN"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                {u.role === "ADMIN" ? "Admin" : "Dipendente"}
              </span>
              <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Replace the inline `UserRecord` interface and table JSX in `app/(dashboard)/employees/page.tsx`**

Replace the top of the file (lines 1–17):

```tsx
"use client";

import { useState, useEffect } from "react";
import { getAllUsers, createUser, updateUser, deleteUser } from "@/actions/users";
import Header from "@/components/layout/Header";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Pencil, Trash2, UserCog, Shield, User, X } from "lucide-react";
import { Role } from "@prisma/client";
import { formatDate } from "@/lib/utils";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}
```

with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { getAllUsers, createUser, updateUser, deleteUser } from "@/actions/users";
import Header from "@/components/layout/Header";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, UserCog, X } from "lucide-react";
import { Role } from "@prisma/client";
import UserTable, { UserRecord } from "@/components/employees/UserTable";
```

(`Pencil`, `Trash2`, `Shield`, `User`, `formatDate` are no longer used directly in `page.tsx` after this step — they now live only in `UserTable.tsx`. `UserModal` in this file still uses `Role`, `Dialog`, `X`, `useState`, so those imports stay for now; it will be extracted in Task 2.)

Then replace the `<div className="rounded-xl border border-border overflow-hidden">...</div>` block (the full desktop `<table>` JSX, current lines 165–214) with:

```tsx
        <UserTable
          users={users}
          onEdit={(u) => { setEditingUser(u); setModalOpen(true); }}
          onDelete={handleDelete}
        />
```

- [ ] **Step 3: Run lint to catch unused imports / type errors**

Run: `npm run lint`
Expected: no errors. If lint flags `Pencil`, `Trash2`, `Shield`, `User`, or `formatDate` as unused in `page.tsx`, confirm they were removed from the import list in Step 2 (they should already be gone — `UserModal`, still inline at this point, doesn't use any of them).

- [ ] **Step 4: Visually verify in the running app (use the `/run` skill)**

Start the dev server (`npm run dev`), sign in as an ADMIN, open `/employees`:
1. Desktop width (`md:` and above): table renders exactly as before — same columns, same edit/delete buttons working.
2. Resize to a mobile viewport (or browser device toolbar): the table disappears, replaced by one card per user with no horizontal overflow — name, email, role badge, registered date, and working edit/delete icon buttons all visible.
3. Tapping edit on a mobile card opens the (still inline, unchanged) `UserModal` pre-filled with that user's data.
4. Tapping delete on a mobile card triggers the existing `confirm()` dialog; confirming removes the user from the list (or shows the existing error banner if the delete is rejected, e.g. deleting the last admin).

Expected: all four checks pass.

- [ ] **Step 5: Commit**

```bash
git add components/employees/UserTable.tsx app/\(dashboard\)/employees/page.tsx
git commit -m "$(cat <<'EOF'
Add mobile card view for the employees list

The employees table had no mobile treatment and got cut off on small
viewports. Extract it into UserTable.tsx with the same dual desktop
table / mobile card layout already used by CustomerTable.tsx.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extract `UserModal` into its own file

**Files:**
- Create: `components/employees/UserModal.tsx`
- Modify: `app/(dashboard)/employees/page.tsx` (remove inline `UserModal` definition and now-unused imports, import from new location)

**Interfaces:**
- Consumes: `UserRecord` type from `components/employees/UserTable.tsx` (produced in Task 1).
- Produces: `export default function UserModal({ user, onClose, onSaved }: { user?: UserRecord | null; onClose: () => void; onSaved: () => void })` — consumed by `page.tsx`.

- [ ] **Step 1: Create `components/employees/UserModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import { createUser, updateUser } from "@/actions/users";
import * as Dialog from "@radix-ui/react-dialog";
import { Role } from "@prisma/client";
import { X } from "lucide-react";
import type { UserRecord } from "./UserTable";

export default function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user?: UserRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = user
        ? await updateUser(user.id, { name, email, role, ...(password ? { password } : {}) })
        : await createUser({ name, email, password, role });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Errore durante il salvataggio. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl border border-border focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold">
              {user ? "Modifica utente" : "Nuovo utente"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome completo *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Password {user ? "(lascia vuoto per non cambiare)" : "*"}
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required={!user} minLength={8} placeholder="Min. 8 caratteri"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ruolo</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="EMPLOYEE">Dipendente</option>
                <option value="ADMIN">Amministratore</option>
              </select>
            </div>
            {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary">Annulla</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50">
                {loading ? "..." : user ? "Aggiorna" : "Crea"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Replace the remaining contents of `app/(dashboard)/employees/page.tsx`**

The full file should now read:

```tsx
"use client";

import { useState, useEffect } from "react";
import { getAllUsers, deleteUser } from "@/actions/users";
import Header from "@/components/layout/Header";
import { Plus, UserCog } from "lucide-react";
import UserTable, { UserRecord } from "@/components/employees/UserTable";
import UserModal from "@/components/employees/UserModal";

export default function EmployeesPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    const data = await getAllUsers();
    setUsers(data as UserRecord[]);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare l'account di ${name}?`)) return;
    setDeleteError(null);
    try {
      const result = await deleteUser(id);
      if (!result.success) {
        setDeleteError(result.error);
        return;
      }
      load();
    } catch {
      setDeleteError("Errore durante l'eliminazione. Riprova.");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Gestione Dipendenti" userName="" />
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {deleteError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {deleteError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Utenti del sistema</h2>
              <p className="text-sm text-muted-foreground">{users.length} account</p>
            </div>
          </div>
          <button onClick={() => { setEditingUser(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            Nuovo utente
          </button>
        </div>

        <UserTable
          users={users}
          onEdit={(u) => { setEditingUser(u); setModalOpen(true); }}
          onDelete={handleDelete}
        />
      </div>

      {modalOpen && (
        <UserModal
          user={editingUser}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
```

(This drops `createUser`/`updateUser` from the `actions/users` import — they're used only inside `UserModal.tsx` now — and drops `Dialog`, `Role`, `X` — used only inside the two new component files.)

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors, no unused-import warnings in `page.tsx`.

- [ ] **Step 4: Visually verify in the running app (use the `/run` skill)**

With the dev server running, on `/employees`:
1. "Nuovo utente" opens the modal, creating a user still works, list refreshes.
2. Editing a user (from both desktop table and mobile card, resizing to check both) pre-fills the modal and saves correctly.
3. All Task 1 mobile-card checks still hold (no regression from moving the modal).

Expected: all checks pass, `page.tsx` is around 80 lines.

- [ ] **Step 5: Commit**

```bash
git add components/employees/UserModal.tsx app/\(dashboard\)/employees/page.tsx
git commit -m "$(cat <<'EOF'
Extract UserModal out of the employees page

Move the inline create/edit modal into its own component so
page.tsx is orchestration-only, matching the /customers file layout
(CustomerTable.tsx + CustomerForm.tsx).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan verification

After both tasks are committed, run the `/verify` skill to confirm the full flow works end-to-end in the running app (create, edit, delete, on both desktop and mobile widths) before considering this complete, per CLAUDE.md's skill table.

# Employees page — mobile card view

## Problem

On `/employees`, the user list is rendered as a plain HTML `<table>` (`app/(dashboard)/employees/page.tsx`) with no mobile treatment. On mobile viewports the table overflows and gets cut off — columns are clipped and the row action buttons become hard to reach. `/customers` already solved this exact problem with a dual desktop-table / mobile-card layout in `CustomerTable.tsx`, but `/employees` was never updated to match.

`app/(dashboard)/employees/page.tsx` is also 226 lines, mixing the `UserModal` component, the list rendering, and page orchestration in one file — over the project's ~150-line guideline for extracting sub-components.

## Goal

- Employees table is fully usable on mobile: each user renders as a card with the same information and actions as the desktop table, no horizontal cutoff.
- Extract `UserModal` and the user list (table + cards) out of `page.tsx` into `components/employees/`, mirroring the `/customers` file layout (`CustomerTable.tsx`, `CustomerForm.tsx`).

## Non-goals

- No changes to `actions/users.ts` (server actions, validation, `deleteUser` business rules stay as-is).
- No new features (no search/filter — `/employees` doesn't have one today and this spec doesn't add one).
- No visual redesign of the desktop table — its markup is moved, not changed.

## Design

### New files

**`components/employees/UserTable.tsx`** (Client Component)
- Props: `{ users: UserRecord[]; onEdit: (user: UserRecord) => void; onDelete: (id: string, name: string) => void }`
- `UserRecord` interface moved here from `page.tsx`.
- Renders two sibling blocks, same responsive split as `CustomerTable.tsx`:
  - **Desktop table** (`hidden md:block rounded-xl border border-border overflow-hidden`): today's `<table>` markup moved verbatim (columns: Nome, Email, Ruolo, Registrato, actions). No behavior change.
  - **Mobile cards** (`md:hidden space-y-2`): one `div.bg-card.rounded-xl.border.border-border.p-4` per user:
    - Top row: name (`font-medium text-foreground`) + email (`text-sm text-muted-foreground truncate`) on the left; edit (`Pencil`) and delete (`Trash2`) icon buttons on the right, same `aria-label`s as today (`Modifica ${name}`, `Elimina ${name}`).
    - Second row (`flex items-center gap-3 mt-2 text-xs`): role badge (unchanged styling/icon logic — `Shield`+"Admin" or `User`+"Dipendente") followed by the registered date (`formatDate(u.createdAt)`, muted).
  - Both blocks map over the same `users` array — no separate filtering/state, since there's no search feature in scope.
  - Delete buttons call `onDelete(u.id, u.name)` directly (no `confirm()` or server-action call inside `UserTable` — that logic stays in the page, see below).

**`components/employees/UserModal.tsx`** (Client Component)
- The existing `UserModal` function moved as-is (props, state, `handleSubmit`, markup all unchanged). Imports adjusted (`useState`, `Dialog`, icons, `Role`, `createUser`/`updateUser`).

### Changed file

**`app/(dashboard)/employees/page.tsx`**
- Keeps: `users`/`modalOpen`/`editingUser`/`deleteError` state, `load()`, `handleDelete(id, name)` (unchanged — still calls the `deleteUser` server action, still surfaces its error string in the banner, since `deleteUser` can reject with a specific message like "non puoi eliminare l'ultimo account Admin").
- Renders: `Header`, the toolbar (title + "Nuovo utente" button, unchanged), `<UserTable users={users} onEdit={...} onDelete={handleDelete} />`, and the conditional `<UserModal .../>`.
- Drops the inline `UserModal` definition and the inline `<table>` JSX — both replaced by the imports above.
- Expected to shrink from 226 to roughly 80 lines.

### Why `onDelete` stays a callback instead of `UserTable` calling `deleteUser` itself

`CustomerTable.tsx` calls `deleteCustomer` directly and swallows any error. `deleteUser` is different: it can legitimately fail with a user-facing reason (last admin, own account) that must reach the error banner above the list. Keeping the server-action call in `page.tsx` (as today) avoids threading a `setDeleteError` setter down into `UserTable` just to move the call site.

## Testing / verification

- Run `/run`, open `/employees` as an ADMIN, resize to a mobile viewport (or use device emulation):
  - No horizontal overflow/cutoff; each user appears as a card with name, email, role badge, registered date, and working edit/delete buttons.
  - Tapping edit opens `UserModal` pre-filled, same as before.
  - Tapping delete triggers the existing `confirm()` dialog and, on confirm, either removes the user or shows the existing error banner (test both the "delete last admin" and "delete self" rejection paths).
- Resize back to desktop width: table renders exactly as before (no visual regression).
- `npm run lint` passes with no new warnings.

# Mobile header logout button

## Problem

On mobile viewports, the hamburger menu button in `Header.tsx` (top-left, `lg:hidden`) has no `onClick` handler and does nothing when tapped. It's dead UI.

## Goal

Replace the non-functional hamburger button with a working logout button, visible only on mobile (same `lg:hidden` breakpoint), with a confirmation step before signing out.

## Non-goals

- No changes to `MobileNav.tsx` (bottom nav bar) — it already handles mobile navigation between pages, so the hamburger was never needed for that purpose.
- No changes to desktop `Sidebar.tsx` — its existing logout button (immediate, no confirmation) stays as-is.

## Design

**File touched:** `components/layout/Header.tsx` only. Already a Client Component; already imports `signOut` from `next-auth/react` and the `LogOut` icon from `lucide-react` (currently unused).

1. Remove the `Menu` icon import and its button.
2. Add a `LogOut` icon button in its place, same `lg:hidden p-1.5 rounded-md hover:bg-secondary` styling as the button it replaces, with `aria-label="Esci"`.
3. Add local state `const [confirmOpen, setConfirmOpen] = useState(false)`. Clicking the button sets it `true`.
4. Confirmation dialog built with `@radix-ui/react-dialog` (already a project dependency, already used in `CustomerForm.tsx` — no new dependency, matches CLAUDE.md's "Radix UI for interactive primitives" rule).
   - Title: "Esci dall'account?"
   - Body copy: short one-liner, e.g. "Dovrai effettuare nuovamente l'accesso per continuare."
   - Two buttons: "Annulla" (closes dialog, `Dialog.Close` / `onOpenChange(false)`) and "Esci" (calls `signOut({ callbackUrl: "/login" })`).
   - Styling follows the existing `Dialog.Content` pattern from `CustomerForm.tsx` (centered, rounded-2xl, `bg-card`, overlay `bg-black/40`).

## Testing / verification

- Run `/run` to start the dev server, resize to a mobile viewport, confirm:
  - The old hamburger icon is gone, replaced by a logout icon.
  - Tapping it opens the confirmation dialog (does not log out immediately).
  - "Annulla" closes the dialog with no side effects.
  - "Esci" signs the user out and redirects to `/login`.
- Desktop (`lg:` and above) is unaffected — the button remains hidden there, Sidebar logout still works as before.

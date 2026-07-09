# Mobile Header Logout Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-functional mobile hamburger button in `Header.tsx` with a working logout button that opens a confirmation dialog before signing out.

**Architecture:** Single-file change to `components/layout/Header.tsx`. Add local `useState` for dialog visibility, replace the dead `Menu` button with a `LogOut` button, and add a `@radix-ui/react-dialog` confirmation dialog whose confirm action calls `signOut({ callbackUrl: "/login" })` from `next-auth/react`.

**Tech Stack:** Next.js 15 App Router, React Client Component, `@radix-ui/react-dialog` (already a project dependency), `lucide-react` icons, Tailwind CSS, `next-auth/react` `signOut`.

## Global Constraints

- Tailwind utility classes only — no inline `style`, no CSS modules (per CLAUDE.md Frontend design guidelines).
- Use Radix UI primitives for interactive components instead of building custom ones from scratch (per CLAUDE.md).
- Mark Client Components `"use client"` only when needed — `Header.tsx` already is one.
- Semantic HTML + basic a11y: icon-only buttons need `aria-label`.
- This project has no automated test runner (`package.json` scripts are `dev`, `build`, `start`, `lint`, `db:*` only) — verification is `npm run lint` plus manual browser check via the `/run` skill, not `pytest`/`jest`-style unit tests.

---

### Task 1: Replace hamburger with logout button + confirmation dialog

**Files:**
- Modify: `components/layout/Header.tsx` (full file, currently 38 lines)

**Interfaces:**
- Consumes: `signOut` from `next-auth/react` (already imported), `Dialog` namespace from `@radix-ui/react-dialog` (new import in this file, existing project dependency — see usage pattern in `components/customers/CustomerForm.tsx`).
- Produces: nothing consumed by other files — `Header` keeps its existing exported signature `Header({ title, userName }: HeaderProps)`.

- [ ] **Step 1: Replace the full contents of `components/layout/Header.tsx`**

```tsx
"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Bell } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

interface HeaderProps {
  title: string;
  userName: string;
}

export default function Header({ title, userName }: HeaderProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setConfirmOpen(true)}
          aria-label="Esci"
          className="lg:hidden p-1.5 rounded-md hover:bg-secondary"
        >
          <LogOut className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground hidden md:block">
            {userName}
          </span>
        </div>
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-card shadow-2xl border border-border focus:outline-none p-5">
            <Dialog.Title className="font-semibold text-foreground">
              Esci dall&apos;account?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mt-1">
              Dovrai effettuare nuovamente l&apos;accesso per continuare.
            </Dialog.Description>
            <div className="flex gap-2 pt-4">
              <Dialog.Close asChild>
                <button className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  Annulla
                </button>
              </Dialog.Close>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Esci
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
```

This removes the `Menu` import (unused after this change) and the dead `<button className="lg:hidden ...">` that had no `onClick`.

- [ ] **Step 2: Run lint to catch type/import errors**

Run: `npm run lint`
Expected: no errors related to `components/layout/Header.tsx` (no unused-import warning for `Menu`, no missing-dependency warnings).

- [ ] **Step 3: Visually verify in the running app (use the `/run` skill)**

Start the dev server (`npm run dev`), open the app in a mobile-width viewport (or browser device toolbar), and check:
1. The top-left icon in the header is now a logout icon, not a hamburger.
2. Tapping it opens a dialog titled "Esci dall'account?" — the user is NOT logged out yet.
3. Tapping "Annulla" closes the dialog with no navigation and no session change.
4. Tapping "Esci" signs the user out and redirects to `/login`.
5. Resize to desktop width (`lg:` and above) — the button is hidden, header looks unchanged from before, and the desktop `Sidebar` logout button still works independently.

Expected: all five checks pass.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "$(cat <<'EOF'
fix: replace non-functional mobile hamburger with logout button

The hamburger button in Header.tsx had no onClick handler and did
nothing on mobile. MobileNav already covers mobile navigation, so
replace it with a logout action (with confirmation dialog) instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan verification

After Task 1 is committed, run the `/verify` skill to confirm the change works end-to-end in the running app before considering this complete, per CLAUDE.md's skill table.

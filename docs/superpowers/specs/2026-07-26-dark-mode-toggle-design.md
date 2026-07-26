# Dark Mode Toggle — Design Spec
Date: 2026-07-26

## Goal
Add a dark mode toggle button to the app's shared header (works identically on desktop and mobile, since there's only one header component), with dynamic sun/moon icons, persisted across sessions, defaulting to the OS/browser's `prefers-color-scheme` on first visit, with no flash of the wrong theme on load — while keeping every section of the app well-contrasted in both themes.

## Context
- `app/globals.css` already defines a complete `.dark { ... }` CSS custom-property block (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring), mirroring the `:root` light values with dark-appropriate HSL values. This has existed since the project's initial styling pass but has never been activated — nothing ever adds the `.dark` class anywhere.
- `tailwind.config.ts` already has `darkMode: ["class"]` and maps every semantic color (`background`, `foreground`, `card`, `border`, `muted`, `accent`, `destructive`, `popover`, `primary`, `secondary`) to `hsl(var(--*))`. No Tailwind config change is needed.
- The overwhelming majority of components already use these semantic classes (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-secondary`, etc.) rather than literal Tailwind palette colors, so they will automatically re-theme correctly the moment `.dark` is applied to an ancestor element — verified by grepping the whole `app/`/`components/` tree for hardcoded `bg-*-###`/`text-*-###` classes.
- `components/finance/FinancialChart.tsx` (Recharts) already renders its grid, axis ticks, and reference line using `hsl(var(--border))`/`hsl(var(--muted-foreground))`/`hsl(var(--primary))`, and its custom tooltip uses `bg-card`/`text-foreground`/`border-border` — it is already dark-mode-aware with no changes needed.
- Exactly 3 files use hardcoded literal Tailwind color classes that bypass the semantic token system and need explicit `dark:` variants to stay well-contrasted against a dark background:
  - `app/(dashboard)/settings/page.tsx` — the "Pulizia e Archiviazione Dati" card (amber warning theme: `bg-amber-50`, `border-amber-100/200`, `text-amber-600/700/800/900`, `bg-amber-600` button) and its success feedback block (`bg-emerald-50`, `border-emerald-200`, `text-emerald-600/800`, `bg-emerald-100`).
  - `app/(dashboard)/finance/page.tsx` — KPI badges (`bg-emerald-100 text-emerald-600`, `bg-red-100 text-red-600`) and expense-amount text (`text-red-600`).
  - `components/calendar/CalendarView.tsx` — appointment payment-status badges (`bg-emerald-100 text-emerald-800 border-emerald-200` / `bg-amber-100 text-amber-800 border-amber-200` / `bg-slate-100 text-slate-700 border-slate-200`).
- `components/layout/SharedHeader.tsx` is the single header rendered for both desktop and mobile (a `h-14` bar with page title, notification bell, and user menu, made responsive only via a couple of `lg:` classes for a mobile-only logout icon) — there is no separate mobile header component, so the toggle only needs to be added in one place.
- No `next-themes` (or any theming library) is installed. The project's stated preference (CLAUDE.md: "Avoid large client-side dependencies... check bundle impact before adding a new package") and its otherwise minimal dependency footprint (Radix, lucide-react, recharts — nothing else UI-related) favor a small hand-written implementation over a new dependency, especially since the CSS infrastructure this would normally provide already exists.

## Decisions
- **No new dependency.** Implemented with a small client component + a tiny inline bootstrap script, using the same flash-prevention technique theming libraries use internally (synchronous script in `<head>`, before hydration).
- **Persistence:** `localStorage` key `"theme"`, value `"light"` or `"dark"`.
- **First-visit default:** if no `localStorage` value exists, follow `window.matchMedia("(prefers-color-scheme: dark)")`.
- **Toggle placement:** one button in `SharedHeader.tsx`, next to the existing "Notifiche" bell button — reaches both desktop and mobile since it's the same shared component.
- **Icon:** `lucide-react`'s `Sun`/`Moon` (already the icon library used everywhere else in this project), swapped based on current theme. The icon shown reflects the *current* state — sun visible while the app is currently light (click to switch to dark), moon visible while the app is currently dark (click to switch to light) — detailed in Section 2.
- **Contrast fixes:** targeted `dark:` variant additions only to the 3 files identified above. No sitewide rewrite — everything already on semantic tokens needs no change.

---

## Section 1 — Flash-free bootstrap

**File:** `app/layout.tsx`

A synchronous inline `<script>` in `<head>`, before the stylesheet/body render, reads `localStorage.theme` (falling back to `prefers-color-scheme`) and sets `document.documentElement.classList` accordingly — this runs before first paint, so there's no flash of the wrong theme. This is a plain inline script (allowed — it's not a new CSS mechanism, just a `<head>` script, consistent with "Tailwind only for styling" since it manipulates a class, not styles directly).

```tsx
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
```

Injected via `<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />` in `<head>`, ahead of `{children}`.

---

## Section 2 — Toggle component

**File:** `components/layout/ThemeToggle.tsx` (new)

A small `"use client"` component:
- On mount, reads the current state by checking `document.documentElement.classList.contains('dark')` (already set correctly by the bootstrap script from Section 1 — no separate read-from-localStorage needed here, avoiding a duplicate source of truth).
- Renders a single icon button that reflects the *current* theme: `Sun` icon while in light mode (click → switches to dark), `Moon` icon while in dark mode (click → switches to light). Reads naturally at a glance ("it's currently bright" / "it's currently dark") without needing to think of it as an action button.
- On click: toggles the `dark` class on `document.documentElement`, writes the new value to `localStorage.theme`, updates local state to re-render the icon.
- `aria-label` reflects the action ("Attiva tema scuro" / "Attiva tema chiaro"), matching the existing icon-only-button accessibility pattern already used for the Notifiche bell and other icon buttons in this codebase (CLAUDE.md: "add `aria-label` on icon-only buttons").
- Styled identically to the adjacent Notifiche button (`p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors`) for visual consistency.

---

## Section 3 — Header wiring

**File:** `components/layout/SharedHeader.tsx`

Add `<ThemeToggle />` in the right-hand icon group, before the Notifiche bell button (`<div className="flex items-center gap-2">`). No other change to this file.

---

## Section 4 — Contrast fixes for hardcoded-color sections

**Files:** `app/(dashboard)/settings/page.tsx`, `app/(dashboard)/finance/page.tsx`, `components/calendar/CalendarView.tsx`

Add `dark:` variants to every literal color class identified in Context, choosing values from Tailwind's existing palette that keep the same semantic meaning (amber = warning, emerald = success/paid, red = danger/unpaid, slate = neutral/optional) while remaining readable against the dark theme's near-black background (`--background: 340 10% 8%` ≈ very dark rose-tinted gray). Pattern: light-mode pale background (`bg-amber-50`) gets a dark-mode variant using a low-opacity tint of the same hue against the dark surface (`dark:bg-amber-950/40` or similar), and text/border colors get lightened variants (`dark:text-amber-400`, `dark:border-amber-900`) so contrast ratios stay comfortable — exact shade selection happens during implementation with a real visual check in both themes (this is a visual/contrast judgment call better made by looking at the rendered result than by specifying exact hex values in a design doc).

---

## Section 5 — Testing

No automated test framework in this repo (manual verification only, per project convention):
- Toggle the button on `/calendar` (or any page) in both desktop (≥1024px) and mobile (<768px) viewport widths; confirm the icon swaps (sun ↔ moon) and the whole page (sidebar, header, cards, tables, modals) re-themes instantly with no unstyled flash.
- Reload the page after toggling to dark; confirm it stays dark (localStorage persistence) with no flash of light theme before dark applies.
- Clear `localStorage` and reload with the OS/browser set to dark color scheme; confirm the app opens in dark mode without any manual toggle.
- Visit `/settings`, `/finance`, and `/calendar` (with at least one PAID/PENDING/OPTIONAL appointment visible) in dark mode; confirm the amber Data Purge card, the finance KPI badges/red expense figures, and the calendar payment-status badges are all clearly readable (not washed out, not clashing) against the dark background.
- Confirm light mode is visually unchanged from before this feature (no regression to the existing default appearance).

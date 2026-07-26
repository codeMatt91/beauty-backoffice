# Dark Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working, flash-free, persisted dark mode toggle to the app's single shared header (desktop + mobile), using the dark-theme CSS variables that already exist in `globals.css` but have never been activated, and touch up the few components that use hardcoded colors instead of those variables so they stay readable in dark mode.

**Architecture:** A synchronous inline bootstrap script in `app/layout.tsx`'s `<head>` applies the `dark` class to `<html>` before first paint (reading `localStorage`, falling back to `prefers-color-scheme`), eliminating theme-flash without any library. A small client component (`ThemeToggle.tsx`) renders the sun/moon button and toggles the class + `localStorage` on click. It's wired into `SharedHeader.tsx`, the one header component already rendered on both desktop and mobile. A second task adds `dark:` variant classes to the handful of places that use literal Tailwind palette colors instead of the semantic `bg-card`/`text-foreground`-style tokens most of the app already uses (and which already re-theme automatically).

**Tech Stack:** Next.js 15 App Router, Tailwind CSS (`darkMode: ["class"]`, already configured), `lucide-react` icons, plain React state — no new npm dependency.

## Global Constraints

- No new npm dependency (no `next-themes` or similar) — this is a deliberate choice from the spec, given the CSS infrastructure already exists and the project's stated preference to avoid adding client-side dependencies without checking bundle impact.
- `localStorage` key is exactly `"theme"`, values exactly `"light"` / `"dark"`.
- First-visit default (no stored value): follow `window.matchMedia("(prefers-color-scheme: dark)")`.
- The toggle icon reflects the *current* theme: `Sun` visible while in light mode (click → dark), `Moon` visible while in dark mode (click → light).
- No test framework in this repo (no jest/vitest, no `test` npm script) — verification is `npx tsc --noEmit`, `npm run lint`, and manual browser checks (this repo already has Playwright installed as a dependency and Chromium pre-downloaded, usable for end-to-end verification the same way it was used for the previous feature in this codebase).
- Only touch the exact files identified in the spec for contrast fixes — no sitewide rewrite. Everything already using `bg-card`/`text-foreground`/`text-muted-foreground`/`border-border`/etc. needs no change.

---

### Task 1: Theme bootstrap script, toggle component, and header wiring

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/layout/ThemeToggle.tsx`
- Modify: `components/layout/SharedHeader.tsx`

**Interfaces:**
- Produces: a working dark-mode toggle reachable from every page (both desktop ≥1024px and mobile <768px, since `SharedHeader` is the one header used at both sizes). No other task consumes an interface from this one — Task 2's contrast fixes are visually verified using the toggle this task builds, but don't import anything from it.

- [ ] **Step 1: Add the flash-prevention bootstrap script to `app/layout.tsx`**

Current file:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Beauty Backoffice",
  description: "Gestionale per centri estetici",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

Replace it with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Beauty Backoffice",
  description: "Gestionale per centri estetici",
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

This script runs synchronously before the page paints (Next.js renders `<head>` content before `<body>` hydrates), so the correct theme class is present on `<html>` before any content is visible — no flash of the wrong theme.

- [ ] **Step 2: Create `components/layout/ThemeToggle.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Attiva tema chiaro" : "Attiva tema scuro"}
      className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
    >
      {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
```

`useEffect` (not `useState(() => ...)`) is used deliberately for the initial read: `document` doesn't exist during server rendering, and this keeps the component's first client render consistent with what the server rendered (both start assuming `isDark = false` / `Sun` icon), then immediately corrects itself on mount before the user perceives it — the bootstrap script from Step 1 has already set the real class on `<html>` by this point, so the icon self-corrects in the same frame, not after a visible delay.

- [ ] **Step 3: Wire `ThemeToggle` into `SharedHeader.tsx`**

Find this block in `components/layout/SharedHeader.tsx`:

```tsx
      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          aria-label="Notifiche"
        >
          <Bell className="w-4 h-4" />
        </button>
```

Replace with:

```tsx
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          aria-label="Notifiche"
        >
          <Bell className="w-4 h-4" />
        </button>
```

And add the import — find:

```tsx
import UserProfileButton from "./UserProfileButton";
```

Replace with:

```tsx
import UserProfileButton from "./UserProfileButton";
import ThemeToggle from "./ThemeToggle";
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors/new warnings from any of the three changed/created files.

- [ ] **Step 5: Start the dev server if it isn't already running**

```bash
lsof -i :3000 -sTCP:LISTEN || (rm -rf .next && npm run dev > /tmp/beauty-dev.log 2>&1 & disown; sleep 6)
```

(`rm -rf .next` first if you do start it fresh — this repo has previously hit webpack module-cache corruption from a stray `next build` sharing the same `.next` directory as a running `next dev`; starting clean avoids that class of false failure.)

- [ ] **Step 6: Browser-driven verification with Playwright**

This repo has `playwright` installed as a dependency with Chromium already downloaded (used successfully for end-to-end verification of a previous feature in this codebase). Write a temporary script, run it, then delete it:

```bash
cat > .tmp-verify-dark-mode.mjs <<'EOF'
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

function log(step, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? " - " + extra : ""}`);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "admin@beauty.it");
  await page.fill('input[type="password"]', "admin1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/calendar`, { timeout: 10000 });

  // Starts light (no stored preference, assuming a light-mode test environment)
  const initiallyDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log("Toggle button visible in header", await page.locator('button[aria-label="Attiva tema scuro"], button[aria-label="Attiva tema chiaro"]').isVisible());

  const toggleBtn = page.locator('button[aria-label="Attiva tema scuro"], button[aria-label="Attiva tema chiaro"]');
  await toggleBtn.click();
  await page.waitForTimeout(200);
  const afterFirstClick = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log("First click flips the dark class", afterFirstClick !== initiallyDark, `${initiallyDark} -> ${afterFirstClick}`);

  const stored = await page.evaluate(() => localStorage.getItem("theme"));
  log("localStorage.theme matches current state", stored === (afterFirstClick ? "dark" : "light"), stored);

  await page.screenshot({ path: "/tmp/dark-mode-calendar.png", fullPage: true });

  // Reload — bootstrap script should re-apply the same theme with no flash
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  const afterReload = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log("Theme persists across reload", afterReload === afterFirstClick, `${afterReload}`);

  // Click again to toggle back
  const toggleBtn2 = page.locator('button[aria-label="Attiva tema scuro"], button[aria-label="Attiva tema chiaro"]');
  await toggleBtn2.click();
  await page.waitForTimeout(200);
  const afterSecondClick = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log("Second click flips back", afterSecondClick === initiallyDark, `${afterSecondClick}`);

  // Verify on mobile viewport too — same header component, same button should exist
  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  const mobileToggleVisible = await page.locator('button[aria-label="Attiva tema scuro"], button[aria-label="Attiva tema chiaro"]').isVisible();
  log("Toggle visible on mobile viewport too", mobileToggleVisible);
  await toggleBtn2.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/dark-mode-mobile.png", fullPage: true });

  await browser.close();
  console.log("\nDone. Screenshots: /tmp/dark-mode-calendar.png, /tmp/dark-mode-mobile.png");
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
EOF
node .tmp-verify-dark-mode.mjs
rm .tmp-verify-dark-mode.mjs
```

Expected: all `PASS` lines, no `FAIL`. Read both screenshots afterward (`/tmp/dark-mode-calendar.png`, `/tmp/dark-mode-mobile.png`) to visually confirm the whole page (sidebar, header, cards) re-themed correctly and the correct icon (sun/moon) is showing — don't just trust the boolean checks, actually look at the images.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx components/layout/ThemeToggle.tsx components/layout/SharedHeader.tsx
git commit -m "$(cat <<'EOF'
feat: add dark mode toggle to the shared header

Adds a flash-free dark mode toggle (sun/moon icon, localStorage
persistence, respects prefers-color-scheme on first visit) using the
dark-theme CSS variables already defined in globals.css but never
activated. No new dependency — a small inline bootstrap script plus a
client component cover what a theming library would otherwise provide.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Dark-mode contrast fixes for hardcoded-color sections

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx`
- Modify: `app/(dashboard)/finance/page.tsx`
- Modify: `components/calendar/CalendarView.tsx`

**Interfaces:** None — this task only adds Tailwind classes to existing JSX, no new functions/components/exports.

This task depends on Task 1 being complete (its own dev-server/toggle verification is how you'll visually confirm these fixes actually look right in dark mode).

- [ ] **Step 1: Fix `app/(dashboard)/settings/page.tsx`**

Find:

```tsx
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-50 border-amber-100">
            <Archive className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-900">Pulizia e Archiviazione Dati</h3>
              <p className="text-sm text-amber-700">
```

Replace with:

```tsx
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900">
            <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Pulizia e Archiviazione Dati</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
```

Find:

```tsx
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
```

Replace with:

```tsx
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 dark:bg-amber-950/40 dark:border-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
```

Find:

```tsx
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <p className="font-medium">Archiviazione completata</p>
                  <p>
                    {result.success.recordCount} appuntamenti esportati in{" "}
                    <span className="font-mono text-xs bg-emerald-100 px-1 rounded">
```

Replace with:

```tsx
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex gap-2 dark:bg-emerald-950/40 dark:border-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
                <div className="text-sm text-emerald-800 dark:text-emerald-300">
                  <p className="font-medium">Archiviazione completata</p>
                  <p>
                    {result.success.recordCount} appuntamenti esportati in{" "}
                    <span className="font-mono text-xs bg-emerald-100 px-1 rounded dark:bg-emerald-900/60 dark:text-emerald-200">
```

(The amber "Esporta e cancella dati" button — `bg-amber-600 text-white ... hover:bg-amber-700` — is left unchanged: white text on a solid `amber-600` background already has strong contrast in both themes, no `dark:` variant needed there.)

- [ ] **Step 2: Fix `app/(dashboard)/finance/page.tsx`**

Find:

```tsx
        <div className={`p-2 rounded-lg ${
          trend === "up" ? "bg-emerald-100 text-emerald-600" :
          trend === "down" ? "bg-red-100 text-red-600" :
          "bg-secondary text-muted-foreground"
        }`}>
```

Replace with:

```tsx
        <div className={`p-2 rounded-lg ${
          trend === "up" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" :
          trend === "down" ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400" :
          "bg-secondary text-muted-foreground"
        }`}>
```

Find (appears twice in the file — the per-row expense amount and the footer total; both need the same fix):

```tsx
                    <td className="px-4 py-2.5 text-right font-medium text-red-600">
                      -{formatCurrency(parseFloat(e.amount))}
                    </td>
```

Replace with:

```tsx
                    <td className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">
                      -{formatCurrency(parseFloat(e.amount))}
                    </td>
```

Find:

```tsx
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                      -{formatCurrency(expenses.reduce((s, e) => s + parseFloat(e.amount), 0))}
                    </td>
```

Replace with:

```tsx
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                      -{formatCurrency(expenses.reduce((s, e) => s + parseFloat(e.amount), 0))}
                    </td>
```

- [ ] **Step 3: Fix `components/calendar/CalendarView.tsx`**

Find:

```tsx
const STATUS_COLORS: Record<PaymentStatus, string> = {
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  OPTIONAL: "bg-slate-100 text-slate-700 border-slate-200",
};
```

Replace with:

```tsx
const STATUS_COLORS: Record<PaymentStatus, string> = {
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  OPTIONAL: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
};
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors/new warnings from the three changed files.

- [ ] **Step 5: Browser-driven visual verification**

The dev server should still be running from Task 1 (restart per Task 1 Step 5 if not). Write, run, and delete a temporary script:

```bash
cat > .tmp-verify-dark-contrast.mjs <<'EOF'
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "admin@beauty.it");
  await page.fill('input[type="password"]', "admin1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/calendar`, { timeout: 10000 });

  // Force dark mode on
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  });

  // Calendar — payment status badges
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "/tmp/dark-calendar-badges.png", fullPage: true });

  // Settings — Data Purge amber card
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "/tmp/dark-settings-purge.png", fullPage: true });

  // Finance — KPI cards and expense table red figures
  await page.goto(`${BASE}/finance`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/dark-finance.png", fullPage: true });

  await browser.close();
  console.log("Screenshots written: /tmp/dark-calendar-badges.png, /tmp/dark-settings-purge.png, /tmp/dark-finance.png");
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
EOF
node .tmp-verify-dark-contrast.mjs
rm .tmp-verify-dark-contrast.mjs
```

Read all three screenshots. Confirm, in each:
- Text is clearly legible against its background (no dark-gray-on-near-black or bright-on-bright combinations).
- Colored badges/cards read as their intended color family (amber = warning, emerald = success/paid, red = danger/unpaid, slate = neutral) rather than washing out to indistinguishable dark blobs.
- Nothing regressed elsewhere on those three pages (borders, card backgrounds, body text all still look like the rest of the now-dark-themed app).

If any specific element looks too dim or too harsh, adjust that one Tailwind shade by one step (e.g. `emerald-950/40` → `emerald-900/50` if too faint, or `amber-300` → `amber-200` if text needs to be brighter) and re-screenshot just that page — this is a visual judgment call the design spec explicitly left for implementation-time verification, not a fixed requirement to hit exactly.

- [ ] **Step 6: Toggle back to light mode and confirm no regression**

```bash
cat > .tmp-verify-light-unchanged.mjs <<'EOF'
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "admin@beauty.it");
  await page.fill('input[type="password"]', "admin1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/calendar`, { timeout: 10000 });

  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "/tmp/light-calendar-unchanged.png", fullPage: true });

  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "/tmp/light-settings-unchanged.png", fullPage: true });

  await browser.close();
  console.log("Screenshots written: /tmp/light-calendar-unchanged.png, /tmp/light-settings-unchanged.png");
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
EOF
node .tmp-verify-light-unchanged.mjs
rm .tmp-verify-light-unchanged.mjs
```

Read both screenshots. Confirm light mode looks exactly as it did before this task (the `dark:` classes added in Steps 1-3 are additive-only and inert outside the `.dark` scope, so this should be a formality, but confirm it rather than assume it).

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/settings/page.tsx" "app/(dashboard)/finance/page.tsx" components/calendar/CalendarView.tsx
git commit -m "$(cat <<'EOF'
fix: add dark mode contrast variants to hardcoded-color sections

The Data Purge card, finance KPI badges/expense figures, and calendar
payment-status badges used literal Tailwind palette colors instead of
the semantic bg-card/text-foreground-style tokens most of the app
already uses, so they didn't adapt when dark mode was introduced. Adds
targeted dark: variants so they stay readable and keep their intended
semantic color (warning/success/danger/neutral) against the dark theme.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Spec Coverage Check

- Section 1 (Flash-free bootstrap) → Task 1, Step 1.
- Section 2 (Toggle component) → Task 1, Step 2.
- Section 3 (Header wiring) → Task 1, Step 3.
- Section 4 (Contrast fixes) → Task 2, Steps 1-3.
- Section 5 (Testing) → Task 1 Step 6 (toggle/persistence/mobile) and Task 2 Steps 5-6 (contrast in dark mode, no regression in light mode) — all five bullet points from the spec's Testing section are covered by these Playwright scripts and the manual screenshot review they require.

# Service Color Legend — Design Spec

**Date:** 2026-08-13
**Status:** Approved

## Problem

In `/calendar`, the legend below the toolbar currently shows payment status ("Pagato"/"Da pagare"/"Opzionale"), and appointment blocks in all three views (month/week/day) are colored by that same status. This is the *only* visual representation payment status has anywhere in the calendar. The request is to replace both the legend and the appointment coloring with a per-**Prestazione** (`ServiceType`) scheme: each service gets a user-configurable color (colorpicker in `/settings`), the legend becomes one badge per configured service, and every appointment block is colored by its service's color instead.

## Solution

### 1. Data model

Extend `ServiceType` (already carries `defaultPrice`, `durationMinutes` from prior work):
```prisma
model ServiceType {
  id              String   @id @default(cuid())
  name            String   @unique
  defaultPrice    Decimal  @default(0) @db.Decimal(10, 2) @map("default_price")
  durationMinutes Int?     @map("duration_minutes")
  color           String   @default("#CCCCCC")
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("service_types")
}
```
- **Required with a default** (unlike `durationMinutes`, which is nullable) — the calendar always needs a color to render, so "unset" isn't a valid state; it's just the default gray.
- **Format: `#RRGGBB` only, no alpha channel.** The spec offered `#RRGGBBAA` as an option; alpha is dropped because it would require compositing against the calendar's background to compute a correct contrast ratio for the text-color decision, for negligible visual benefit. Confirmed with the user.
- Migration is additive: the DB column default (`'#CCCCCC'`) applies to all existing rows automatically — **no per-row color rotation/seeding logic.** Confirmed with the user: a single flat default for every legacy row, personalized manually in `/settings` afterward, is preferred over auto-assigning a rotating palette.

### 2. `/settings` — color field on the ServiceType form

In `ServiceTypeForm.tsx`, alongside the existing Prezzo/Durata fields: a native `<input type="color">` (the browser's own picker — swatch + OS color wheel, zero new dependencies, consistent with the project's "no external component libraries" constraint) paired with a synced `<input type="text">` for direct hex entry. New services default to `#CCCCCC` until changed.

**Duplicate-color warning (non-blocking):** computed client-side in the form, comparing the entered hex against the other `ServiceType` rows already loaded in `/settings` (case-insensitive, excluding self when editing) — no extra server round-trip. Shown as inline warning text, never blocks saving. This matches the functional spec's own explicit recommendation.

`ServiceTypeList.tsx` gains a small color swatch next to each service's name, in both the desktop table and the mobile card layout.

### 3. Dynamic colors vs. Tailwind's static analysis

Tailwind can't generate a class for a runtime-interpolated hex value (`bg-${color}` gets purged at build time). The legend badges and appointment blocks therefore set `backgroundColor`/`color` via inline `style`, while everything else (shape, padding, typography, hover states) stays on the existing Tailwind classes via `cn()`. This is a deliberate, narrow exception to the project's "Tailwind only" rule — confirmed with the user — justified because the color is genuinely arbitrary and user-chosen per record, which is exactly the case where inline styles are the standard, correct tool even in Tailwind-first codebases.

### 4. Contrast utility

New file `lib/colors.ts` (kept separate from the already-focused `lib/utils.ts`, which has no color logic to build on):
```typescript
export const DEFAULT_SERVICE_COLOR = "#CCCCCC";

export function getContrastingTextColor(hex: string): "#000000" | "#FFFFFF" {
  // standard YIQ luminance formula
}
```
Used everywhere a service color is rendered (legend badges, appointment blocks) to pick readable text color automatically.

### 5. Calendar — legend and appointment coloring

**New data flow:** `/calendar` currently never fetches `ServiceType` at the page level — it's only loaded inside the `AppointmentModal` popup. Mirror the existing `employees` pattern exactly:
- `app/(dashboard)/calendar/page.tsx`: add a third parallel Prisma query (`prisma.serviceType.findMany({ select: { id: true, name: true, color: true }, orderBy: { name: "asc" } })`), passed down as a new `serviceTypes` prop.
- `CalendarClient.tsx`: accepts `serviceTypes` and passes it straight through to `CalendarView` — no re-fetch on navigation (service colors change rarely, same reasoning already applied to `employees`).
- `CalendarView.tsx`: remove `STATUS_COLORS` (its only two uses — legend and the 3 appointment-block `className`s — are both being replaced; confirmed no other icon/border currently represents payment status). Add a `serviceTypeColor(name: string)` lookup (matches `appointment.serviceType` by name against the `serviceTypes` prop — same string-matching pattern already used in `AppointmentModal.handleServiceTypeChange`, since `Appointment.serviceType` has no FK relation), falling back to `DEFAULT_SERVICE_COLOR` when a service isn't found or has no color.

**Payment status visual cue:** removed from the calendar entirely — confirmed with the user. The underlying data and the payment-status `<select>` in `AppointmentModal` are untouched; the appointment blocks and legend just no longer represent it visually. This is the one explicit UX trade-off from the spec's open questions (§7), resolved as: simplicity over a combined indicator.

**Legend markup** (touch-friendly horizontal scroll, no existing pattern in this codebase to reuse — confirmed via search, built fresh but minimal):
```tsx
<div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain snap-x snap-proximity no-scrollbar px-4 py-1.5 border-b border-border bg-card text-[11px]">
  {serviceTypes.map((s) => (
    <span
      key={s.id}
      className="shrink-0 snap-start px-2 py-0.5 rounded border font-medium"
      style={{ backgroundColor: s.color, borderColor: s.color, color: getContrastingTextColor(s.color) }}
    >
      {s.name}
    </span>
  ))}
</div>
```
- `shrink-0` on each badge stops flex from compressing them — required for the container to actually overflow (and thus scroll) instead of squeezing everything into the visible width.
- `snap-x snap-proximity` (not `snap-mandatory`) gives a gentle "settle on a badge" feel during a swipe without the jankiness `snap-mandatory` can produce when the last item doesn't fully fit the viewport.
- `overscroll-x-contain` stops the swipe gesture from chaining into the page's own scroll once the legend hits its edge.
- New `.no-scrollbar` utility added to `app/globals.css` (same file that already hosts the one other bespoke class, `.appointment-block`) to hide the scrollbar visually while touch/trackpad/wheel scrolling keeps working:
  ```css
  .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  ```
- **Same container at every breakpoint** — no mobile-scroll/desktop-wrap split. When all badges fit (typically desktop), there's no overflow and it renders identically to a plain row; when they don't fit (typically mobile, per the user's explicit concern), it scrolls. One code path, graceful degradation, no conditional layout logic to maintain.

**Appointment blocks** (month/week/day — all three currently live in `CalendarView.tsx`, no separate per-view files): each block's `STATUS_COLORS[a.paymentStatus]` class is replaced with a `style={{ backgroundColor, color }}` pair from the same `serviceTypeColor` lookup + contrast helper, keeping `.appointment-block` for shape/typography. Applies identically to all three views since they share the same rendering pattern today.

### Scope

- **Files changed:** `prisma/schema.prisma` (+migration), `actions/serviceTypes.ts` (Zod schema), `components/settings/ServiceTypeForm.tsx`, `components/settings/ServiceTypeList.tsx`, `app/(dashboard)/calendar/page.tsx`, `app/(dashboard)/calendar/CalendarClient.tsx`, `components/calendar/CalendarView.tsx`, `app/globals.css`, new `lib/colors.ts`.
- **Out of scope (per functional spec, confirmed):** removing payment status from the data model or from `AppointmentModal`'s own form; multi-service appointments; click-to-filter legend interactivity; blocking (vs. warning) on duplicate colors.
- No new npm dependencies.

## Testing

No automated test framework exists in this repo (established in prior features) — verification is manual end-to-end via the dev server plus a throwaway Playwright script against disposable test data, covering: saving a color from the picker, the duplicate-color warning appearing/not blocking save, the legend rendering one badge per service with correct color and horizontal scroll on a narrow viewport, appointment blocks colored correctly in all three calendar views, the `#CCCCCC` fallback for a service with no explicit color, and text contrast on both light and dark background colors.

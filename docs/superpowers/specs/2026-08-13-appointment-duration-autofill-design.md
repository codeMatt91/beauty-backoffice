# Appointment Duration Auto-fill — Design Spec

**Date:** 2026-08-13
**Status:** Approved

## Problem

In the appointment popup (`components/calendar/AppointmentModal.tsx`, used in `/calendar`), selecting a **prestazione** already auto-fills the **Prezzo** field from `ServiceType.defaultPrice`. Since `ServiceType.durationMinutes` was added (see `2026-07-26-service-types-settings-design.md` follow-up: "Configurazione Durata Prestazioni"), the same mechanism should compute the appointment's **Fine** (end time) as `Inizio + duration_minutes`, and keep it in sync when the user changes Inizio or Prestazione.

Today, Prestazione selection has no effect on Fine; the user always sets it manually.

## Solution

**Single pure helper, two call sites — always-synced (no "manual override" state tracked).**

```typescript
function calculateEndTime(startTimeLocal: string, durationMinutes: number): string {
  return format(addMinutes(new Date(startTimeLocal), durationMinutes), "yyyy-MM-dd'T'HH:mm");
}
```

- `addMinutes` (date-fns, already a dependency) operates on `Date` objects, so day/midnight rollover (e.g. 23:50 + 30 min → 00:20 next day) is handled natively — no custom arithmetic.
- Input/output are both in the `"yyyy-MM-dd'T'HH:mm"` string shape the `datetime-local` inputs already use, matching the existing `format(...)` calls in the component.

### Trigger 1 — Prestazione selection/change

Extend the existing `handleServiceTypeChange(name)`:
```typescript
function handleServiceTypeChange(name: string) {
  setServiceType(name);
  const found = serviceTypes.find((s) => s.name === name);
  if (found) setPrice(found.defaultPrice);
  if (found?.durationMinutes != null && startTime) {
    setEndTime(calculateEndTime(startTime, found.durationMinutes));
  }
}
```
- No `startTime` yet → nothing computed (matches spec §4.1.3; will be picked up once Inizio is set, since duration is already known once the user later edits Inizio).
- `durationMinutes` is `null` (prestazione without configured duration) → Fine untouched, no warning shown (confirmed: silent, identical to today's behavior).

### Trigger 2 — Inizio change

The project's Inizio field is a plain native `<input type="datetime-local">`, not a custom datepicker component. Native `datetime-local` inputs only fire `onChange` when the value is complete and valid (full date+time picked from the browser widget, or all segments typed) — never on individual keystrokes/segment-by-segment. This already satisfies the spec's "on datepicker close/confirm, not on every intermediate change" requirement with no extra `onBlur` wiring needed.

Replace the inline `onChange={(e) => setStartTime(e.target.value)}` with:
```typescript
function handleStartTimeChange(value: string) {
  setStartTime(value);
  const found = serviceTypes.find((s) => s.name === serviceType);
  if (found?.durationMinutes != null) {
    setEndTime(calculateEndTime(value, found.durationMinutes));
  }
}
```
Applies identically whether creating a new appointment or editing an existing one, since it only depends on component state at the time of the change (not on whether `appointment` is set).

### Always-synced behavior (confirmed: Option A)

No "manually edited" flag is tracked. Every Prestazione change or Inizio change recomputes Fine from scratch whenever duration is known, overwriting whatever was there before — including a value the user just typed by hand. This matches the approved choice: simpler, no extra state, predictable ("Fine is always a pure function of Inizio + duration when duration is known").

### Edit-mode initial load does NOT recompute

The existing reset `useEffect` (populates all fields from the `appointment` prop when the modal opens, see `2026-07-11-appointment-modal-state-sync-design.md`) stays untouched — it calls `setServiceType`/`setStartTime`/`setEndTime` directly, not through the two handlers above. This is deliberate: the spec's trigger is an *explicit* user change to Inizio or Prestazione, not the modal simply loading saved data. Routing the initial load through `calculateEndTime` would silently overwrite a legitimately different, already-saved Fine the moment an existing appointment is opened, before the user touched anything.

### Data already available

`getServiceTypes()` (used by both `/settings` and this modal) already returns `durationMinutes` since the prior feature — no server/action changes needed. Only the component's local `serviceTypes` state type needs the field added:
```typescript
const [serviceTypes, setServiceTypes] = useState<
  { id: string; name: string; defaultPrice: string; durationMinutes: number | null }[]
>([]);
```

## Scope

- **1 file changed:** `components/calendar/AppointmentModal.tsx`
- No database, Server Action, auth, or routing changes
- No new dependencies (`addMinutes` ships with the existing `date-fns` package)
- Price auto-fill logic is untouched, just sharing the same `handleServiceTypeChange` call site

## Edge cases covered

| Case | Behavior |
|---|---|
| Prestazione has duration, Inizio already set | Fine recalculated immediately on selection |
| Prestazione has duration, Inizio not yet set | No computation; happens once Inizio is set (Trigger 2) |
| Prestazione has no `durationMinutes` (legacy/unconfigured) | Fine untouched, no warning (silent, same as today) |
| User changes Prestazione again | Fine recalculated with the new duration, overwriting the previous value |
| User hand-edits Fine, then changes Inizio/Prestazione again | Overwritten (Option A — always synced) |
| Inizio crosses midnight (e.g. 23:50 + 30 min) | Handled by `addMinutes`, Fine rolls to the next day |
| Opening an existing appointment for edit | Fine is loaded as-saved, not recomputed, until the user explicitly changes Inizio or Prestazione |
| Creating a new appointment (no prestazione selected yet) | Unchanged: default Inizio/Fine (09:00–10:00) from the existing reset effect |

## Testing

No automated test infrastructure exists in this repo (confirmed during the prior `durationMinutes` field work). Verification will be manual/end-to-end in `/calendar`:
- select a prestazione with duration + Inizio already set → Fine updates
- change prestazione → Fine recalculates with new duration
- change Inizio via the datetime picker with a prestazione already selected → Fine recalculates
- select a prestazione without configured duration → Fine untouched, no console errors
- an Inizio that crosses midnight → Fine correctly rolls to the next day
- open an existing appointment → Fine shows the saved value unchanged until Inizio/Prestazione is touched
- price auto-fill still works unaffected

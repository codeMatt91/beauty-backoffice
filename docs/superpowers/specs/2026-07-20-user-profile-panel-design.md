# User Profile Panel — Design Spec
Date: 2026-07-20

## Goal
Replace the static user info in the top-right header with a clickable profile button that opens a floating panel showing the user's photo, personal details, and a photo upload capability. The header user section must be consistent across all dashboard pages.

## Decisions
- **Photo storage:** base64 string in `users.image` DB column (≤ 10 MB, validated server-side)
- **Name fields:** split `name` into `firstName` + `lastName` in DB schema; UserModal updated accordingly
- **Data loading:** lazy via Server Action `getMyProfile()` on first panel open (Approach A3)
- **Session:** `firstName` and `lastName` in JWT; `image` and `createdAt` loaded lazily — not in JWT
- **Logout:** remains in Sidebar only; mobile logout button kept in SharedHeader left side

---

## Section 1 — Database Schema

**File:** `prisma/schema.prisma`

Changes to `model User`:
- Remove `name String`
- Add `firstName String` and `lastName String`
- Add `image String?`

**Migration:** split existing `name` on first space → `firstName` (part before space), `lastName` (part after space; empty string if no space found).

**Impact:** `UserModal` and `actions/users.ts` (`createUser`, `updateUser`) updated to use `firstName`/`lastName` instead of `name`.

---

## Section 2 — Auth & Session

**`lib/auth.ts`** — `authorize()` returns `{ id, firstName, lastName, email, role }`.

**`auth.config.ts`** — JWT callback adds `firstName`, `lastName`; session callback re-exposes them on `session.user`.

**`types/index.ts`** — `SessionUser`:
```ts
interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}
```

`image` and `createdAt` are NOT in the JWT. They are fetched lazily via Server Action.

---

## Section 3 — DashboardLayout & SharedHeader

**`app/(dashboard)/layout.tsx`** (Server Component):
- Reads `session.user` for `{ firstName, lastName, email, role }`
- Renders `<SharedHeader firstName lastName email role />` inside the flex column, above `<main>`
- No extra DB query at layout level

**`components/layout/SharedHeader.tsx`** (new Client Component, replaces `Header.tsx`):
- `usePathname()` to derive page title via static lookup:
  ```ts
  const PAGE_TITLES: Record<string, string> = {
    '/calendar': 'Calendario',
    '/customers': 'Clienti',
    '/finance': 'Dashboard Finanziaria',
    '/employees': 'Gestione Dipendenti',
    '/settings': 'Impostazioni',
  }
  ```
- Left: mobile-only logout button + page title
- Right: Bell icon + `<UserProfileButton>`
- Props: `{ firstName, lastName, email, role }`

**All 5 dashboard pages** remove `import Header` and `<Header .../>`. Page JSX starts directly from page body content.

---

## Section 4 — UserProfileButton & UserProfilePanel

**`components/layout/UserProfileButton.tsx`** (Client Component):
- Circle avatar: initial of `firstName` on `bg-primary/20` background
- Next to circle: `firstName + " " + lastName`, hidden on `< md` with `hidden md:block`
- Click → sets `open=true` on `UserProfilePanel`

**`components/layout/UserProfilePanel.tsx`** (Client Component):
- **Positioning:** `fixed top-14 z-50`
  - Mobile (`default`): `right-2 w-[calc(100vw-1rem)]`
  - Desktop (`sm:`): `right-4 w-80`
- `max-h-[calc(100vh-4rem)] overflow-y-auto` for short screens
- Transparent full-screen overlay behind the panel (closes on tap/click)
- **On first open:** calls `getMyProfile()` → shows skeleton while loading
- **Layout (top to bottom):**
  1. Profile photo circle `w-20 h-20`, centered — shows `image` if present, else initial on `bg-primary/20`
  2. Upload button: small icon button (`absolute bottom-0 right-0` relative to photo wrapper), opens `<input type="file" accept="image/jpeg,image/png,image/svg+xml">`. Client-side size check ≤ 10 MB before calling Server Action.
  3. Info rows: Nome, Cognome, Email, Tipo account (`ADMIN` → "Amministratore", `EMPLOYEE` → "Dipendente"), Membro dal (formatted `it-IT` date)
- **After successful upload:** update panel's local `image` state — no page refresh needed

---

## Section 5 — Server Actions

**`actions/profile.ts`** (new file):

### `getMyProfile()`
- Calls `requireAuth()`
- Returns `{ image: string | null, createdAt: Date }` from `prisma.user.findUnique`

### `updateProfileImage(dataUrl: string)`
- Calls `requireAuth()`
- Validates `dataUrl` matches `data:image/(jpeg|png|svg\+xml);base64,` prefix
- Validates decoded size ≤ 10 MB (base64 string length ≤ 13_981_013 chars)
- Calls `prisma.user.update({ where: { id }, data: { image: dataUrl } })`
- Returns `{ success: true }` or throws on error
- Does NOT call `revalidatePath` (UI updated via local state)

---

## Files Changed

| File | Action |
|---|---|
| `prisma/schema.prisma` | Update User model |
| `prisma/migrations/` | New migration: split name, add image |
| `lib/auth.ts` | Update authorize() return |
| `auth.config.ts` | Update JWT/session callbacks |
| `types/index.ts` | Update SessionUser |
| `app/(dashboard)/layout.tsx` | Render SharedHeader, pass user props |
| `components/layout/Header.tsx` | Delete (replaced) |
| `components/layout/SharedHeader.tsx` | New |
| `components/layout/UserProfileButton.tsx` | New |
| `components/layout/UserProfilePanel.tsx` | New |
| `actions/profile.ts` | New |
| `actions/users.ts` | Update createUser/updateUser for firstName/lastName |
| `components/employees/UserModal.tsx` | Split name field into two fields |
| `app/(dashboard)/calendar/page.tsx` | Remove Header |
| `app/(dashboard)/customers/page.tsx` | Remove Header |
| `app/(dashboard)/finance/page.tsx` | Remove Header |
| `app/(dashboard)/employees/page.tsx` | Remove Header |
| `app/(dashboard)/settings/page.tsx` | Remove Header |

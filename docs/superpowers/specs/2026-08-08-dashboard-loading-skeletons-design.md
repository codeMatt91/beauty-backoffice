# Dashboard Loading Skeletons — Design Spec

**Date:** 2026-08-08
**Status:** Approved

## Problem

Cliccando su Calendario, Clienti, Dipendenti o Finanza nella Sidebar/MobileNav, l'apertura della pagina è percepita come lenta. Analizzando il codice, ci sono due cause distinte:

1. **`/calendar`** è un Server Component che fa `await Promise.all([...])` su Prisma prima di renderizzare qualunque markup. Non esiste un `app/(dashboard)/calendar/loading.tsx`, quindi Next.js non mostra nulla — la navigazione stessa sembra congelata finché la query non risponde.
2. **`/customers`, `/employees`, `/finance`, `/settings`** sono Client Component (`"use client"`) che montano subito uno shell vuoto e poi fanno fetch dentro `useEffect` chiamando una Server Action. Lo stato iniziale è `[]`/`{ appointments: [], expenses: [] }`, quindi la UI mostra per un istante "0 clienti registrati" / tabelle vuote, poi "scatta" quando il fetch risolve — nessun placeholder, nessuna preallocazione di spazio.

`app/(dashboard)/layout.tsx` (Sidebar, MobileNav, SharedHeader) è condiviso da tutte le route e in navigazione client-side **non** viene ri-esguito — solo il segmento foglia (`page.tsx` della route di destinazione) cambia. Questo è il punto di leva: possiamo far apparire uno skeleton istantaneo nel solo `{children}` slot senza toccare il resto del layout.

## Goal

Ogni pagina della dashboard deve aprirsi istantaneamente con uno skeleton che preallochi lo spazio del contenuto finale (niente layout shift), mentre i dati vengono recuperati lato server; il contenuto reale sostituisce lo skeleton non appena pronto — senza round-trip client → Server Action per il caricamento iniziale.

## Solution

### Meccanismo: `loading.tsx` a livello di route

Next.js App Router crea automaticamente un confine `<Suspense>` attorno a ogni `page.tsx` quando esiste un `loading.tsx` fratello nella stessa cartella. Convertendo ogni `page.tsx` in un Server Component `async` (come già fa `/calendar` oggi, solo senza skeleton), il relativo `loading.tsx` viene mostrato immediatamente alla navigazione e sostituito quando il fetch è completo — senza alcun codice di gestione stato aggiuntivo.

### Pattern Server/Client (uguale per tutte le pagine tranne `/calendar`, già così)

- `page.tsx` (Server Component, async): richiama direttamente la Server Action già esistente (`getCustomers`, `getAllUsers`, `getServiceTypes`, `getFinancialSummary` + `getExpenses`), poi passa i dati come prop iniziali a un nuovo `*Client.tsx`.
- `*Client.tsx` (`"use client"`): stesso contenuto/logica oggi presente in `page.tsx`, ma `useState` inizializzato dalle prop invece che da `[]`, e **senza** il primo `useEffect(() => { load() }, [])` (il caricamento iniziale non serve più — i dati arrivano già pronti dal server). Le funzioni `load()`/refetch dopo una mutazione (create/edit/delete) restano identiche a oggi.
- Le Server Action richiamate da un Server Component durante il render sono chiamate di funzione dirette lato server (nessun round-trip di rete); `requireAuth()`/`requireAdmin()` dentro ciascuna action restano l'unico punto di controllo auth, coerente con oggi.

### Skeleton primitivo condiviso

Nuovo file `components/ui/Skeleton.tsx`:

```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-secondary", className)} />;
}
```

Una singola barra pulsante riusabile; ogni pagina la compone in blocchi che ricalcano le dimensioni reali del contenuto (altezza riga tabella, larghezza card KPI, ecc.), non un semplice spinner centrato — questo è il punto richiesto: "preallocare spazio".

### Piano per pagina

| Pagina | `loading.tsx` | Contenuto skeleton | `*Client.tsx` nuovo |
|---|---|---|---|
| `/calendar` | nuovo | header (toolbar navigazione mese + toggle vista) + griglia settimanale/mensile placeholder | no — `CalendarClient.tsx` esiste già, nessuna modifica alla logica dati |
| `/customers` | nuovo | barra ricerca + header "N clienti registrati" (senza numero) + 6 righe tabella desktop (`hidden md:block`) + 6 card mobile (`md:hidden`) | `CustomersClient.tsx` |
| `/employees` | nuovo | header + 5 righe tabella desktop + card mobile, stesso doppio layout di `UserTable` | `EmployeesClient.tsx` |
| `/finance` | nuovo | barra filtri (placeholder, i filtri non dipendono dai dati) + 3 card KPI + blocco grafico + tabella spese (5 righe) | `FinanceClient.tsx` |
| `/settings` | nuovo | blocco "Tipologie di Prestazioni" con 4 righe placeholder; il blocco "Pulizia e Archiviazione Dati" è statico e non serve skeleton (non dipende da `getServiceTypes`) | `SettingsClient.tsx` |

### Caso particolare: `/finance`

`getFinancialSummary`/`getExpenses` richiedono un intervallo di date. Il Server Component userà lo stesso default già usato oggi come stato iniziale del client (`startOfMonth(now)` → `endOfMonth(now)`), passando `initialData`, `initialExpenses`, `initialServiceTypes` come prop. Il comportamento dopo il primo render — cambio filtri con `startTransition` e stato locale `loading` sul grafico — **non cambia**: resta identico a `finance/page.tsx` di oggi, solo spostato in `FinanceClient.tsx`.

`/finance` è ADMIN-only (verificato da `middleware.ts`); nessun controllo aggiuntivo necessario nel nuovo `page.tsx`, coerente con `/calendar` che non duplica controlli già fatti a monte.

### Caso particolare: `/settings`

Solo la sezione "Tipologie di Prestazioni" dipende da `getServiceTypes()`. La sezione "Pulizia e Archiviazione Dati" (stato `months`/`loading`/`result`, upload via `fetch("/api/purge")`) non ha bisogno di dati iniziali e resta invariata in `SettingsClient.tsx`.

## Out of scope (YAGNI)

- **Suspense annidato/streaming parziale** all'interno di una singola pagina (es. barra filtri di `/finance` visibile istantaneamente mentre solo KPI/grafico restano in skeleton): il `loading.tsx` a livello di route copre già il problema segnalato (pagina che si apre subito con placeholder invece di restare bloccata); uno split più granulare è un possibile affinamento futuro, non necessario ora.
- **Cache/`revalidate` tuning** delle query: fuori scope, questo lavoro riguarda solo il *primo caricamento* percepito, non l'ottimizzazione delle query stesse.
- **Skeleton per le mutazioni** (submit form, delete): restano gestite come oggi (stati `loading` locali sui bottoni), non riguardano l'apertura pagina.
- **PPR (Partial Prerendering)**: non abilitato nel progetto, non necessario per questo obiettivo.

## Scope

- **File nuovi:** `components/ui/Skeleton.tsx`, 5× `loading.tsx` (`calendar/`, `customers/`, `employees/`, `finance/`, `settings/`), 4× `*Client.tsx` (`CustomersClient.tsx`, `EmployeesClient.tsx`, `FinanceClient.tsx`, `SettingsClient.tsx`).
- **File modificati:** i 4 `page.tsx` di `customers/employees/finance/settings` (diventano Server Component async che fanno data-fetch iniziale e delegano al `*Client.tsx`); `calendar/page.tsx` invariato (aggiunge solo il fratello `loading.tsx`).
- Nessuna modifica a Server Action, schema Prisma, auth o `middleware.ts` — le action esistenti vengono solo richiamate da un contesto diverso (Server Component invece di client-side `useEffect`).
- Nessuna nuova dipendenza npm.

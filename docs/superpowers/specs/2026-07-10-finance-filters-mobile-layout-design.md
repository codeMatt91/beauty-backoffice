# Design: Finance Filters — Mobile Layout & Active State

**Date:** 2026-07-10  
**File target:** `app/(dashboard)/finance/page.tsx`

## Obiettivo

Migliorare il layout dei filtri nella pagina `/finance` su mobile organizzandoli con un layout a stack verticale con sezioni logiche distinte, e aggiungere uno stato active persistente sui pulsanti preset.

## Problema attuale

Il container dei filtri usa `flex flex-wrap gap-3` (riga 305), che su mobile produce un layout disorganizzato: i controlli vanno a capo in modo imprevedibile, senza una gerarchia visiva chiara.

## Soluzione scelta: Approccio B — sezioni logiche separate

### Layout mobile (default)

Il container `flex flex-wrap gap-3` viene sostituito con `space-y-3`. Ogni gruppo di controlli occupa la propria riga:

| Ordine | Contenuto | Layout |
|---|---|---|
| 1 | Date range (Dal → Al) | `flex items-center gap-2` (invariato) |
| 2 | Filtro servizio (`<select>`) | `w-full` |
| 3 | Toggle granularità (Giornaliero / Mensile) | `flex w-full` con pulsanti `flex-1` |
| 4 | Preset date (Questo mese / Quest'anno) | `grid grid-cols-2 gap-2` |
| 5 | *(separatore)* | `border-t border-border pt-1` |
| 6 | Export (Esporta mese / Esporta anno) | `grid grid-cols-2 gap-2` |

### Layout desktop (`lg:`)

Su `lg:` il layout torna a `flex flex-wrap gap-3` — nessuna modifica al comportamento desktop.

## Stato active persistente sui preset

### Stato

```ts
const [activePreset, setActivePreset] = useState<"month" | "year" | null>(null);
```

### Logica

- Click "Questo mese" → `setActivePreset("month")` + imposta dateFrom/dateTo al mese corrente
- Click "Quest'anno" → `setActivePreset("year")` + imposta dateFrom/dateTo all'anno corrente  
- Modifica manuale di `dateFrom` o `dateTo` (handler `onChange`) → `setActivePreset(null)`

### Stile pulsanti preset

Stesso pattern già usato dal toggle granularità:

```ts
// attivo
"bg-primary text-white border-primary"

// inattivo
"border-border hover:bg-secondary"
```

I pulsanti export **non** ricevono stato active — sono azioni one-shot, non toggle.

## Scope

- **In scope:** `app/(dashboard)/finance/page.tsx` — solo la filter bar (righe 299–410)
- **Out of scope:** componenti chart, tabella spese, modal, desktop layout, altri file

## Vincoli tecnici

- Tailwind only — nessun inline style
- Il toggle granularità esistente (righe 332–345) mantiene la sua logica e i suoi stili invariati
- `activePreset` è uno stato locale della pagina, non persiste tra sessioni

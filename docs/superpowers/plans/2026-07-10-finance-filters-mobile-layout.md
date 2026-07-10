# Finance Filters Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riorganizzare la filter bar della pagina `/finance` con un layout mobile-first a sezioni logiche verticali e aggiungere stato active persistente sui pulsanti preset.

**Architecture:** Modifica esclusiva di `app/(dashboard)/finance/page.tsx`. Task 1 aggiunge lo stato `activePreset` e aggiorna logica + stile dei preset button. Task 2 ristruttura il container dei filtri con classi responsive Tailwind.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS, TypeScript

## Global Constraints

- Tailwind utility classes only — nessun `style` prop, nessun CSS module
- Nessuna dipendenza npm aggiuntiva
- Il toggle granularità (Giornaliero / Mensile) mantiene la sua logica e stili invariati — non toccare quella sezione a parte l'aggiunta di classi responsive width
- `activePreset` è stato locale alla pagina, non persiste tra sessioni
- Desktop layout (`lg:`) deve restare visivamente identico all'attuale

---

### Task 1: Stato active preset — logica e stile

**File:**
- Modify: `app/(dashboard)/finance/page.tsx`

**Interfaces:**
- Produce: stato `activePreset: "month" | "year" | null`, usato nel Task 2 solo per riferimento (già nel file)

- [ ] **Step 1: Aggiungi lo stato `activePreset`**

In `FinancePage`, dopo la riga con `useState` per `exportError` (attualmente riga 210), aggiungi:

```tsx
const [activePreset, setActivePreset] = useState<"month" | "year" | null>(null);
```

- [ ] **Step 2: Aggiungi il tipo esplicito e il campo `id` all'array `presets`**

Sostituisci il blocco `presets` (attualmente righe 273–290) con:

```tsx
const presets: { label: string; id: "month" | "year"; fn: () => void }[] = [
  {
    label: "Questo mese",
    id: "month",
    fn: () => {
      setDateFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"));
      setDateTo(format(endOfMonth(new Date()), "yyyy-MM-dd"));
      setGranularity("day");
      setActivePreset("month");
    },
  },
  {
    label: "Quest'anno",
    id: "year",
    fn: () => {
      setDateFrom(format(startOfYear(new Date()), "yyyy-MM-dd"));
      setDateTo(format(endOfYear(new Date()), "yyyy-MM-dd"));
      setGranularity("month");
      setActivePreset("year");
    },
  },
];
```

- [ ] **Step 3: Resetta `activePreset` quando l'utente modifica le date manualmente**

Nel JSX, aggiorna i due `onChange` degli input date (attualmente righe 309 e 316):

```tsx
// input dateFrom
onChange={(e) => { setDateFrom(e.target.value); setActivePreset(null); }}

// input dateTo
onChange={(e) => { setDateTo(e.target.value); setActivePreset(null); }}
```

- [ ] **Step 4: Avvolgi i preset button in un wrapper grid e applica stile condizionale**

Sostituisci il blocco `.map()` dei preset (attualmente righe 347–356):

```tsx
// PRIMA
{presets.map((p) => (
  <button
    key={p.label}
    onClick={p.fn}
    className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
  >
    {p.label}
  </button>
))}

// DOPO
<div className="grid grid-cols-2 gap-2 lg:flex lg:gap-3">
  {presets.map((p) => (
    <button
      key={p.label}
      onClick={p.fn}
      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
        activePreset === p.id
          ? "bg-primary text-white border-primary"
          : "border-border hover:bg-secondary"
      }`}
    >
      {p.label}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Verifica visiva in browser**

```bash
npm run dev
```

Aprire `http://localhost:3000/finance` in DevTools con viewport mobile (es. iPhone 12, 390px).

Verificare:
- Cliccare "Questo mese" → il pulsante diventa `bg-primary` (rosa/colore primario), testo bianco
- Cliccare "Quest'anno" → si evidenzia "Quest'anno", "Questo mese" torna inattivo
- Modificare manualmente una delle date → entrambi i preset tornano senza evidenziazione
- Su viewport desktop (`lg:`) i pulsanti preset rimangono affiancati in flex row come prima

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/finance/page.tsx
git commit -m "feat: add persistent active state to finance preset filter buttons"
```

---

### Task 2: Ristruttura layout filter bar per mobile

**File:**
- Modify: `app/(dashboard)/finance/page.tsx`

**Interfaces:**
- Consumes: wrapper `<div className="grid grid-cols-2 gap-2 lg:flex lg:gap-3">` attorno ai preset introdotto nel Task 1

- [ ] **Step 1: Cambia il container principale dei filtri**

Sostituisci il `<div>` interno alla filter card (attualmente riga 305):

```tsx
// PRIMA
<div className="flex flex-wrap gap-3">

// DOPO
<div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
```

- [ ] **Step 2: Rendi il select servizi full-width su mobile**

Aggiorna la className del `<select>` (attualmente riga 325):

```tsx
// PRIMA
className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"

// DOPO
className="w-full lg:w-auto px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
```

- [ ] **Step 3: Rendi il toggle granularità full-width su mobile, con pulsanti che si espandono**

Aggiorna il div wrapper e i due button del toggle granularità (attualmente righe 332–345):

```tsx
// PRIMA
<div className="flex items-center rounded-lg border border-border overflow-hidden">
  <button
    onClick={() => setGranularity("day")}
    className={`px-3 py-1.5 text-sm font-medium transition-colors ${granularity === "day" ? "bg-primary text-white" : "hover:bg-secondary"}`}
  >
    Giornaliero
  </button>
  <button
    onClick={() => setGranularity("month")}
    className={`px-3 py-1.5 text-sm font-medium transition-colors ${granularity === "month" ? "bg-primary text-white" : "hover:bg-secondary"}`}
  >
    Mensile
  </button>
</div>

// DOPO
<div className="flex items-center rounded-lg border border-border overflow-hidden w-full lg:w-auto">
  <button
    onClick={() => setGranularity("day")}
    className={`flex-1 lg:flex-none px-3 py-1.5 text-sm font-medium transition-colors ${granularity === "day" ? "bg-primary text-white" : "hover:bg-secondary"}`}
  >
    Giornaliero
  </button>
  <button
    onClick={() => setGranularity("month")}
    className={`flex-1 lg:flex-none px-3 py-1.5 text-sm font-medium transition-colors ${granularity === "month" ? "bg-primary text-white" : "hover:bg-secondary"}`}
  >
    Mensile
  </button>
</div>
```

- [ ] **Step 4: Avvolgi i due pulsanti export in un wrapper con separatore mobile**

I due button export (attualmente righe 357–395 — "Esporta mese" e "Esporta anno") vengono racchiusi in:

```tsx
<div className="grid grid-cols-2 gap-2 border-t border-border pt-1 lg:border-t-0 lg:pt-0 lg:flex lg:gap-3">
  {/* pulsante Esporta mese — invariato */}
  {/* pulsante Esporta anno — invariato */}
</div>
```

Il `border-t` e `pt-1` creano la separazione visiva su mobile; `lg:border-t-0 lg:pt-0` la rimuovono su desktop dove i pulsanti tornano inline nel flex-wrap.

- [ ] **Step 5: Verifica visiva completa in browser**

```bash
npm run dev
```

**Mobile (390px):** verificare che i filtri appaiano nell'ordine esatto:
1. `[Dal: ____  →  Al: ____ ]` — riga flex orizzontale
2. `[Filtro servizio (full width)]`
3. `[Giornaliero        |        Mensile]` — toggle full-width, pulsanti al 50% ciascuno
4. `[Questo mese] [Quest'anno]` — griglia 2 colonne
5. Linea separatrice sottile
6. `[Esporta mese] [Esporta anno]` — griglia 2 colonne

**Desktop (1280px):** verificare che tutti i controlli tornino in un'unica riga flex-wrap orizzontale, senza separatori visibili tra filtri ed export.

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/finance/page.tsx
git commit -m "feat: restructure finance filter bar with mobile-first grid layout"
```

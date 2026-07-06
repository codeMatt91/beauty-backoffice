# Finance PDF Export — Design Spec

**Date:** 2026-07-06  
**Status:** Approved  
**Scope:** `/finance` page — aggiunta di due bottoni di export PDF fissi (mese corrente / anno corrente)

---

## Problema

La pagina `/finance` non offre alcun modo per esportare i dati finanziari. L'utente vuole poter scaricare un report PDF del mese corrente e uno dell'anno corrente, indipendentemente dai filtri attivi nella dashboard.

---

## Soluzione

Due bottoni fissi nella filter bar della pagina `/finance`:

- **"Esporta mese"** → genera e scarica un PDF con i dati del mese corrente (`startOfMonth(now)` → `endOfMonth(now)`)
- **"Esporta anno"** → genera e scarica un PDF con i dati dell'anno corrente (`startOfYear(now)` → `endOfYear(now)`)

I bottoni sono indipendenti dai filtri di data/servizio attivi nella dashboard.

---

## Architettura

### Nuovo file: `lib/exportFinancePDF.ts`

Funzione esportata:

```ts
export async function exportFinancePDF(period: "month" | "year"): Promise<void>
```

Responsabilità:
1. Calcola il range di date basandosi su `period` e `new Date()`
2. Chiama in parallelo `getFinancialSummary(from, to)` e `getExpenses(from, to)`
3. Calcola i KPI (entrate totali, uscite totali, profitto netto)
4. Costruisce il documento PDF con `jsPDF` + `jspdf-autotable`
5. Triggera il download con `doc.save(filename)`

### Modifiche a `app/(dashboard)/finance/page.tsx`

- Import di `exportFinancePDF` da `@/lib/exportFinancePDF`
- Import di `Download` da `lucide-react`
- Aggiunta di uno stato `exportingMonth: boolean` e `exportingYear: boolean` per lo spinner
- Due bottoni nella filter bar, accanto ai preset esistenti

---

## Struttura del PDF

**Filename:** `report-mese-YYYY-MM.pdf` / `report-anno-YYYY.pdf`

**Sezioni:**
1. **Header** — titolo "Report Finanziario", periodo in italiano (es. "Luglio 2026" / "Anno 2026"), data di generazione
2. **Riepilogo KPI** — tabella a 3 colonne: Entrate totali | Uscite totali | Profitto netto
3. **Appuntamenti** — tabella con colonne: Data | Servizio | Prezzo (solo appuntamenti `PAID`, ordinati per data)
4. **Spese** — tabella con colonne: Data | Descrizione | Categoria | Importo (ordinati per data desc)

---

## Dipendenze

```bash
npm install jspdf jspdf-autotable
```

- `jspdf` (~300 KB gzipped): generazione PDF client-side
- `jspdf-autotable`: plugin per tabelle formattate dentro `jsPDF`

Entrambe le librerie sono tree-shakable e importate solo in `lib/exportFinancePDF.ts`.

---

## UI — Bottoni

Stile: identico ai bottoni preset esistenti (`border border-border text-sm hover:bg-secondary`), con icona `Download` da Lucide a sinistra. Durante il fetch/generazione mostra uno spinner (stato `exporting`).

Posizionamento: nella filter bar, dopo i preset "Questo mese" e "Quest'anno".

```
[ Questo mese ]  [ Quest'anno ]  [ ↓ Esporta mese ]  [ ↓ Esporta anno ]
```

---

## Data flow

```
click bottone
  → set exportingMonth/Year = true
  → getFinancialSummary(from, to)  ← Server Action esistente
  → getExpenses(from, to)          ← Server Action esistente
  → calcola KPI
  → costruisce PDF (jsPDF + autotable)
  → doc.save(filename)
  → set exportingMonth/Year = false
```

Nessuna nuova Server Action richiesta. Nessuna nuova API route.

---

## Vincoli rispettati

- Logica di fetch gira come Server Action (`requireAdmin()` già presente in `getFinancialSummary` e `getExpenses`)
- Nessun dato sensibile esposto client-side oltre a quello già visualizzato nella dashboard
- Nessuna dipendenza CSS/component library aggiuntiva
- Il componente `FinancePage` rimane sotto ~150 righe di logica propria (la logica PDF è estratta in `lib/`)

---

## Fuori scope

- Export del grafico (chart image nel PDF)
- Filtro per servizio applicato all'export (l'export usa sempre tutti i servizi)
- Export di periodi custom (solo mese corrente e anno corrente)

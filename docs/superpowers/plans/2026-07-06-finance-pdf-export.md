# Finance PDF Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere due bottoni fissi ("Esporta mese" / "Esporta anno") nella filter bar di `/finance` che generano e scaricano un PDF client-side con riepilogo KPI, tabella appuntamenti e tabella spese.

**Architecture:** La logica di generazione PDF è estratta in `lib/exportFinancePDF.ts` per mantenere il componente pagina pulito. Al click il bottone fetcha i dati freschi per il periodo fisso (mese/anno corrente) tramite le Server Actions esistenti `getFinancialSummary` e `getExpenses`, costruisce il PDF con `jsPDF` + `jspdf-autotable`, e lo scarica direttamente nel browser.

**Tech Stack:** jsPDF 2.x, jspdf-autotable 3.x, date-fns 4.x (già installato), lucide-react (già installato), Next.js 15 Server Actions.

## Global Constraints

- Nessuna nuova Server Action: riusare solo `getFinancialSummary` e `getExpenses` da `actions/expenses.ts`
- Nessuna nuova API route
- Stile Tailwind only — nessun inline `style` prop
- `"use client"` già presente nella pagina — la logica PDF rimane client-side
- TypeScript strict mode attivo — nessun `any` non giustificato
- Nessun commento che spieghi il "cosa" — solo il "perché" se non ovvio

---

## File Map

| File | Azione | Responsabilità |
|---|---|---|
| `lib/exportFinancePDF.ts` | **Crea** | Calcola range date, fetcha dati, genera e salva PDF |
| `app/(dashboard)/finance/page.tsx` | **Modifica** | Aggiunge import, stati exporting, due bottoni nella filter bar |

---

## Task 1: Installare le dipendenze jsPDF

**Files:**
- Modify: `package.json` (tramite npm install)

**Interfaces:**
- Produces: `jspdf` e `jspdf-autotable` disponibili come moduli

- [ ] **Step 1: Installare i pacchetti**

```bash
npm install jspdf jspdf-autotable
```

Expected output (ultimi due pacchetti aggiunti):
```
added 2 packages
```

- [ ] **Step 2: Verificare che i tipi siano inclusi**

```bash
ls node_modules/jspdf/dist/jspdf.d.ts && echo "OK jspdf types" && ls node_modules/jspdf-autotable/dist/types.d.ts && echo "OK autotable types"
```

Expected:
```
OK jspdf types
OK autotable types
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jspdf and jspdf-autotable dependencies"
```

---

## Task 2: Creare `lib/exportFinancePDF.ts`

**Files:**
- Create: `lib/exportFinancePDF.ts`

**Interfaces:**
- Consumes: `getFinancialSummary(from: Date, to: Date)` e `getExpenses(from: Date, to: Date)` da `@/actions/expenses`
- Produces: `exportFinancePDF(period: "month" | "year"): Promise<void>` — usata da `finance/page.tsx` nel Task 3

- [ ] **Step 1: Verificare che TypeScript veda i tipi di jspdf-autotable (type-check prima di scrivere)**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: nessun errore (il progetto deve compilare prima di aggiungere il nuovo file).

- [ ] **Step 2: Creare il file**

Crea `lib/exportFinancePDF.ts` con il seguente contenuto:

```typescript
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { it } from "date-fns/locale";
import { getFinancialSummary, getExpenses } from "@/actions/expenses";

function formatEur(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export async function exportFinancePDF(
  period: "month" | "year"
): Promise<void> {
  const now = new Date();
  const from = period === "month" ? startOfMonth(now) : startOfYear(now);
  const to = period === "month" ? endOfMonth(now) : endOfYear(now);

  const [summary, expensesRaw] = await Promise.all([
    getFinancialSummary(from, to),
    getExpenses(from, to),
  ]);

  const expenses = expensesRaw as {
    id: string;
    date: string;
    amount: string;
    description: string;
    category: string;
  }[];

  // KPI
  const entrate = summary.appointments.reduce(
    (s, a) => s + parseFloat(a.price),
    0
  );
  const uscite = summary.expenses.reduce(
    (s, e) => s + parseFloat(e.amount),
    0
  );
  const profitto = entrate - uscite;

  const periodLabel =
    period === "month"
      ? format(now, "MMMM yyyy", { locale: it })
      : `Anno ${format(now, "yyyy")}`;

  const filename =
    period === "month"
      ? `report-mese-${format(now, "yyyy-MM")}.pdf`
      : `report-anno-${format(now, "yyyy")}.pdf`;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Report Finanziario", pageW / 2, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(
    periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
    pageW / 2,
    28,
    { align: "center" }
  );

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Generato il ${format(now, "dd/MM/yyyy")}`,
    pageW / 2,
    34,
    { align: "center" }
  );
  doc.setTextColor(0);

  let y = 44;

  // ── KPI ──────────────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Riepilogo", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Entrate totali", "Uscite totali", "Profitto netto"]],
    body: [[formatEur(entrate), formatEur(uscite), formatEur(profitto)]],
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 10 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Appointments ─────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Appuntamenti (pagati)", 14, y);
  y += 4;

  const aptRows = summary.appointments
    .slice()
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
    .map((a) => [
      format(new Date(a.startTime), "dd/MM/yyyy"),
      a.serviceType,
      formatEur(parseFloat(a.price)),
    ]);

  autoTable(doc, {
    startY: y,
    head: [["Data", "Servizio", "Prezzo"]],
    body:
      aptRows.length > 0
        ? aptRows
        : [["Nessun appuntamento nel periodo", "", ""]],
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: "right" } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Expenses ──────────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Spese", 14, y);
  y += 4;

  const expRows = expenses
    .slice()
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .map((e) => [
      format(new Date(e.date), "dd/MM/yyyy"),
      e.description,
      e.category,
      formatEur(parseFloat(e.amount)),
    ]);

  autoTable(doc, {
    startY: y,
    head: [["Data", "Descrizione", "Categoria", "Importo"]],
    body:
      expRows.length > 0
        ? expRows
        : [["Nessuna spesa nel periodo", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 9 },
    columnStyles: { 3: { halign: "right" } },
  });

  doc.save(filename);
}
```

- [ ] **Step 3: Verificare che TypeScript compili senza errori**

```bash
npx tsc --noEmit 2>&1
```

Expected: nessun output (zero errori).

- [ ] **Step 4: Verificare ESLint**

```bash
npm run lint 2>&1 | grep -E "error|warning" | head -20
```

Expected: nessun errore su `lib/exportFinancePDF.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/exportFinancePDF.ts
git commit -m "feat: add exportFinancePDF utility (jsPDF + autotable)"
```

---

## Task 3: Aggiungere i bottoni di export a `finance/page.tsx`

**Files:**
- Modify: `app/(dashboard)/finance/page.tsx`

**Interfaces:**
- Consumes: `exportFinancePDF(period: "month" | "year"): Promise<void>` da `@/lib/exportFinancePDF` (definita in Task 2)

- [ ] **Step 1: Aggiornare gli import nella sezione import del file**

Trovare la riga degli import lucide-react (riga ~11-19 del file originale):

```typescript
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Filter,
  Trash2,
  X,
} from "lucide-react";
```

Sostituirla con:

```typescript
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Filter,
  Trash2,
  X,
  Download,
} from "lucide-react";
import { exportFinancePDF } from "@/lib/exportFinancePDF";
```

- [ ] **Step 2: Aggiungere gli stati `exportingMonth` e `exportingYear`**

Trovare nel corpo di `FinancePage` (dopo gli altri useState, ~riga 206):

```typescript
const [addExpenseOpen, setAddExpenseOpen] = useState(false);
```

Sostituirla con:

```typescript
const [addExpenseOpen, setAddExpenseOpen] = useState(false);
const [exportingMonth, setExportingMonth] = useState(false);
const [exportingYear, setExportingYear] = useState(false);
```

- [ ] **Step 3: Aggiungere i due bottoni nella filter bar**

Trovare il blocco dei preset nella filter bar (dopo i preset "Questo mese" / "Quest'anno", ~riga 343-351):

```tsx
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={p.fn}
                className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
              >
                {p.label}
              </button>
            ))}
```

Sostituirlo con:

```tsx
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={p.fn}
                className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
              >
                {p.label}
              </button>
            ))}

            <button
              onClick={async () => {
                setExportingMonth(true);
                try { await exportFinancePDF("month"); }
                finally { setExportingMonth(false); }
              }}
              disabled={exportingMonth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingMonth ? "..." : "Esporta mese"}
            </button>

            <button
              onClick={async () => {
                setExportingYear(true);
                try { await exportFinancePDF("year"); }
                finally { setExportingYear(false); }
              }}
              disabled={exportingYear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingYear ? "..." : "Esporta anno"}
            </button>
```

- [ ] **Step 4: Verificare TypeScript e lint**

```bash
npx tsc --noEmit 2>&1 && npm run lint 2>&1 | grep -E "error" | head -20
```

Expected: nessun errore.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/finance/page.tsx
git commit -m "feat: add monthly and yearly PDF export buttons to finance page"
```

---

## Task 4: Verifica manuale nel browser

**Files:** nessuno

- [ ] **Step 1: Avviare il dev server**

```bash
npm run dev
```

Aprire `http://localhost:3000/finance` nel browser (con un account ADMIN).

- [ ] **Step 2: Verificare che i bottoni appaiano nella filter bar**

Controllare visivamente:
- Bottone "Esporta mese" con icona Download accanto ai preset
- Bottone "Esporta anno" con icona Download accanto a "Esporta mese"
- Entrambi disabilitati (opacity 50%) durante il click

- [ ] **Step 3: Testare "Esporta mese"**

1. Cliccare "Esporta mese"
2. Attende il fetch (il bottone mostra "...")
3. Verifica che si scarichi un file `report-mese-YYYY-MM.pdf`
4. Aprire il PDF e verificare:
   - Header con "Report Finanziario" e il mese corrente in italiano
   - Tabella KPI con Entrate / Uscite / Profitto
   - Tabella Appuntamenti (o riga "Nessun appuntamento nel periodo")
   - Tabella Spese (o riga "Nessuna spesa nel periodo")

- [ ] **Step 4: Testare "Esporta anno"**

1. Cliccare "Esporta anno"
2. Verifica che si scarichi `report-anno-YYYY.pdf`
3. Verificare nel PDF che il periodo mostri "Anno YYYY"

- [ ] **Step 5: Verificare che i filtri attivi NON influenzino il PDF**

1. Impostare il filtro data su un range diverso dal mese corrente (es. mese precedente)
2. Cliccare "Esporta mese"
3. Verificare che il PDF contenga i dati del **mese corrente**, non del range filtrato

- [ ] **Step 6: Build di produzione (smoke test finale)**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completata senza errori.

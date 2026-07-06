# Finance PDF Charts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere grafici ai PDF export di `/finance`: due torte affiancate nel PDF mensile e un grafico barre+linea netto nel PDF annuale, con tabella mensile colorata.

**Architecture:** Un nuovo file `lib/chartToImage.ts` usa Chart.js su canvas temporaneo per generare immagini PNG dei grafici; `lib/exportFinancePDF.ts` importa queste funzioni e le chiama nel ramo mensile o annuale prima delle tabelle esistenti.

**Tech Stack:** chart.js v4 (auto-registration), jsPDF 4.x, jspdf-autotable 5.x, date-fns 4.x (già installati).

## Global Constraints

- Nessuna nuova Server Action né API route — i dati vengono da `summary.appointments` e `summary.expenses` già disponibili
- TypeScript strict mode deve passare: `npx tsc --noEmit`
- Nessun inline `style` prop (JSX non coinvolto — tutto in `lib/`)
- `renderPieChart` accetta solo array non vuoti — il chiamante verifica `slices.length > 0`
- `renderBarLineChart` accetta sempre 12 elementi (tutti i mesi dell'anno, anche a zero)
- Palette colori torte: `['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']`
- Colori barre: entrate `#10b981`, uscite `#ef4444`, linea netto `#111827`
- Colori Netto positivo: `fillColor [209,250,229]`, `textColor [6,95,70]`
- Colori Netto negativo: `fillColor [254,226,226]`, `textColor [153,27,27]`
- Dimensioni canvas: pie 400×400, bar 800×320
- Dimensioni PDF (mm): pie 80×80 ciascuna (sinistra x=14, destra x=108), bar 182×70

---

## File Map

| File | Azione | Responsabilità |
|---|---|---|
| `lib/chartToImage.ts` | **Crea** | Rendering Chart.js su canvas → PNG data URL |
| `lib/exportFinancePDF.ts` | **Modifica** | Import + aggregazioni + inserimento immagini + tabella mensile |

---

## Task 1: Installare chart.js

**Files:**
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: `import Chart from "chart.js/auto"` disponibile in `lib/chartToImage.ts`

- [ ] **Step 1: Installare il pacchetto**

```bash
npm install chart.js
```

Expected: `added 1 package` (chart.js v4.x — include i suoi tipi TypeScript).

- [ ] **Step 2: Verificare che il tipo principale sia accessibile**

```bash
ls node_modules/chart.js/types/index.d.ts && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Verificare che TypeScript compili ancora**

```bash
npx tsc --noEmit 2>&1
```

Expected: nessun output (zero errori).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add chart.js dependency for PDF chart rendering"
```

---

## Task 2: Creare `lib/chartToImage.ts`

**Files:**
- Create: `lib/chartToImage.ts`

**Interfaces:**
- Consumes: `import Chart from "chart.js/auto"`
- Produces:
  - `renderPieChart(slices: { label: string; value: number }[], title: string): Promise<string>` — data URL PNG 400×400
  - `renderBarLineChart(months: { label: string; entrate: number; uscite: number; netto: number }[]): Promise<string>` — data URL PNG 800×320

- [ ] **Step 1: Verificare che TypeScript compili prima di scrivere (baseline)**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errori.

- [ ] **Step 2: Creare il file**

Crea `lib/chartToImage.ts` con il seguente contenuto esatto:

```typescript
import Chart from "chart.js/auto";

const PIE_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
];

export async function renderPieChart(
  slices: { label: string; value: number }[],
  title: string
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  canvas.style.cssText = "visibility:hidden;position:absolute;top:-9999px";
  document.body.appendChild(canvas);

  const chart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: slices.map((s) => s.label),
      datasets: [
        {
          data: slices.map((s) => s.value),
          backgroundColor: PIE_COLORS.slice(0, slices.length),
          borderWidth: 1,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, boxWidth: 14 },
        },
        title: {
          display: true,
          text: title,
          font: { size: 13, weight: "bold" },
        },
        tooltip: { enabled: false },
      },
    },
  });

  const dataUrl = canvas.toDataURL("image/png");
  chart.destroy();
  canvas.remove();
  return dataUrl;
}

export async function renderBarLineChart(
  months: { label: string; entrate: number; uscite: number; netto: number }[]
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 320;
  canvas.style.cssText = "visibility:hidden;position:absolute;top:-9999px";
  document.body.appendChild(canvas);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    type: "bar",
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          type: "bar",
          label: "Entrate",
          data: months.map((m) => m.entrate),
          backgroundColor: "#10b981",
          borderRadius: 2,
        },
        {
          type: "bar",
          label: "Uscite",
          data: months.map((m) => m.uscite),
          backgroundColor: "#ef4444",
          borderRadius: 2,
        },
        {
          type: "line",
          label: "Netto",
          data: months.map((m) => m.netto),
          borderColor: "#111827",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#111827",
          fill: false,
          tension: 0.3,
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, boxWidth: 14 },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "#e5e7eb" } },
      },
    },
  };

  const chart = new Chart(canvas, config);
  const dataUrl = canvas.toDataURL("image/png");
  chart.destroy();
  canvas.remove();
  return dataUrl;
}
```

- [ ] **Step 3: Verificare TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add lib/chartToImage.ts
git commit -m "feat: add chartToImage utility (pie and bar+line chart renderers)"
```

---

## Task 3: Aggiungere le due torte al PDF mensile

**Files:**
- Modify: `lib/exportFinancePDF.ts`

**Interfaces:**
- Consumes:
  - `renderPieChart(slices: { label: string; value: number }[], title: string): Promise<string>` da `./chartToImage` (Task 2)
  - `summary.appointments[].serviceType: string`, `summary.appointments[].price: string`
  - `summary.expenses[].category: string`, `summary.expenses[].amount: string`
- Produces: PDF mensile con sezione "Distribuzione" (due torte affiancate) inserita dopo la tabella KPI e prima della tabella appuntamenti

- [ ] **Step 1: Aggiungere l'import di `renderPieChart` e `renderBarLineChart`**

Trovare la riga degli import in cima a `lib/exportFinancePDF.ts`:

```typescript
import { getFinancialSummary, getExpenses } from "@/actions/expenses";
```

Sostituirla con:

```typescript
import { getFinancialSummary, getExpenses } from "@/actions/expenses";
import { renderPieChart, renderBarLineChart } from "./chartToImage";
```

- [ ] **Step 2: Inserire il blocco delle torte dopo il KPI**

Trovare questo blocco in `lib/exportFinancePDF.ts` (il commento che introduce la sezione appuntamenti):

```typescript
  // ── Appointments ─────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Appuntamenti (pagati)", 14, y);
```

Inserire il seguente blocco **prima** di quel commento (lasciando il commento e il codice degli appuntamenti invariati):

```typescript
  // ── Monthly: pie charts ──────────────────────────────────────────────────────
  if (period === "month") {
    const entratePerServizio = new Map<string, number>();
    for (const a of summary.appointments) {
      const price = parseFloat(a.price);
      entratePerServizio.set(
        a.serviceType,
        (entratePerServizio.get(a.serviceType) ?? 0) + price
      );
    }
    const spesePerCategoria = new Map<string, number>();
    for (const e of summary.expenses) {
      const amount = parseFloat(e.amount);
      spesePerCategoria.set(
        e.category,
        (spesePerCategoria.get(e.category) ?? 0) + amount
      );
    }

    const entrateSlices = Array.from(entratePerServizio.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
    const speseSlices = Array.from(spesePerCategoria.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

    const [pieEntrate, pieSpese] = await Promise.all([
      entrateSlices.length > 0
        ? renderPieChart(entrateSlices, "Entrate per servizio")
        : Promise.resolve(null as null),
      speseSlices.length > 0
        ? renderPieChart(speseSlices, "Spese per categoria")
        : Promise.resolve(null as null),
    ]);

    const pieW = 80;
    const pieH = 80;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Distribuzione", 14, y);
    y += 6;

    if (pieEntrate) {
      doc.addImage(pieEntrate, "PNG", 14, y, pieW, pieH);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("Nessun dato", 14 + pieW / 2, y + pieH / 2, { align: "center" });
      doc.setTextColor(0);
    }

    if (pieSpese) {
      doc.addImage(pieSpese, "PNG", 108, y, pieW, pieH);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("Nessun dato", 108 + pieW / 2, y + pieH / 2, { align: "center" });
      doc.setTextColor(0);
    }

    y += pieH + 12;
  }

```

- [ ] **Step 3: Verificare TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errori. Se ci sono errori su `renderBarLineChart` (import non usato), è normale — verrà usato in Task 4.

- [ ] **Step 4: Commit**

```bash
git add lib/exportFinancePDF.ts
git commit -m "feat: add pie charts to monthly finance PDF"
```

---

## Task 4: Aggiungere grafico barre + tabella mensile al PDF annuale

**Files:**
- Modify: `lib/exportFinancePDF.ts`

**Interfaces:**
- Consumes:
  - `renderBarLineChart(months: { label: string; entrate: number; uscite: number; netto: number }[]): Promise<string>` da `./chartToImage` (già importato in Task 3)
  - `summary.appointments[].startTime: string`, `summary.appointments[].price: string`
  - `summary.expenses[].date: string`, `summary.expenses[].amount: string`
  - `format` e `it` locale già importati da `date-fns`
- Produces: PDF annuale con sezione "Andamento mensile" (grafico + tabella 12 mesi colorata) inserita dopo la tabella KPI e prima della tabella appuntamenti

- [ ] **Step 1: Inserire il blocco annuale dopo il KPI**

Trovare lo stesso punto di inserimento del Task 3 in `lib/exportFinancePDF.ts` — il blocco `if (period === "month")` appena aggiunto termina con `y += pieH + 12; }`. Inserire il seguente blocco **dopo** la chiusura del blocco `if (period === "month")` e **prima** del commento `// ── Appointments`:

```typescript
  // ── Annual: bar chart + monthly table ───────────────────────────────────────
  if (period === "year") {
    const year = now.getFullYear();
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, i, 1);
      const monthStr = format(d, "yyyy-MM");
      const label = format(d, "MMM", { locale: it });
      const entrMese = summary.appointments
        .filter((a) => format(new Date(a.startTime), "yyyy-MM") === monthStr)
        .reduce((s, a) => s + parseFloat(a.price), 0);
      const uscMese = summary.expenses
        .filter((e) => format(new Date(e.date), "yyyy-MM") === monthStr)
        .reduce((s, e) => s + parseFloat(e.amount), 0);
      return { label, entrate: entrMese, uscite: uscMese, netto: entrMese - uscMese };
    });

    const barImg = await renderBarLineChart(monthlyData);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Andamento mensile", 14, y);
    y += 6;
    doc.addImage(barImg, "PNG", 14, y, 182, 70);
    y += 70 + 12;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Riepilogo mensile", 14, y);
    y += 4;

    const nettoValues = monthlyData.map((m) => m.netto);

    autoTable(doc, {
      startY: y,
      head: [["Mese", "Entrate", "Uscite", "Netto"]],
      body: monthlyData.map((m) => [
        m.label.charAt(0).toUpperCase() + m.label.slice(1),
        formatEur(m.entrate),
        formatEur(m.uscite),
        formatEur(m.netto),
      ]),
      foot: [
        [
          "Totale annuale",
          formatEur(monthlyData.reduce((s, m) => s + m.entrate, 0)),
          formatEur(monthlyData.reduce((s, m) => s + m.uscite, 0)),
          formatEur(monthlyData.reduce((s, m) => s + m.netto, 0)),
        ],
      ],
      theme: "striped",
      headStyles: { fillColor: [40, 40, 40] },
      footStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const netto = nettoValues[data.row.index];
          if (netto >= 0) {
            data.cell.styles.fillColor = [209, 250, 229] as [number, number, number];
            data.cell.styles.textColor = [6, 95, 70] as [number, number, number];
          } else {
            data.cell.styles.fillColor = [254, 226, 226] as [number, number, number];
            data.cell.styles.textColor = [153, 27, 27] as [number, number, number];
          }
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 12;
  }

```

- [ ] **Step 2: Verificare TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errori.

- [ ] **Step 3: Verificare build di produzione**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completata senza errori. La route `/finance` avrà un bundle più grande (chart.js ~200 KB) ma è accettabile perché lazy-loaded.

- [ ] **Step 4: Commit**

```bash
git add lib/exportFinancePDF.ts
git commit -m "feat: add bar chart and monthly summary table to annual finance PDF"
```

---

## Task 5: Verifica visuale nel browser

**Files:** nessuno

- [ ] **Step 1: Avviare il dev server**

```bash
npm run dev
```

Aprire `http://localhost:3000/finance` con un account ADMIN.

- [ ] **Step 2: Verificare PDF mensile**

1. Cliccare "Esporta mese"
2. Aprire il PDF scaricato
3. Verificare:
   - Dopo la tabella KPI compare la sezione "Distribuzione"
   - Due grafici a torta affiancati (o "Nessun dato" se il mese è vuoto)
   - La torta sinistra ha titolo "Entrate per servizio"
   - La torta destra ha titolo "Spese per categoria"
   - Legende colorate in basso a ciascuna torta
   - Le tabelle appuntamenti e spese seguono normalmente

- [ ] **Step 3: Verificare PDF annuale**

1. Cliccare "Esporta anno"
2. Aprire il PDF scaricato
3. Verificare:
   - Dopo la tabella KPI compare "Andamento mensile" con il grafico barre (larghezza intera pagina)
   - Barre verdi = entrate, barre rosse = uscite, linea nera = netto
   - Sotto il grafico: tabella "Riepilogo mensile" con 12 righe
   - La colonna Netto è colorata (verde se ≥ 0, rossa se < 0)
   - Ultima riga: totale annuale su sfondo scuro
   - Le tabelle individuali di appuntamenti e spese seguono

- [ ] **Step 4: Probe — mese senza appuntamenti**

Se possibile, verificare che con un mese vuoto la torta "Entrate per servizio" mostri "Nessun dato" invece di un grafico vuoto o un crash.

- [ ] **Step 5: Probe — anno con mesi a zero**

Verificare che il grafico annuale mostri correttamente i mesi con entrate/uscite = 0 (barre assenti, linea netto a zero), senza crash.

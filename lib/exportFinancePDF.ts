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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { renderPieChart, renderBarLineChart } from "./chartToImage";

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

  // ── Pie charts (month only) ──────────────────────────────────────────────────
  if (period === "month") {
    // Slices: revenue by service type
    const serviceMap = new Map<string, number>();
    for (const a of summary.appointments) {
      serviceMap.set(
        a.serviceType,
        (serviceMap.get(a.serviceType) ?? 0) + parseFloat(a.price)
      );
    }
    const serviceSlices = Array.from(serviceMap.entries()).map(
      ([label, value]) => ({ label, value })
    );

    // Slices: expenses by category
    const expenseMap = new Map<string, number>();
    for (const e of summary.expenses) {
      expenseMap.set(
        e.category,
        (expenseMap.get(e.category) ?? 0) + parseFloat(e.amount)
      );
    }
    const expenseSlices = Array.from(expenseMap.entries()).map(
      ([label, value]) => ({ label, value })
    );

    const pieY = y;
    const pieW = 80;
    const pieH = 80;

    // Left pie: revenue by service
    if (serviceSlices.length > 0) {
      const serviceImg = await renderPieChart(serviceSlices, "Entrate per servizio");
      doc.addImage(serviceImg, "PNG", 14, pieY, pieW, pieH);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Nessun dato", 14 + pieW / 2, pieY + pieH / 2, { align: "center" });
      doc.setTextColor(0);
    }

    // Right pie: expenses by category
    if (expenseSlices.length > 0) {
      const expenseImg = await renderPieChart(expenseSlices, "Spese per categoria");
      doc.addImage(expenseImg, "PNG", 108, pieY, pieW, pieH);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Nessun dato", 108 + pieW / 2, pieY + pieH / 2, { align: "center" });
      doc.setTextColor(0);
    }

    y += pieH + 12;
  }

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

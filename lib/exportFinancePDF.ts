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

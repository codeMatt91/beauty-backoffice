"use client";

import { useState, useEffect, useTransition } from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { getFinancialSummary, getExpenses, createExpense, deleteExpense } from "@/actions/expenses";
import FinancialChart from "@/components/finance/FinancialChart";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Filter,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { ExpenseCategory } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialData {
  appointments: { startTime: string; price: string }[];
  expenses: { date: string; amount: string; category: string }[];
}

type Granularity = "day" | "month";

const SERVICE_FILTERS = [
  "Tutti",
  "Pulizia viso",
  "Massaggio rilassante",
  "Trattamento corpo",
  "Manicure",
  "Pedicure",
  "Ceretta",
  "Laser",
  "Radiofrequenza",
  "Pressoterapia",
  "Altro",
];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "AFFITTO", "UTENZE", "MATERIALI", "PERSONALE", "MARKETING", "MANUTENZIONE", "ALTRO",
];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, trend }: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`p-2 rounded-lg ${
          trend === "up" ? "bg-emerald-100 text-emerald-600" :
          trend === "down" ? "bg-red-100 text-red-600" :
          "bg-secondary text-muted-foreground"
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ─── Add Expense Modal ─────────────────────────────────────────────────────────

function AddExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("ALTRO");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createExpense({
        amount: parseFloat(amount),
        description,
        category,
        date: new Date(date).toISOString(),
      });
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Nuova spesa</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Importo (€) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Descrizione *</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary">
              Annulla
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50">
              {loading ? "..." : "Aggiungi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [data, setData] = useState<FinancialData>({ appointments: [], expenses: [] });
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, startTransition] = useTransition();

  // Filters
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [serviceFilter, setServiceFilter] = useState("Tutti");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  async function loadData() {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    const [fin, exp] = await Promise.all([
      getFinancialSummary(from, to),
      getExpenses(from, to),
    ]);
    setData(fin as any);
    setExpenses(exp as any);
  }

  useEffect(() => {
    startTransition(() => { loadData(); });
  }, [dateFrom, dateTo]);

  // ── Compute chart data ──────────────────────────────────────────────────────

  const chartData = (() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    const filteredApts = serviceFilter === "Tutti"
      ? data.appointments
      : data.appointments.filter((a: any) => a.serviceType === serviceFilter);

    if (granularity === "day") {
      const days = eachDayOfInterval({ start: from, end: to });
      return days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const entrate = filteredApts
          .filter((a: any) => format(new Date(a.startTime), "yyyy-MM-dd") === dayStr)
          .reduce((sum: number, a: any) => sum + parseFloat(a.price), 0);
        const uscite = data.expenses
          .filter((e: any) => format(new Date(e.date), "yyyy-MM-dd") === dayStr)
          .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
        return { label: format(day, "d/M"), entrate, uscite, profitto: entrate - uscite };
      });
    } else {
      const months = eachMonthOfInterval({ start: from, end: to });
      return months.map((month) => {
        const monthStr = format(month, "yyyy-MM");
        const entrate = filteredApts
          .filter((a: any) => format(new Date(a.startTime), "yyyy-MM") === monthStr)
          .reduce((sum: number, a: any) => sum + parseFloat(a.price), 0);
        const uscite = data.expenses
          .filter((e: any) => format(new Date(e.date), "yyyy-MM") === monthStr)
          .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
        return { label: format(month, "MMM yy", { locale: it }), entrate, uscite, profitto: entrate - uscite };
      });
    }
  })();

  // ── KPI totals ──────────────────────────────────────────────────────────────

  const totaleEntrate = chartData.reduce((s, d) => s + d.entrate, 0);
  const totaleUscite = chartData.reduce((s, d) => s + d.uscite, 0);
  const profittoNetto = totaleEntrate - totaleUscite;

  // ── Quick date presets ──────────────────────────────────────────────────────

  const presets = [
    {
      label: "Questo mese",
      fn: () => {
        setDateFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(new Date()), "yyyy-MM-dd"));
        setGranularity("day");
      },
    },
    {
      label: "Quest'anno",
      fn: () => {
        setDateFrom(format(startOfYear(new Date()), "yyyy-MM-dd"));
        setDateTo(format(endOfYear(new Date()), "yyyy-MM-dd"));
        setGranularity("month");
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard Finanziaria" userName="" />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-5">

        {/* ── Filters bar ── */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filtri
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Service filter */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {SERVICE_FILTERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Granularity */}
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

            {/* Quick presets */}
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={p.fn}
                className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Entrate totali" value={formatCurrency(totaleEntrate)} icon={TrendingUp} trend="up" />
          <StatCard label="Uscite totali" value={formatCurrency(totaleUscite)} icon={TrendingDown} trend="down" />
          <StatCard
            label="Profitto netto"
            value={formatCurrency(profittoNetto)}
            icon={DollarSign}
            trend={profittoNetto >= 0 ? "up" : "down"}
          />
        </div>

        {/* ── Chart ── */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4">
            Entrate vs Uscite
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({granularity === "day" ? "giornaliero" : "mensile"})
            </span>
          </h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Caricamento...
            </div>
          ) : (
            <FinancialChart data={chartData} granularity={granularity} />
          )}
        </div>

        {/* ── Expenses table ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Spese del periodo</h3>
            <button
              onClick={() => setAddExpenseOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Aggiungi spesa
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Descrizione</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Categoria</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Importo</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((e: any) => (
                  <tr key={e.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {format(new Date(e.date), "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-2.5">{e.description}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded-full">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-red-600">
                      -{formatCurrency(e.amount.toString())}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm("Eliminare questa spesa?")) return;
                          await deleteExpense(e.id);
                          loadData();
                        }}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Nessuna spesa registrata nel periodo
                    </td>
                  </tr>
                )}
              </tbody>
              {expenses.length > 0 && (
                <tfoot className="border-t border-border bg-secondary">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 font-semibold text-sm">Totale</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                      -{formatCurrency(expenses.reduce((s: number, e: any) => s + parseFloat(e.amount.toString()), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {addExpenseOpen && (
        <AddExpenseModal
          onClose={() => setAddExpenseOpen(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

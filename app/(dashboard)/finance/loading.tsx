import { Skeleton } from "@/components/ui/Skeleton";
import { Filter, TrendingUp, TrendingDown, DollarSign, Plus } from "lucide-react";

export default function FinanceLoading() {
  return (
    <div className="flex flex-col h-full" role="status" aria-label="Caricamento in corso">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-5">

        {/* Filters bar */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filtri
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <Skeleton className="h-8 w-full sm:w-64 rounded-lg" />
            <Skeleton className="h-8 w-full lg:w-40 rounded-lg" />
            <Skeleton className="h-8 w-full lg:w-48 rounded-lg" />
            <Skeleton className="h-8 w-full lg:w-56 rounded-lg" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[TrendingUp, TrendingDown, DollarSign].map((Icon, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Icon className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-card rounded-xl border border-border p-4">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>

        {/* Expenses table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Spese del periodo</h3>
            <button disabled className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/50 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
              Aggiungi spesa
            </button>
          </div>
          <div className="bg-secondary h-11" />
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

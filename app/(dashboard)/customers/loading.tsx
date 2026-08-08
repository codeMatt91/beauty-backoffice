import { Skeleton } from "@/components/ui/Skeleton";
import { Users, Plus } from "lucide-react";

export default function CustomersLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary/40" />
            <div className="space-y-1.5">
              <h2 className="font-semibold text-foreground">Anagrafica Clienti</h2>
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/50 text-primary-foreground rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuovo cliente
          </button>
        </div>

        <Skeleton className="h-10 w-full rounded-lg" />

        {/* Table – Desktop */}
        <div className="hidden md:block rounded-xl border border-border overflow-hidden">
          <div className="bg-secondary h-11" />
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16 rounded-full" />
                <div className="ml-auto flex gap-1">
                  <Skeleton className="h-6 w-6 rounded-lg" />
                  <Skeleton className="h-6 w-6 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards – Mobile */}
        <div className="md:hidden space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

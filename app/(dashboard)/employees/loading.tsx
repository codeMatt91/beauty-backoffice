import { Skeleton } from "@/components/ui/Skeleton";
import { UserCog, Plus } from "lucide-react";

export default function EmployeesLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary/40" />
            <div className="space-y-1.5">
              <h2 className="font-semibold">Utenti del sistema</h2>
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <button disabled className="flex items-center gap-1.5 px-3 py-2 bg-primary/50 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            Nuovo utente
          </button>
        </div>

        {/* Table – Desktop */}
        <div className="hidden md:block rounded-xl border border-border overflow-hidden">
          <div className="bg-secondary h-11" />
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3.5 w-16" />
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

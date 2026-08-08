import { Skeleton } from "@/components/ui/Skeleton";
import { Archive, Download, AlertTriangle, Scissors, Plus } from "lucide-react";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col h-full" role="status" aria-label="Caricamento in corso">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 max-w-2xl">

        {/* ── Service Types (skeleton) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-primary/40" />
              <div>
                <h3 className="font-semibold text-foreground">Tipologie di Prestazioni</h3>
                <p className="text-sm text-muted-foreground">
                  Gestisci i servizi disponibili per gli appuntamenti
                </p>
              </div>
            </div>
            <button disabled className="flex items-center gap-1.5 px-3 py-2 bg-primary/50 text-primary-foreground rounded-lg text-sm font-medium shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuova prestazione</span>
            </button>
          </div>

          <div className="p-5 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="hidden md:block rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary h-11" />
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <div className="ml-auto flex gap-1">
                      <Skeleton className="h-6 w-6 rounded-lg" />
                      <Skeleton className="h-6 w-6 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:hidden space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Data Purge (static, rendered in full — doesn't depend on fetched data) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900">
            <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Pulizia e Archiviazione Dati</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Esporta e cancella appuntamenti obsoleti per liberare spazio sul database
              </p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 dark:bg-amber-950/40 dark:border-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Operazione irreversibile.</strong> I record verranno eliminati dal database dopo l'esportazione ZIP.
                Assicurati di salvare il file scaricato in un luogo sicuro.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Archivia appuntamenti più vecchi di:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  disabled
                  value={12}
                  readOnly
                  className="w-24 px-3 py-2 rounded-lg border border-input bg-background text-sm"
                />
                <span className="text-sm text-muted-foreground">mesi fa</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Saranno archiviati tutti gli appuntamenti con data antecedente al {
                  new Date(
                    new Date().setMonth(new Date().getMonth() - 12)
                  ).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
                }
              </p>
            </div>

            <button disabled className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/50 text-white rounded-lg text-sm font-medium">
              <Download className="w-4 h-4" />
              Esporta e cancella dati
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

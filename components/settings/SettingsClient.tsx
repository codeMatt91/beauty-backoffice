"use client";

import { useState } from "react";
import { Archive, Download, AlertTriangle, CheckCircle2, Scissors, Plus } from "lucide-react";
import { getServiceTypes } from "@/actions/serviceTypes";
import ServiceTypeList from "@/components/settings/ServiceTypeList";
import ServiceTypeForm from "@/components/settings/ServiceTypeForm";

interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
}

interface Props {
  initialServiceTypes: ServiceType[];
}

export default function SettingsClient({ initialServiceTypes }: Props) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>(initialServiceTypes);
  const [formOpen, setFormOpen] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null);

  async function loadServiceTypes() {
    const data = await getServiceTypes();
    setServiceTypes(data);
  }

  function openCreate() {
    setEditingServiceType(null);
    setFormOpen(true);
  }

  function openEdit(s: ServiceType) {
    setEditingServiceType(s);
    setFormOpen(true);
  }

  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: { filename: string; recordCount: number };
    error?: string;
  } | null>(null);

  async function handlePurge() {
    if (
      !confirm(
        `ATTENZIONE: Questa operazione eliminerà permanentemente gli appuntamenti più vecchi di ${months} mesi dopo averli esportati in ZIP.\n\nContinuare?`
      )
    )
      return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanMonths: months }),
      });

      if (!res.ok) {
        const err = await res.json();
        setResult({ error: err.error ?? "Errore sconosciuto" });
        return;
      }

      // Scarica il file ZIP
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "archive.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Leggi il recordCount dall'header
      const recordCount = parseInt(res.headers.get("X-Record-Count") ?? "0", 10);
      setResult({ success: { filename, recordCount } });
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 max-w-2xl">

        {/* ── Service Types ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Tipologie di Prestazioni</h3>
                <p className="text-sm text-muted-foreground">
                  Gestisci i servizi disponibili per gli appuntamenti
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuova prestazione</span>
            </button>
          </div>

          <div className="p-5">
            <ServiceTypeList
              serviceTypes={serviceTypes}
              onEdit={openEdit}
              onRefresh={loadServiceTypes}
            />
          </div>
        </div>

        {/* ── Data Purge ── */}
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
                  min={1}
                  max={60}
                  value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">mesi fa</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Saranno archiviati tutti gli appuntamenti con data antecedente al {
                  new Date(
                    new Date().setMonth(new Date().getMonth() - months)
                  ).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
                }
              </p>
            </div>

            <button
              onClick={handlePurge}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {loading ? "Elaborazione in corso..." : "Esporta e cancella dati"}
            </button>

            {/* Result feedback */}
            {result?.success && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex gap-2 dark:bg-emerald-950/40 dark:border-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
                <div className="text-sm text-emerald-800 dark:text-emerald-300">
                  <p className="font-medium">Archiviazione completata</p>
                  <p>
                    {result.success.recordCount} appuntamenti esportati in{" "}
                    <span className="font-mono text-xs bg-emerald-100 px-1 rounded dark:bg-emerald-900/60 dark:text-emerald-200">
                      {result.success.filename}
                    </span>
                    {" "}e rimossi dal database.
                  </p>
                </div>
              </div>
            )}

            {result?.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{result.error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ServiceTypeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        serviceType={editingServiceType}
        onSaved={loadServiceTypes}
      />
    </div>
  );
}

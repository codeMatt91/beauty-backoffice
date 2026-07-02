"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Archive, Download, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export default function SettingsPage() {
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
      <Header title="Impostazioni" userName="" />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 max-w-2xl">

        {/* ── Data Purge ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-50 border-amber-100">
            <Archive className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-900">Pulizia e Archiviazione Dati</h3>
              <p className="text-sm text-amber-700">
                Esporta e cancella appuntamenti obsoleti per liberare spazio sul database
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
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
                  onChange={(e) => setMonths(parseInt(e.target.value))}
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
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <p className="font-medium">Archiviazione completata</p>
                  <p>
                    {result.success.recordCount} appuntamenti esportati in{" "}
                    <span className="font-mono text-xs bg-emerald-100 px-1 rounded">
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

        {/* ── WhatsApp Reminder status ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Reminder WhatsApp</h3>
              <p className="text-sm text-muted-foreground">Notifiche automatiche via cron job</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Orario invio</span>
              <span className="text-sm font-medium">Ogni giorno alle 09:00</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Provider</span>
              <span className="text-sm font-medium font-mono">WHATSAPP_PROVIDER=twilio</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Configurazione</span>
              <span className="text-sm font-medium font-mono">.env → TWILIO_*</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Il cron job è definito in <code className="bg-secondary px-1 rounded">vercel.json</code> e
              viene eseguito automaticamente su Vercel. Per testarlo in locale, chiama{" "}
              <code className="bg-secondary px-1 rounded">POST /api/cron/whatsapp-reminder</code> con
              header <code className="bg-secondary px-1 rounded">Authorization: Bearer CRON_SECRET</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

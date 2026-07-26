"use client";

import { useState, useEffect } from "react";
import { createServiceType, updateServiceType } from "@/actions/serviceTypes";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  serviceType?: ServiceType | null;
  onSaved: () => void;
}

export default function ServiceTypeForm({ open, onClose, serviceType, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(serviceType?.name ?? "");
  }, [open, serviceType]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = serviceType
        ? await updateServiceType(serviceType.id, { name })
        : await createServiceType({ name });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Errore durante il salvataggio. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl border border-border focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold text-foreground">
              {serviceType ? "Modifica prestazione" : "Nuova prestazione"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="serviceTypeName">Nome *</label>
              <input
                id="serviceTypeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Es. Manicure"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Salvataggio..." : serviceType ? "Aggiorna" : "Crea"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

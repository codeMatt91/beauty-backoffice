"use client";

import { useState } from "react";
import { createCustomer, updateCustomer } from "@/actions/customers";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  age: number | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSaved: () => void;
}

export default function CustomerForm({ open, onClose, customer, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(customer?.phoneNumber ?? "");
  const [age, setAge] = useState(customer?.age?.toString() ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const data = {
      firstName,
      lastName,
      phoneNumber: phoneNumber || null,
      age: age ? parseInt(age) : null,
      notes: notes || null,
    };

    try {
      if (customer) {
        await updateCustomer(customer.id, data);
      } else {
        await createCustomer(data);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Errore durante il salvataggio");
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
              {customer ? "Modifica cliente" : "Nuovo cliente"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nome *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Cognome *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Telefono</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+39 333 000 0000"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Età</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Note</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Allergie, preferenze, note varie..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
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
                {loading ? "Salvataggio..." : customer ? "Aggiorna" : "Crea"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

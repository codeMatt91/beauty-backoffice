"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { createAppointment, updateAppointment, deleteAppointment } from "@/actions/appointments";
import { getCustomers } from "@/actions/customers";
import { PaymentStatus } from "@prisma/client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Trash2 } from "lucide-react";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
}

interface Employee {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  customerId: string;
  employeeId: string | null;
  serviceType: string;
  startTime: Date;
  endTime: Date;
  price: string;
  paymentStatus: PaymentStatus;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  defaultDate?: Date;
  employees: Employee[];
  onSaved: () => void;
}

const SERVICE_TYPES = [
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

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "PAID", label: "Pagato" },
  { value: "PENDING", label: "Da pagare" },
  { value: "OPTIONAL", label: "Opzionale" },
];

export default function AppointmentModal({ open, onClose, appointment, defaultDate, employees, onSaved }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(appointment?.customerId ?? "");
  const [employeeId, setEmployeeId] = useState(appointment?.employeeId ?? "");
  const [serviceType, setServiceType] = useState(appointment?.serviceType ?? SERVICE_TYPES[0]);
  const [startTime, setStartTime] = useState(
    appointment ? format(new Date(appointment.startTime), "yyyy-MM-dd'T'HH:mm") : format(defaultDate ?? new Date(), "yyyy-MM-dd'T'09:00")
  );
  const [endTime, setEndTime] = useState(
    appointment ? format(new Date(appointment.endTime), "yyyy-MM-dd'T'HH:mm") : format(defaultDate ?? new Date(), "yyyy-MM-dd'T'10:00")
  );
  const [price, setPrice] = useState(appointment?.price ?? "0");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(appointment?.paymentStatus ?? "PENDING");
  const [notes, setNotes] = useState(appointment?.notes ?? "");

  useEffect(() => {
    if (!open) return;
    getCustomers().then(setCustomers);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        customerId,
        employeeId: employeeId || null,
        serviceType,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        price: parseFloat(price),
        paymentStatus,
        notes: notes || null,
      };

      if (appointment) {
        await updateAppointment(appointment.id, data);
      } else {
        await createAppointment(data);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Errore durante il salvataggio");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!appointment || !confirm("Sei sicuro di voler eliminare questo appuntamento?")) return;
    setLoading(true);
    try {
      await deleteAppointment(appointment.id);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card shadow-2xl border border-border focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold text-foreground">
              {appointment ? "Modifica appuntamento" : "Nuovo appuntamento"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Cliente *</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleziona cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName} {c.firstName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Operatrice</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Nessuna assegnazione</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Prestazione *</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Inizio *</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Fine *</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Prezzo (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Pagamento</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PAYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Note</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              {appointment && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors border border-destructive/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Salvataggio..." : appointment ? "Aggiorna" : "Crea"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

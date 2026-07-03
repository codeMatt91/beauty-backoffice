"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Phone, Calendar, Pencil, Trash2, ChevronRight, Search } from "lucide-react";
import { deleteCustomer } from "@/actions/customers";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  age: number | null;
  notes: string | null;
  createdAt: Date;
  _count: { appointments: number };
}

interface Props {
  customers: Customer[];
  onEdit: (c: Customer) => void;
  onRefresh: () => void;
}

export default function CustomerTable({ customers, onEdit, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.phoneNumber?.includes(q)
    );
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare ${name}? Tutti gli appuntamenti associati saranno eliminati.`)) return;
    setDeleting(id);
    try {
      await deleteCustomer(id);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cerca per nome o telefono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table – Desktop */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Telefono</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Età</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Appuntamenti</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Registrato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-medium">
                  {c.lastName} {c.firstName}
                  {c.notes && (
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.notes}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.phoneNumber ? (
                    <a href={`tel:${c.phoneNumber}`} className="flex items-center gap-1 hover:text-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      {c.phoneNumber}
                    </a>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.age ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5">
                    <Calendar className="w-3 h-3" />
                    {c._count.appointments}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onEdit(c)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      aria-label={`Modifica ${c.firstName} ${c.lastName}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, `${c.firstName} ${c.lastName}`)}
                      disabled={deleting === c.id}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
                      aria-label={`Elimina ${c.firstName} ${c.lastName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nessun cliente trovato
          </div>
        )}
      </div>

      {/* Cards – Mobile */}
      <div className="md:hidden space-y-2">
        {filtered.map((c) => (
          <div key={c.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{c.lastName} {c.firstName}</p>
                {c.phoneNumber && (
                  <a href={`tel:${c.phoneNumber}`} className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                    <Phone className="w-3 h-3" />
                    {c.phoneNumber}
                  </a>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(c)}
                  className="p-2 rounded-lg hover:bg-secondary"
                  aria-label={`Modifica ${c.firstName} ${c.lastName}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(c.id, `${c.firstName} ${c.lastName}`)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                  aria-label={`Elimina ${c.firstName} ${c.lastName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                {c._count.appointments} appuntamenti
              </span>
              {c.age && <span>Età: {c.age}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

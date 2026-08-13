"use client";

import { useState } from "react";
import { Pencil, Trash2, Search } from "lucide-react";
import { deleteServiceType } from "@/actions/serviceTypes";

interface ServiceType {
  id: string;
  name: string;
  defaultPrice: string;
  durationMinutes: number | null;
  color: string;
}

function formatPrice(price: string) {
  return `€ ${Number(price).toFixed(2)}`;
}

function formatDuration(minutes: number | null) {
  return minutes != null ? `${minutes} min` : "—";
}

interface Props {
  serviceTypes: ServiceType[];
  onEdit: (s: ServiceType) => void;
  onRefresh: () => void;
}

export default function ServiceTypeList({ serviceTypes, onEdit, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = serviceTypes.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Eliminare la prestazione "${name}"? Gli appuntamenti esistenti non verranno modificati.`
      )
    )
      return;
    setDeleting(id);
    try {
      await deleteServiceType(id);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  const emptyMessage = serviceTypes.length === 0 ? "Nessuna prestazione configurata" : "Nessuna prestazione trovata";

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cerca prestazione..."
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Nome
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Prezzo
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Durata
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatPrice(s.defaultPrice)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDuration(s.durationMinutes)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onEdit(s)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      aria-label={`Modifica ${s.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deleting === s.id}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
                      aria-label={`Elimina ${s.name}`}
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
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Cards – Mobile/Tablet */}
      <div className="md:hidden space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(s.defaultPrice)} · {formatDuration(s.durationMinutes)}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(s)}
                  className="p-2 rounded-lg hover:bg-secondary"
                  aria-label={`Modifica ${s.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                  aria-label={`Elimina ${s.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

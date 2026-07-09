"use client";

import { Pencil, Trash2, Shield, User as UserIcon } from "lucide-react";
import { Role } from "@prisma/client";
import { formatDate } from "@/lib/utils";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

interface Props {
  users: UserRecord[];
  onEdit: (user: UserRecord) => void;
  onDelete: (id: string, name: string) => void;
}

export default function UserTable({ users, onEdit, onDelete }: Props) {
  return (
    <>
      {/* Table – Desktop */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ruolo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Registrato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    u.role === "ADMIN"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                    {u.role === "ADMIN" ? "Admin" : "Dipendente"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onEdit(u)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      aria-label={`Modifica ${u.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(u.id, u.name)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label={`Elimina ${u.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards – Mobile */}
      <div className="md:hidden space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{u.name}</p>
                <p className="text-sm text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onEdit(u)}
                  className="p-2 rounded-lg hover:bg-secondary"
                  aria-label={`Modifica ${u.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(u.id, u.name)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                  aria-label={`Elimina ${u.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                u.role === "ADMIN"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                {u.role === "ADMIN" ? "Admin" : "Dipendente"}
              </span>
              <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { getAllUsers, createUser, updateUser, deleteUser } from "@/actions/users";
import Header from "@/components/layout/Header";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Pencil, Trash2, UserCog, Shield, User, X } from "lucide-react";
import { Role } from "@prisma/client";
import { formatDate } from "@/lib/utils";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user?: UserRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = user
        ? await updateUser(user.id, { name, email, role, ...(password ? { password } : {}) })
        : await createUser({ name, email, password, role });
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
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl border border-border focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold">
              {user ? "Modifica utente" : "Nuovo utente"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome completo *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Password {user ? "(lascia vuoto per non cambiare)" : "*"}
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required={!user} minLength={8} placeholder="Min. 8 caratteri"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ruolo</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="EMPLOYEE">Dipendente</option>
                <option value="ADMIN">Amministratore</option>
              </select>
            </div>
            {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary">Annulla</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50">
                {loading ? "..." : user ? "Aggiorna" : "Crea"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    const data = await getAllUsers();
    setUsers(data as UserRecord[]);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare l'account di ${name}?`)) return;
    setDeleteError(null);
    try {
      const result = await deleteUser(id);
      if (!result.success) {
        setDeleteError(result.error);
        return;
      }
      load();
    } catch {
      setDeleteError("Errore durante l'eliminazione. Riprova.");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Gestione Dipendenti" userName="" />
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {deleteError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {deleteError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Utenti del sistema</h2>
              <p className="text-sm text-muted-foreground">{users.length} account</p>
            </div>
          </div>
          <button onClick={() => { setEditingUser(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            Nuovo utente
          </button>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
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
                      {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.role === "ADMIN" ? "Admin" : "Dipendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setEditingUser(u); setModalOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        aria-label={`Modifica ${u.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
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
      </div>

      {modalOpen && (
        <UserModal
          user={editingUser}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

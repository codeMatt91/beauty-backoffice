"use client";

import { useState, useEffect } from "react";
import { getAllUsers, deleteUser } from "@/actions/users";
import { Plus, UserCog } from "lucide-react";
import UserTable, { UserRecord } from "@/components/employees/UserTable";
import UserModal from "@/components/employees/UserModal";

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

        <UserTable
          users={users}
          onEdit={(u) => { setEditingUser(u); setModalOpen(true); }}
          onDelete={handleDelete}
        />
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

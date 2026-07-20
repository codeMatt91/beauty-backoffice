"use client";

import { useState, useEffect } from "react";
import { getCustomers } from "@/actions/customers";
import CustomerTable from "@/components/customers/CustomerTable";
import CustomerForm from "@/components/customers/CustomerForm";
import { Plus, Users } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  async function load() {
    const data = await getCustomers();
    setCustomers(data);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingCustomer(null);
    setFormOpen(true);
  }

  function openEdit(c: any) {
    setEditingCustomer(c);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Anagrafica Clienti</h2>
              <p className="text-sm text-muted-foreground">{customers.length} clienti registrati</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuovo cliente
          </button>
        </div>

        <CustomerTable
          customers={customers}
          onEdit={openEdit}
          onRefresh={load}
        />
      </div>

      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editingCustomer}
        onSaved={load}
      />
    </div>
  );
}

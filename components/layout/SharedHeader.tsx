"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, LogOut } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Role } from "@prisma/client";
import UserProfileButton from "./UserProfileButton";

const PAGE_TITLES: Record<string, string> = {
  "/calendar": "Calendario",
  "/customers": "Clienti",
  "/finance": "Dashboard Finanziaria",
  "/employees": "Gestione Dipendenti",
  "/settings": "Impostazioni",
};

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export default function SharedHeader({ firstName, lastName, email, role }: Props) {
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const title =
    Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? "";

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card px-4 flex items-center justify-between lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setConfirmOpen(true)}
          aria-label="Esci"
          className="lg:hidden p-1.5 rounded-md hover:bg-secondary"
        >
          <LogOut className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          aria-label="Notifiche"
        >
          <Bell className="w-4 h-4" />
        </button>
        <UserProfileButton
          firstName={firstName}
          lastName={lastName}
          email={email}
          role={role}
        />
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-card shadow-2xl border border-border focus:outline-none p-5">
            <Dialog.Title className="font-semibold text-foreground">
              Esci dall&apos;account?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mt-1">
              Dovrai effettuare nuovamente l&apos;accesso per continuare.
            </Dialog.Description>
            <div className="flex gap-2 pt-4">
              <Dialog.Close asChild>
                <button className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  Annulla
                </button>
              </Dialog.Close>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Esci
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

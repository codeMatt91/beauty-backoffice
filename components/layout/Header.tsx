"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Bell } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

interface HeaderProps {
  title: string;
  userName: string;
}

export default function Header({ title, userName }: HeaderProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between lg:px-6">
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
        <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground hidden md:block">
            {userName}
          </span>
        </div>
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

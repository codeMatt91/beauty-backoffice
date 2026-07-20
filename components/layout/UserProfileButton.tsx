"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import UserProfilePanel from "./UserProfilePanel";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export default function UserProfileButton({ firstName, lastName, email, role }: Props) {
  const [open, setOpen] = useState(false);
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity"
        aria-label="Apri profilo utente"
        aria-expanded={open}
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-primary">{initial}</span>
        </div>
        <span className="text-sm font-medium text-foreground hidden md:block">
          {firstName} {lastName}
        </span>
      </button>

      {open && (
        <UserProfilePanel
          firstName={firstName}
          lastName={lastName}
          email={email}
          role={role}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

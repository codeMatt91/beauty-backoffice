"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import NotificationPanel from "./NotificationPanel";

interface Props {
  hasUnread: boolean;
}

export default function NotificationBell({ hasUnread: initialHasUnread }: Props) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(initialHasUnread);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Notifiche"
        aria-expanded={open}
        className="relative p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
      >
        <Bell className="w-4 h-4" />
        {hasUnread && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <NotificationPanel onClose={() => setOpen(false)} onRead={() => setHasUnread(false)} />
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { getNotifications, markNotificationsAsRead } from "@/actions/notifications";
import type { NotificationItem } from "@/types";

interface Props {
  onClose: () => void;
  onRead: () => void;
}

export default function NotificationPanel({ onClose, onRead }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications()
      .then((data) => {
        setNotifications(data);
        setLoading(false);
        return markNotificationsAsRead();
      })
      .then(() => onRead())
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Transparent overlay — closes panel on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed top-14 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-80 bg-card border border-border rounded-2xl shadow-2xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Notifiche</h2>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 bg-secondary animate-pulse rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Nessuna notifica
            </p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0"
                >
                  {n.success ? (
                    <CheckCircle2
                      className="w-4 h-4 text-green-600 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="w-4 h-4 text-destructive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {n.customerName} – {n.appointmentType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {n.success ? "Email inviata" : n.errorMessage ?? "Invio fallito"}
                      {" · "}
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: it,
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <span
                      className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5"
                      aria-label="Non letta"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

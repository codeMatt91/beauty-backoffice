"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Users,
  TrendingUp,
  UserCog,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/finance", label: "Finanza", icon: TrendingUp, adminOnly: true },
  { href: "/employees", label: "Dipendenti", icon: UserCog, adminOnly: true },
  { href: "/settings", label: "Impostazioni", icon: Settings, adminOnly: true },
];

interface SidebarProps {
  role: string;
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-card border-r border-border">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-foreground">Beauty Backoffice</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
              {item.adminOnly && (
                <span className="ml-auto text-[10px] font-semibold bg-primary/10 text-primary rounded px-1.5 py-0.5">
                  Admin
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-foreground truncate">{userName}</p>
          <p className="text-[11px] text-muted-foreground">
            {isAdmin ? "Amministratore" : "Dipendente"}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Esci
        </button>
      </div>
    </aside>
  );
}

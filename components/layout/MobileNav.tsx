"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarDays, Users, TrendingUp, UserCog, Settings } from "lucide-react";

interface MobileNavProps {
  role: string;
}

const NAV_ITEMS = [
  { href: "/calendar", label: "Agenda", icon: CalendarDays },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/finance", label: "Finanza", icon: TrendingUp, adminOnly: true },
  { href: "/employees", label: "Staff", icon: UserCog, adminOnly: true },
  { href: "/settings", label: "Config.", icon: Settings, adminOnly: true },
];

export default function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border">
      <div className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

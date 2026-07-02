"use client";

import { signOut } from "next-auth/react";
import { Menu, LogOut, Bell } from "lucide-react";

interface HeaderProps {
  title: string;
  userName: string;
}

export default function Header({ title, userName }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between lg:px-6">
      <div className="flex items-center gap-3">
        <button className="lg:hidden p-1.5 rounded-md hover:bg-secondary">
          <Menu className="w-5 h-5" />
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
    </header>
  );
}

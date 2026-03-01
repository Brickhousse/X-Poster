"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, History, Settings } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

const NAV_ITEMS = [
  { href: "/generate", label: "X Generate", icon: Sparkles },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo / App name — hidden on mobile (top bar shows it instead) */}
      <div className="hidden md:flex h-14 items-center border-b border-slate-800 px-4">
        <span className="text-sm font-semibold text-slate-100 tracking-wide">
          XPoster
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-slate-800 text-slate-100 font-medium"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User account */}
      <div className="border-t border-slate-800 p-3">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </div>
  );
}

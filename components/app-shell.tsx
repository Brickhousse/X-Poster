"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Mobile top bar ── */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center border-b border-slate-800 bg-slate-950 px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-slate-400 hover:text-slate-100 focus:outline-none"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="ml-3 text-sm font-semibold text-slate-100">XPoster</span>
      </div>

      {/* ── Backdrop (mobile) ── */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-56 shrink-0 border-r border-slate-800 bg-slate-900 transition-transform duration-200
          md:static md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="md:hidden h-12" /> {/* spacer under mobile top bar */}
        <Sidebar onNavigate={() => setOpen(false)} />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto p-6 pt-16 md:pt-6">
        {children}
      </main>
    </div>
  );
}

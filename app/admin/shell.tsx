"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/admin";
  const isLojas = pathname.startsWith("/admin/lojas");
  const isSettings = pathname.startsWith("/admin/configuracoes");
  return (
    <div className="min-h-screen bg-[#f4f1ec] lg:flex lg:items-start">
      <aside className="hidden lg:flex flex-col sticky top-0 h-screen shrink-0 w-[220px] bg-stone-950 text-white py-5 px-3">
        <p className="font-display font-extrabold text-lg tracking-tight px-2">Kero<span className="text-red-500">.</span> <span className="text-xs font-normal text-stone-400">operador</span></p>
        <nav className="mt-6 space-y-1.5">
          <Link href="/admin"
            className={`flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-bold transition-colors ${isDashboard ? "bg-white text-stone-900 shadow-lg" : "text-stone-300 hover:bg-white/10"}`}>
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18M9 3v18" />
              </svg>
            </span>
            Dashboard
          </Link>
          <Link href="/admin/lojas"
            className={`flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-bold transition-colors ${isLojas ? "bg-white text-stone-900 shadow-lg" : "text-stone-300 hover:bg-white/10"}`}>
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-6h6v6" />
              </svg>
            </span>
            Lojas
          </Link>
          <Link href="/admin/configuracoes"
            className={`flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-bold transition-colors ${isSettings ? "bg-white text-stone-900 shadow-lg" : "text-stone-300 hover:bg-white/10"}`}>
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            Configurações
          </Link>
        </nav>
        <p className="mt-auto px-2 text-[11px] text-stone-500">acesso total · service role no backend</p>
      </aside>
      <div className="lg:hidden sticky top-0 z-40 bg-stone-900 text-white px-4 py-3">
        <span className="font-display font-extrabold">Kero<span className="text-red-500">.</span></span>
        <span className="text-xs text-stone-400 ml-1">operador · {isDashboard ? "Dashboard" : isSettings ? "Configurações" : "Lojas"}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

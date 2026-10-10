"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STORE_NAME, TODAY_ORDERS } from "./mock";

const NAV = [
  { href: "/painel", label: "Hoje", icon: "hoje" },
  { href: "/painel/pedidos", label: "Pedidos", icon: "pedidos" },
  { href: "/painel/cardapio", label: "Cardápio", icon: "cardapio" },
  { href: "/painel/configuracoes", label: "Config", icon: "config" },
];

const PATHS: Record<string, React.ReactNode> = {
  hoje: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  pedidos: (<><path d="M6 2h12v20l-3-2-2 2-2-2-2 2-2-2-1 1z" /><path d="M9 7h6M9 11h6" /></>),
  cardapio: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /><path d="M9 7h7" /></>),
  config: (<><path d="M4 7h9M19 7h1M4 17h3M13 17h7" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /><path d="M4 12h16" /></>),
};

function NavIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

export default function PainelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const awaiting = TODAY_ORDERS.filter((o) => o.status === "new").length;
  const isActive = (href: string) => (href === "/painel" ? pathname === href : pathname.startsWith(href));
  if (pathname.endsWith("/print")) return <>{children}</>; // cupom 80mm: página limpa, sem sidebar

  return (
    <div className="min-h-screen bg-[#f4f1ec] lg:flex lg:items-start">
      {/* trilho expansível no hover (desktop) */}
      <aside className="group/side hidden lg:flex flex-col sticky top-0 h-screen shrink-0 w-[78px] hover:w-[248px] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] bg-stone-950 text-white py-5 px-3 overflow-hidden">
        <div className="flex items-center gap-2.5 px-1.5">
          <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 font-display font-extrabold shadow-lg">K</span>
          <span className="whitespace-nowrap opacity-0 -translate-x-2 group-hover/side:opacity-100 group-hover/side:translate-x-0 transition-all duration-300">
            <span className="block font-display font-extrabold leading-none">Kero<span className="text-red-500">.</span></span>
            <span className="block text-[11px] text-stone-400 mt-0.5">🍕 {STORE_NAME}</span>
          </span>
        </div>
        <nav className="mt-7 space-y-1.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${isActive(n.href) ? "bg-white text-stone-900 shadow-lg" : "text-stone-300 hover:bg-white/10 hover:translate-x-0.5"}`}>
              <span className={`relative shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${isActive(n.href) ? "bg-stone-100" : "bg-white/5"}`}>
                <NavIcon name={n.icon} />
                {n.href === "/painel/pedidos" && awaiting > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-extrabold inline-flex items-center justify-center shadow">
                    {awaiting}
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap opacity-0 -translate-x-2 group-hover/side:opacity-100 group-hover/side:translate-x-0 transition-all duration-300 flex-1">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-1.5 flex items-center gap-2.5">
          <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-stone-400 font-bold transition-transform duration-300 group-hover/side:rotate-180">»</span>
          <span className="whitespace-nowrap opacity-0 group-hover/side:opacity-100 transition-opacity duration-300 text-[11px] text-stone-500">passe o mouse p/ expandir</span>
        </div>
      </aside>
      {/* topbar mobile */}
      <div className="lg:hidden sticky top-0 z-40 bg-stone-900 text-white">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="font-display font-extrabold">Kero<span className="text-red-500">.</span></span>
          <span className="text-xs text-stone-400 truncate">🍕 {STORE_NAME}</span>
          {awaiting > 0 && (
            <Link href="/painel/pedidos" className="ml-auto shrink-0 min-w-7 h-7 px-2 rounded-full bg-red-600 text-white text-xs font-extrabold inline-flex items-center justify-center">
              {awaiting} novos
            </Link>
          )}
        </div>
        <nav className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`whitespace-nowrap text-[13px] font-bold px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 ${isActive(n.href) ? "bg-white text-stone-900" : "bg-white/10 text-stone-200"}`}>
              <NavIcon name={n.icon} className="w-4 h-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

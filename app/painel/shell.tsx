"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "./_sidebar.css";
import { getAwaitingCount, getStoreName } from "@/lib/painel";
import Topbar from "./topbar";
import RouteTransition from "@/components/route-transition";

// Grupos no mesmo espírito do cardápio-digital (Operação / Gestão)
const GRUPOS = [
  {
    label: "Operação",
    items: [
      { href: "/painel", label: "Hoje", icon: "hoje" },
      { href: "/painel/pedidos", label: "Pedidos", icon: "pedidos" },
      { href: "/painel/pdv", label: "PDV", icon: "pedidos" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/painel/cardapio", label: "Cardápio", icon: "cardapio" },
      { href: "/painel/clientes", label: "Clientes", icon: "pedidos" },
      { href: "/painel/configuracoes", label: "Config", icon: "config" },
      { href: "/painel/relatorios", label: "Relatórios", icon: "hoje" },
    ],
  },
];

const PATHS: Record<string, React.ReactNode> = {
  hoje: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  pedidos: (<><path d="M6 2h12v20l-3-2-2 2-2-2-2 2-2-2-1 1z" /><path d="M9 7h6M9 11h6" /></>),
  cardapio: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /><path d="M9 7h7" /></>),
  config: (<><path d="M4 7h9M19 7h1M4 17h3M13 17h7" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /><path d="M4 12h16" /></>),
};

function NavIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

function IconeTema({ tema }: { tema: string }) {
  return tema === "dark" ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function PainelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [storeName, setStoreName] = useState("…");
  const [awaiting, setAwaiting] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // drawer mobile
  const [tema, setTema] = useState<"light" | "dark">("light");
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getStoreName().then((s) => setStoreName(s.storeName)).catch(() => {});
    getAwaitingCount().then((s) => setAwaiting(s.awaiting)).catch(() => {});
  }, [pathname]);

  // tema: inicializa do localStorage e reflete no <html>
  useEffect(() => {
    const salvo = localStorage.getItem("kero-theme");
    const t = salvo === "dark" ? "dark" : "light";
    setTema(t);
    document.documentElement.dataset.theme = t;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem("kero-theme", tema);
  }, [tema]);

  // drawer fecha no Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (window.innerWidth <= 1024) return;
    hoverTimeout.current = setTimeout(() => setExpanded(true), 120);
  };
  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setExpanded(false);
  };

  const isActive = (href: string) => (href === "/painel" ? pathname === href : pathname.startsWith(href));
  if (pathname.endsWith("/print")) return <>{children}</>; // cupom 80mm: página limpa, sem sidebar

  const collapsed = !expanded;

  return (
    <div className="min-h-screen bg-[var(--bg)] lg:flex lg:items-start">
      {isOpen && <div className="sb-overlay lg:hidden" onClick={() => setIsOpen(false)} />}
      <aside
        className={`sb ${isOpen ? "is-open" : ""} ${collapsed ? "sb--collapsed" : ""}`}
        style={{ width: expanded ? 220 : 56, transition: "width 0.2s cubic-bezier(0.4,0,0.2,1)" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <nav className="sb-nav">
          <div className="sb-header">
            <div className="sb-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.6 1.5 4.9 3.8 6.4V21l3.2-1.8c1 .3 2 .4 3 .4s2-.1 3-.4l3.2 1.8v-4.1c2.3-1.5 3.8-3.8 3.8-6.4C22 5.8 17.5 2 12 2z" />
              </svg>
            </div>
            {expanded && (
              <div className="sb-brand">
                <span className="sb-brand-name">Kero</span>
                <span className="sb-brand-tag">🍕 {storeName}</span>
              </div>
            )}
          </div>
          <div className="sb-groups">
            {GRUPOS.map((grupo) => (
              <div key={grupo.label} className="sb-section">
                {expanded && <span className="sb-section-label">{grupo.label}</span>}
                <ul className="sb-list">
                  {grupo.items.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href}
                        className={`sb-link ${isActive(n.href) ? "sb-link--active" : ""}`}
                        onClick={() => setIsOpen(false)}
                        aria-current={isActive(n.href) ? "page" : undefined}>
                        <span className="sb-icon"><NavIcon name={n.icon} /></span>
                        {expanded && <span className="sb-label">{n.label}</span>}
                        {!expanded && <span className="sb-tooltip">{n.label}</span>}
                        {n.href === "/painel/pedidos" && awaiting > 0 && <span className="sb-badge">{awaiting}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <footer className="sb-footer">
          <span className="sb-avatar" aria-hidden>K</span>
          <div className="sb-user-info">
            <span className="sb-user-name">{storeName}</span>
            <span className="sb-user-role">Lojista</span>
          </div>
          <div className="sb-footer-actions">
            <button type="button" className="sb-theme-btn" aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              onClick={() => setTema(tema === "dark" ? "light" : "dark")}>
              <IconeTema tema={tema} />
            </button>
          </div>
        </footer>
      </aside>
      {/* topbar mobile */}
      <div className="lg:hidden sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <button type="button" aria-label="Abrir menu" onClick={() => setIsOpen(true)}
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border)] text-[var(--muted)] text-lg">☰</button>
          <span className="font-extrabold">Kero<span className="text-[var(--red)]">.</span></span>
          <span className="text-xs text-[var(--muted)] truncate">🍕 {storeName}</span>
          {awaiting > 0 && (
            <Link href="/painel/pedidos" className="ml-auto shrink-0 min-w-7 h-7 px-2 rounded-full bg-[var(--red)] text-white text-xs font-extrabold inline-flex items-center justify-center">
              {awaiting}
            </Link>
          )}
        </div>
        <nav className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2.5">
          {GRUPOS.flatMap((g) => g.items).map((n) => (
            <Link key={n.href} href={n.href}
              className={`whitespace-nowrap text-[13px] font-bold px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 ${isActive(n.href) ? "bg-[var(--pill-active-bg)] text-[var(--pill-active-ink)]" : "bg-[var(--pill-bg)] text-[var(--pill-ink)]"}`}>
              <NavIcon name={n.icon} className="w-4 h-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="hidden lg:block"><Topbar /></div>
        <RouteTransition>{children}</RouteTransition>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoreStatus } from "@/lib/painel";
import { setForceClosed } from "@/lib/painel-actions";

// Título de cada rota (igual ao cardápio-digital: H1 21px/800)
const TITULOS: { match: string; label: string }[] = [
  { match: "/painel/pedidos", label: "Pedidos" },
  { match: "/painel/cardapio", label: "Cardápio" },
  { match: "/painel/configuracoes", label: "Configurações" },
];

function titulo(pathname: string) {
  return TITULOS.find((t) => pathname.startsWith(t.match))?.label ?? "Hoje";
}

export default function Topbar() {
  const pathname = usePathname();
  const [store, setStore] = useState({ name: "Kero", slug: "", closed: false });

  useEffect(() => {
    getStoreStatus().then(setStore).catch(() => {});
  }, [pathname]);

  const toggle = async () => {
    const next = !store.closed;
    setStore((s) => ({ ...s, closed: next }));
    const r = await setForceClosed(next);
    if (!r.ok) setStore((s) => ({ ...s, closed: !next }));
  };

  const primeiraPalavra = store.name.split(" ")[0] || "lojista";

  return (
    <header className="admin-topbar">
      <div className="topbar-info">
        <div className="topbar-title-row">
          <h1 className="topbar-title">{titulo(pathname)}</h1>
          {!store.closed && (
            <span className="live-badge"><span className="live-dot" aria-hidden="true" />ao vivo</span>
          )}
        </div>
        <p className="topbar-subtitle">Olá, {primeiraPalavra}</p>
      </div>
      <div className="topbar-actions">
        <button type="button"
          className={`store-toggle ${store.closed ? "store-toggle--closed" : "store-toggle--open"}`}
          onClick={toggle} aria-pressed={store.closed}>
          <span className="store-dot" aria-hidden="true" />
          {store.closed ? "Fechado" : "Aberto"}
        </button>
        <a className="btn btn--ghost" href={`/${store.slug}`} target="_blank" rel="noreferrer">
          Ver loja
        </a>
      </div>
    </header>
  );
}

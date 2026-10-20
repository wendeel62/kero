"use client";

import { motion } from "framer-motion";
import { Search, Plus, Edit2, Trash2, ChevronUp, ChevronDown, Package, FolderOpen, Layers, Boxes } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ImageUploader from "@/components/ui/image-uploader";
import { addCombo, addComboItem, addAddon, addCategory, addCustomField, addVariation, deleteAddon, deleteCategory, deleteFicha, moveCategory, removeCombo, removeComboItem, removeCustomField, removeVariation, saveFicha, setProductImageUrl, toggleAddon, updateAddon, updateCategory, updateCombo, updateCustomField, updateVariation } from "@/lib/painel-actions";
import { getCardapio as loadCardapio } from "@/lib/painel";
import type { PanelAddon, PanelCategory, PanelCombo, PanelComboItem, PanelCustomField, PanelProduct, PanelProductWithVars, PanelVariation } from "@/lib/painel-utils";
import type { AddonGroupRow } from "@/lib/addon-groups";
import Grupos from "./grupos";
import { parseBRLToCents } from "@/lib/pricing";
import "./cardapio.css";

type Tab = "categorias" | "produtos" | "complementos" | "combos";

interface ProductWithAddons extends PanelProductWithVars {
  categoryName: string;
  addonIds: string[];
}

type SidebarMode =
  | { type: "criar-categoria" }
  | { type: "editar-categoria"; cat: PanelCategory }
  | { type: "criar-produto" }
  | { type: "editar-produto"; product: ProductWithAddons }
  | { type: "criar-complemento" }
  | { type: "editar-complemento"; addon: PanelAddon }
  | { type: "criar-combo" }
  | { type: "editar-combo"; combo: PanelCombo };

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "categorias", label: "Categorias", icon: <FolderOpen size={16} strokeWidth={1.7} /> },
  { id: "produtos", label: "Produtos", icon: <Package size={16} strokeWidth={1.7} /> },
  { id: "complementos", label: "Complementos", icon: <Layers size={16} strokeWidth={1.7} /> },
  { id: "combos", label: "Combos", icon: <Boxes size={16} strokeWidth={1.7} /> },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pluralItens = (n: number) => (n === 1 ? `${n} item` : `${n} itens`);

export default function Cardapio() {
  const [tab, setTab] = useState<Tab>("categorias");
  const [cats, setCats] = useState<PanelCategory[] | null>(null);
  const [addons, setAddons] = useState<PanelAddon[]>([]);
  const [groups, setGroups] = useState<AddonGroupRow[]>([]);
  const [addonIdsByProduct, setAddonIdsByProduct] = useState<Map<string, string[]>>(new Map());
  const [combos, setCombos] = useState<PanelCombo[]>([]);
  const [comboItems, setComboItems] = useState<PanelComboItem[]>([]);
  const [storeId, setStoreId] = useState("");
  const [sidebar, setSidebar] = useState<SidebarMode | null>(null);
  const [filtroCat, setFiltroCat] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [formError, setFormError] = useState("");

  const reload = async () => {
    const d = await loadCardapio();
    setCats(d.categories);
    setAddons(d.addons);
    setGroups(d.groups);
    setAddonIdsByProduct(d.addonIdsByProduct);
    setCombos(d.combos);
    setComboItems(d.comboItems);
    setStoreId(d.storeId);
  };

  useEffect(() => { reload().catch(() => setCats([])); }, []);

  const produtosFiltrados = useMemo(() => {
    const all = (cats ?? []).flatMap((c) =>
      c.products.map((p) => ({
        ...p,
        categoryName: c.name,
        addonIds: addonIdsByProduct.get(p.id) ?? [],
      })),
    );
    return all.filter((p) => {
      const matchCat = filtroCat ? p.categoryName === filtroCat : true;
      const matchBusca = busca ? p.name.toLowerCase().includes(busca.toLowerCase()) : true;
      return matchCat && matchBusca;
    });
  }, [cats, filtroCat, busca, addonIdsByProduct]);

  if (cats === null) {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando cardápio…</p>
      </main>
    );
  }

  const fail = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    if (!r.ok) {
      setFormError(r.error ?? "O banco recusou a operação.");
      await reload();
      return false;
    }
    return true;
  };

  const removeProduct = async (prodId: string, name: string) => {
    if (!confirm(`Excluir "${name}"? (vira active=false, some da vitrine)`)) return;
    setFormError("");
    if (await fail(deleteFicha(prodId))) await reload();
  };

  const removeCat = async (c: PanelCategory) => {
    if (!window.confirm(`Remover a categoria "${c.name}" e seus produtos?`)) return;
    setFormError("");
    if (await fail(deleteCategory(c.id))) await reload();
  };

  const moveCat = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setCats((cs) => {
      const arr = [...(cs ?? [])];
      const from = arr.findIndex((c) => c.id === fromId);
      const to = arr.findIndex((c) => c.id === toId);
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      fail(moveCategory(arr.map((c) => c.id)));
      return arr;
    });
  };

  const flipCatActive = async (c: PanelCategory) => {
    setCats((cs) => (cs ?? []).map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    fail(updateCategory(c.id, { name: c.name, ativo: !c.active, ordem: c.sort_order }));
  };

  const flipAddon = (id: string) => {
    const cur = addons.find((a) => a.id === id)?.active ?? true;
    setAddons((as) => as.map((a) => (a.id === id ? { ...a, active: !cur } : a)));
    fail(toggleAddon(id, !cur));
  };

  const removeAddon = async (id: string, name: string) => {
    if (!confirm(`Excluir o adicional "${name}"?`)) return;
    setFormError("");
    if (await fail(deleteAddon(id))) await reload();
  };

  const flipCombo = (cb: PanelCombo) => {
    setCombos((cs) => cs.map((c) => (c.id === cb.id ? { ...c, active: !c.active } : c)));
    fail(updateCombo(cb.id, { name: cb.name, description: cb.description, price_cents: cb.price_cents, image_url: cb.image_url ?? "", active: !cb.active }));
  };

  const deleteCombo = async (id: string, name: string) => {
    if (!confirm(`Excluir o combo "${name}"?`)) return;
    setFormError("");
    if (await fail(removeCombo(id))) await reload();
  };

  const COUNTS: Record<Tab, number> = {
    categorias: cats.length,
    produtos: cats.reduce((s, c) => s + c.products.length, 0),
    complementos: addons.length,
    combos: combos.length,
  };

  return (
    <motion.main className="admin-content" variants={containerVariants} initial="hidden" animate="visible">
      {formError && (
        <motion.p className="text-sm font-bold text-[var(--red)] bg-[var(--red-soft)] border border-[var(--border)] rounded-2xl px-4 py-3" role="alert" variants={itemVariants}>
          {formError}
        </motion.p>
      )}

      <motion.div className="cfg-layout" variants={itemVariants}>
        <nav className="cfg-subnav" role="tablist" aria-label="Seções do cardápio">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`cfg-subnav-item ${tab === t.id ? "cfg-subnav-item--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
              <span className="cfg-subnav-count" aria-hidden="true">{COUNTS[t.id]}</span>
            </button>
          ))}
        </nav>

        <div className="cfg-panel">
          {tab === "categorias" && (
            <>
              <div className="cfg-panel-head">
                <h2 className="cfg-panel-title">Categorias</h2>
                <p className="cfg-panel-desc">Organize as categorias e a ordem de exibição no cardápio.</p>
              </div>
              <motion.div className="menu-cats" variants={containerVariants}>
                {cats.length === 0 ? (
                  <div className="menu-empty"><FolderOpen size={20} strokeWidth={1.7} /> Nenhuma categoria cadastrada.</div>
                ) : (
                  cats.map((c) => (
                    <motion.div key={c.id} variants={itemVariants} className={`menu-cat-card ${!c.active ? "menu-cat-inactive" : ""}`}>
                      <div className="menu-cat-row">
                        <span className="menu-cat-nome">{c.name}</span>
                        {!c.active && <span className="badge badge--warning">Inativa</span>}
                        <span className="head-pill">{pluralItens(c.products.length)}</span>
                      </div>
                      <div className="menu-cat-actions">
                        <button className="icon-btn" aria-label="Mover para cima"
                          onClick={() => { const i = cats.findIndex((x) => x.id === c.id); if (i > 0) moveCat(c.id, cats[i - 1].id); }}>
                          <ChevronUp size={16} strokeWidth={1.7} />
                        </button>
                        <button className="icon-btn" aria-label="Mover para baixo"
                          onClick={() => { const i = cats.findIndex((x) => x.id === c.id); if (i < cats.length - 1) moveCat(c.id, cats[i + 1].id); }}>
                          <ChevronDown size={16} strokeWidth={1.7} />
                        </button>
                        <button className="icon-btn" aria-label="Editar" onClick={() => setSidebar({ type: "editar-categoria", cat: c })}>
                          <Edit2 size={16} strokeWidth={1.7} />
                        </button>
                        <button className="btn btn--ghost" onClick={() => flipCatActive(c)}>
                          {c.active ? "Desativar" : "Ativar"}
                        </button>
                        <button className="icon-btn icon-btn--danger" aria-label="Remover" onClick={() => removeCat(c)}>
                          <Trash2 size={16} strokeWidth={1.7} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
              <div className="cfg-save-row">
                <button className="btn btn--primary" onClick={() => setSidebar({ type: "criar-categoria" })}>
                  <Plus size={14} strokeWidth={1.7} /> Nova Categoria
                </button>
              </div>
            </>
          )}

          {tab === "produtos" && (
            <>
              <div className="cfg-panel-head">
                <h2 className="cfg-panel-title">Produtos</h2>
                <p className="cfg-panel-desc">Gerencie nome, preço, foto e disponibilidade.</p>
              </div>
              <motion.div className="menu-search-row" variants={itemVariants}>
                <div className="menu-search-wrap">
                  <Search size={16} strokeWidth={1.7} />
                  <input type="text" className="menu-search-input" placeholder="Buscar por nome..."
                    value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
              </motion.div>
              <motion.div className="menu-chips" variants={itemVariants}>
                <button className={`menu-chip ${filtroCat === null ? "menu-chip--active" : ""}`} onClick={() => setFiltroCat(null)}>Todos</button>
                {cats.map((c) => (
                  <button key={c.id} className={`menu-chip ${filtroCat === c.name ? "menu-chip--active" : ""}`} onClick={() => setFiltroCat(c.name)}>{c.name}</button>
                ))}
              </motion.div>
              <motion.div className="menu-product-grid" variants={containerVariants}>
                {produtosFiltrados.length === 0 ? (
                  <div className="menu-empty"><Package size={20} strokeWidth={1.7} /> Nenhum produto encontrado.</div>
                ) : (
                  produtosFiltrados.map((p) => (
                    <motion.div key={p.id} variants={itemVariants}>
                      <div className="menu-product-card"
                        onClick={() => setSidebar({ type: "editar-produto", product: p })}>
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt={p.name} className="menu-product-thumb" />
                        ) : (
                          <div className="menu-product-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                            <Package size={24} strokeWidth={1.7} />
                          </div>
                        )}
                        <div className="menu-product-info">
                          <span className="menu-product-nome">{p.name}</span>
                          <span className="menu-product-preco">{brl(p.price_cents)}</span>
                        </div>
                        <div className="menu-product-toggles">
                          <span className={`badge ${p.active ? "badge--success" : ""}`} style={!p.active ? { background: "var(--pill-bg)", color: "var(--pill-ink)" } : {}}>{p.active ? "Ativo" : "Inativo"}</span>
                          <span className="badge">{p.categoryName}</span>
                        </div>
                        <div className="menu-product-actions">
                          <button className="icon-btn" aria-label="Editar" onClick={(e) => { e.stopPropagation(); setSidebar({ type: "editar-produto", product: p }); }}>
                            <Edit2 size={16} strokeWidth={1.7} />
                          </button>
                          <button className="icon-btn icon-btn--danger" aria-label="Remover" onClick={(e) => { e.stopPropagation(); removeProduct(p.id, p.name); }}>
                            <Trash2 size={16} strokeWidth={1.7} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
              <div className="cfg-save-row">
                <button className="btn btn--primary" onClick={() => setSidebar({ type: "criar-produto" })}>
                  <Plus size={14} strokeWidth={1.7} /> Novo Produto
                </button>
              </div>
            </>
          )}

          {tab === "complementos" && (
            <>
              <div className="cfg-panel-head">
                <h2 className="cfg-panel-title">Complementos</h2>
                <p className="cfg-panel-desc">Adicionais globais válidos para todo o cardápio.</p>
              </div>

              {/* grupos de opção (migration 012) */}
              <div className="cfg-panel-head" style={{ marginTop: 6 }}>
                <h3 className="cfg-panel-title">Grupos de opção</h3>
                <p className="cfg-panel-desc">
                  Um grupo junta adicionais com uma regra: obrigatório e máximo de escolhas.
                </p>
              </div>
              <Grupos groups={groups} addons={addons} onChange={reload} />

              <div className="menu-comp-group" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {addons.length === 0 ? (
                  <div className="menu-empty"><Layers size={20} strokeWidth={1.7} /> Nenhum complemento cadastrado.</div>
                ) : (
                  addons.map((a) => (
                    <div key={a.id} className="menu-comp-option" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => flipAddon(a.id)} role="switch" aria-checked={a.active}
                          aria-label={`${a.active ? "Desativar" : "Ativar"} ${a.name}`}
                          className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${a.active ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] shadow transition-all ${a.active ? "left-[18px]" : "left-0.5"}`} />
                        </button>
                        <span className="menu-comp-option-nome">{a.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="menu-comp-option-preco">+{brl(a.price_cents)}</span>
                        <button className="icon-btn" aria-label="Editar" onClick={() => setSidebar({ type: "editar-complemento", addon: a })}>
                          <Edit2 size={14} strokeWidth={1.7} />
                        </button>
                        <button className="icon-btn icon-btn--danger" aria-label="Remover" onClick={() => removeAddon(a.id, a.name)}>
                          <Trash2 size={14} strokeWidth={1.7} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="cfg-save-row">
                <button className="btn btn--primary" onClick={() => setSidebar({ type: "criar-complemento" })}>
                  <Plus size={14} strokeWidth={1.7} /> Novo Complemento
                </button>
              </div>
            </>
          )}

          {tab === "combos" && (
            <>
              <div className="cfg-panel-head">
                <h2 className="cfg-panel-title">Combos</h2>
                <p className="cfg-panel-desc">Agrupe produtos em um combo com preço único.</p>
              </div>
              <div className="menu-comp-group" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {combos.length === 0 ? (
                  <div className="menu-empty"><Boxes size={20} strokeWidth={1.7} /> Nenhum combo cadastrado.</div>
                ) : (
                  combos.map((cb) => (
                    <div key={cb.id} className="menu-comp-option" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => flipCombo(cb)} role="switch" aria-checked={cb.active}
                          aria-label={`${cb.active ? "Desativar" : "Ativar"} ${cb.name}`}
                          className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${cb.active ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] shadow transition-all ${cb.active ? "left-[18px]" : "left-0.5"}`} />
                        </button>
                        <span className="menu-comp-option-nome">{cb.name}</span>
                        <span className={`badge ${cb.active ? "badge--success" : ""}`} style={!cb.active ? { background: "var(--pill-bg)", color: "var(--pill-ink)" } : {}}>{cb.active ? "Ativo" : "Inativo"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="menu-comp-option-preco">{brl(cb.price_cents)}</span>
                        <button className="icon-btn" aria-label="Editar" onClick={() => setSidebar({ type: "editar-combo", combo: cb })}>
                          <Edit2 size={14} strokeWidth={1.7} />
                        </button>
                        <button className="icon-btn icon-btn--danger" aria-label="Remover" onClick={() => deleteCombo(cb.id, cb.name)}>
                          <Trash2 size={14} strokeWidth={1.7} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="cfg-save-row">
                <button className="btn btn--primary" onClick={() => setSidebar({ type: "criar-combo" })}>
                  <Plus size={14} strokeWidth={1.7} /> Novo Combo
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {sidebar && (
        <Sidebar
          mode={sidebar}
          categories={cats}
          addons={addons}
          comboItems={comboItems}
          storeId={storeId}
          onClose={() => setSidebar(null)}
          onSaved={reload}
        />
      )}
    </motion.main>
  );
}

function Sidebar({
  mode,
  categories,
  addons,
  comboItems,
  storeId,
  onClose,
  onSaved,
}: {
  mode: SidebarMode;
  categories: PanelCategory[];
  addons: PanelAddon[];
  comboItems: PanelComboItem[];
  storeId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [salvando, setSalvando] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const titulo =
    mode.type === "criar-categoria" ? "Nova Categoria" :
    mode.type === "editar-categoria" ? "Editar Categoria" :
    mode.type === "criar-produto" ? "Novo Produto" :
    mode.type === "editar-produto" ? "Editar Produto" :
    mode.type === "criar-complemento" ? "Novo Complemento" :
    mode.type === "editar-complemento" ? "Editar Complemento" :
    mode.type === "criar-combo" ? "Novo Combo" :
    "Editar Combo";

  return (
    <div className="menu-sidebar-overlay" ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="menu-sidebar">
        <div className="menu-sidebar-back">
          <button type="button" onClick={onClose}>← Voltar</button>
          <h3 className="menu-sidebar-title">{titulo}</h3>
        </div>
        <div className="menu-sidebar-body">
          {(mode.type === "criar-categoria" || mode.type === "editar-categoria") && (
            <CategoriaSidebar mode={mode} salvando={salvando} setSalvando={setSalvando} onClose={onClose} onSaved={onSaved} />
          )}
          {(mode.type === "criar-produto" || mode.type === "editar-produto") && (
            <ProdutoSidebar mode={mode} categories={categories} addons={addons} storeId={storeId} salvando={salvando} setSalvando={setSalvando} onClose={onClose} onSaved={onSaved} />
          )}
          {(mode.type === "criar-complemento" || mode.type === "editar-complemento") && (
            <ComplementoSidebar mode={mode} salvando={salvando} setSalvando={setSalvando} onClose={onClose} onSaved={onSaved} />
          )}
          {(mode.type === "criar-combo" || mode.type === "editar-combo") && (
            <ComboSidebar mode={mode} categories={categories} comboItems={comboItems} storeId={storeId} salvando={salvando} setSalvando={setSalvando} onClose={onClose} onSaved={onSaved} />
          )}
        </div>
      </div>
    </div>
  );
}

function CategoriaSidebar({
  mode,
  salvando,
  setSalvando,
  onClose,
  onSaved,
}: {
  mode: Extract<SidebarMode, { type: "criar-categoria" } | { type: "editar-categoria" }>;
  salvando: boolean;
  setSalvando: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [nome, setNome] = useState(mode.type === "editar-categoria" ? mode.cat.name : "");
  const [ordem, setOrdem] = useState(mode.type === "editar-categoria" ? String(mode.cat.products.length) : "0");
  const [ativo, setAtivo] = useState(mode.type === "editar-categoria" ? mode.cat.active : true);
  const [erro, setErro] = useState("");

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2 || salvando) {
      setErro("Nome com pelo menos 2 letras.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      if (mode.type === "editar-categoria") {
        const r = await updateCategory(mode.cat.id, { name: nome.trim(), ativo, ordem: parseInt(ordem) || 0 });
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
      } else {
        const r = await addCategory(nome.trim(), parseInt(ordem) || 0);
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
      }
      await onSaved();
      onClose();
    } catch {
      setErro("erro interno");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="menu-field">
        <label className="menu-label">Nome *</label>
        <input className="menu-input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus maxLength={40} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Ordem</label>
        <input className="menu-input" type="number" min={0} value={ordem} onChange={(e) => setOrdem(e.target.value)} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Status</label>
        <select className="menu-select" value={ativo ? "1" : "0"} onChange={(e) => setAtivo(e.target.value === "1")}>
          <option value="1">Ativa</option>
          <option value="0">Inativa</option>
        </select>
      </div>
      {erro && <p className="text-[13px] text-[var(--red)] m-0">Erro: {erro}</p>}
      <div className="menu-sidebar-footer">
        <button type="button" className="btn btn--ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn--primary flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}


function ProdutoSidebar({
  mode,
  categories,
  addons,
  storeId,
  salvando,
  setSalvando,
  onClose,
  onSaved,
}: {
  mode: Extract<SidebarMode, { type: "criar-produto" } | { type: "editar-produto" }>;
  categories: PanelCategory[];
  addons: PanelAddon[];
  storeId: string;
  salvando: boolean;
  setSalvando: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const edit = mode.type === "editar-produto" ? mode.product : null;
  const [nome, setNome] = useState(edit?.name ?? "");
  const [descricao, setDescricao] = useState(edit?.description ?? "");
  const [preco, setPreco] = useState(edit ? (edit.price_cents / 100).toFixed(2).replace(".", ",") : "");
  const [catId, setCatId] = useState(edit?.category_id ?? categories[0]?.id ?? "");
  const [ordem, setOrdem] = useState(edit ? String(edit.sort_order) : "0");
  const [ativo, setAtivo] = useState(edit?.active ?? true);
  const [checked, setChecked] = useState<Set<string>>(new Set(edit?.addonIds ?? []));
  const [imagem, setImagem] = useState(edit?.image_url ?? null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [variacoes, setVariacoes] = useState<{ id: string; name: string; priceBrl: string }[]>(
    (edit?.variations ?? []).map((v) => ({ id: v.id, name: v.name, priceBrl: (v.price_cents / 100).toFixed(2).replace(".", ",") }))
  );
  const [campos, setCampos] = useState<{ id: string; label: string; required: boolean; maxLength: string }[]>(
    (edit?.customFields ?? []).map((f) => ({ id: f.id, label: f.label, required: f.required, maxLength: String(f.max_length) }))
  );
  const [erro, setErro] = useState("");

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseBRLToCents(preco);
    if (nome.trim().length < 2 || !Number.isInteger(cents) || cents < 0 || salvando) {
      setErro("Nome ≥2 letras e preço no formato 49,90.");
      return;
    }
    if (!catId) { setErro("Escolha a categoria."); return; }
    setSalvando(true);
    setErro("");
    try {
      let id = edit?.id ?? null;
      if (blob) {
        const r = await saveFicha({
          id, name: nome.trim(), description: descricao.trim(), category_id: catId,
          price_cents: cents, sort_order: parseInt(ordem) || 0, active: ativo,
          addonIds: Array.from(checked),
        });
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
        id = r.id ?? id;
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const path = `products/${storeId}/${id}.webp`;
        const { error: upErr } = await supabase.storage.from("store-assets").upload(path, blob, { upsert: true, contentType: "image/webp" });
        if (upErr) { setErro("Falha no upload da imagem."); return; }
        const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(path);
        await setProductImageUrl(id!, pub.publicUrl);
        setBlob(null);
      } else {
        const r = await saveFicha({
          id, name: nome.trim(), description: descricao.trim(), category_id: catId,
          price_cents: cents, sort_order: parseInt(ordem) || 0, active: ativo,
          addonIds: Array.from(checked),
        });
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
      }
      for (const v of variacoes) {
        const cents = parseBRLToCents(v.priceBrl);
        if (!v.name.trim() || !Number.isInteger(cents) || cents < 0) {
          setErro("Variação: nome e preço são obrigatórios.");
          return;
        }
        if (v.id.startsWith("new-")) {
          const r = await addVariation(id!, v.name.trim(), cents);
          if (!r.ok) { setErro(r.error ?? "erro"); return; }
        } else {
          const orig = edit?.variations.find((x) => x.id === v.id);
          if (orig && (orig.name !== v.name.trim() || orig.price_cents !== cents)) {
            const r = await updateVariation(v.id, { name: v.name.trim(), price_cents: cents, active: true });
            if (!r.ok) { setErro(r.error ?? "erro"); return; }
          }
        }
      }
      for (const f of campos) {
        const maxLen = parseInt(f.maxLength);
        if (!f.label.trim() || !Number.isInteger(maxLen) || maxLen < 1) {
          setErro("Campo: label e máximo de caracteres são obrigatórios.");
          return;
        }
        if (f.id.startsWith("new-")) {
          const r = await addCustomField(id!, f.label.trim(), f.required, maxLen);
          if (!r.ok) { setErro(r.error ?? "erro"); return; }
        } else {
          const orig = edit?.customFields.find((x) => x.id === f.id);
          if (orig && (orig.label !== f.label.trim() || orig.required !== f.required || orig.max_length !== maxLen)) {
            const r = await updateCustomField(f.id, { label: f.label.trim(), required: f.required, max_length: maxLen });
            if (!r.ok) { setErro(r.error ?? "erro"); return; }
          }
        }
      }
      await onSaved();
      onClose();
    } catch {
      setErro("erro interno");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="menu-field">
        <label className="menu-label">Foto</label>
        <div className="menu-image-upload" style={{ padding: 12 }}>
          <ImageUploader
            currentUrl={imagem}
            onBlob={(b, previewUrl) => { setBlob(b); setImagem(previewUrl); }}
            onError={(msg) => setErro(msg)}
          />
        </div>
      </div>
      <div className="menu-field">
        <label className="menu-label">Nome *</label>
        <input className="menu-input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus maxLength={60} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Descrição</label>
        <textarea className="menu-textarea" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Preço *</label>
        <input className="menu-input" inputMode="decimal" placeholder="49,90" value={preco} onChange={(e) => setPreco(e.target.value)} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Categoria</label>
        <select className="menu-select" value={catId} onChange={(e) => setCatId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="menu-field">
        <label className="menu-label">Ordem</label>
        <input className="menu-input" type="number" min={0} value={ordem} onChange={(e) => setOrdem(e.target.value)} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Status</label>
        <select className="menu-select" value={ativo ? "1" : "0"} onChange={(e) => setAtivo(e.target.value === "1")}>
          <option value="1">Ativo</option>
          <option value="0">Inativo</option>
        </select>
      </div>
      {addons.length > 0 && (
        <div className="menu-field">
          <label className="menu-label">Complementos</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {addons.map((a) => (
              <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={checked.has(a.id)}
                  onChange={(e) => {
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(a.id); else next.delete(a.id);
                      return next;
                    });
                  }} />
                {a.name} <span style={{ color: "var(--muted)" }}>+{brl(a.price_cents)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="menu-field">
        <label className="menu-label">Variações</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {variacoes.map((v, i) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                className="menu-input" style={{ flex: 1 }} placeholder="Nome (ex: P, M, G)"
                value={v.name}
                onChange={(e) => setVariacoes((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className="menu-input" style={{ width: 90 }} placeholder="0,00" inputMode="decimal"
                value={v.priceBrl}
                onChange={(e) => setVariacoes((prev) => prev.map((x, j) => (j === i ? { ...x, priceBrl: e.target.value } : x)))}
              />
              <button
                type="button" className="icon-btn icon-btn--danger" aria-label="Remover variação"
                onClick={async () => {
                  if (!v.id.startsWith("new-")) {
                    const r = await removeVariation(v.id);
                    if (!r.ok) { setErro(r.error ?? "erro"); return; }
                  }
                  setVariacoes((prev) => prev.filter((_, j) => j !== i));
                }}
              >
                <Trash2 size={14} strokeWidth={1.7} />
              </button>
            </div>
          ))}
          <button
            type="button" className="btn btn--ghost"
            onClick={() => setVariacoes((prev) => [...prev, { id: `new-${Date.now()}`, name: "", priceBrl: "" }])}
          >
            <Plus size={14} strokeWidth={1.7} /> Adicionar variação
          </button>
        </div>
      </div>
      <div className="menu-field">
        <label className="menu-label">Campos de personalização</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {campos.map((f, i) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                className="menu-input" style={{ flex: 1 }} placeholder="Label (ex: Observações)"
                value={f.label}
                onChange={(e) => setCampos((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <input
                className="menu-input" style={{ width: 70 }} placeholder="Máx." type="number" min={1}
                value={f.maxLength}
                onChange={(e) => setCampos((prev) => prev.map((x, j) => (j === i ? { ...x, maxLength: e.target.value } : x)))}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => setCampos((prev) => prev.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
                />
                Obrig.
              </label>
              <button
                type="button" className="icon-btn icon-btn--danger" aria-label="Remover campo"
                onClick={async () => {
                  if (!f.id.startsWith("new-")) {
                    const r = await removeCustomField(f.id);
                    if (!r.ok) { setErro(r.error ?? "erro"); return; }
                  }
                  setCampos((prev) => prev.filter((_, j) => j !== i));
                }}
              >
                <Trash2 size={14} strokeWidth={1.7} />
              </button>
            </div>
          ))}
          <button
            type="button" className="btn btn--ghost"
            onClick={() => setCampos((prev) => [...prev, { id: `new-${Date.now()}`, label: "", required: false, maxLength: "50" }])}
          >
            <Plus size={14} strokeWidth={1.7} /> Adicionar campo
          </button>
        </div>
      </div>
      {erro && <p className="text-[13px] text-[var(--red)] m-0">Erro: {erro}</p>}
      <div className="menu-sidebar-footer">
        <button type="button" className="btn btn--ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn--primary flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function ComplementoSidebar({
  mode,
  salvando,
  setSalvando,
  onClose,
  onSaved,
}: {
  mode: Extract<SidebarMode, { type: "criar-complemento" } | { type: "editar-complemento" }>;
  salvando: boolean;
  setSalvando: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const edit = mode.type === "editar-complemento" ? mode.addon : null;
  const [nome, setNome] = useState(edit?.name ?? "");
  const [preco, setPreco] = useState(edit ? (edit.price_cents / 100).toFixed(2).replace(".", ",") : "");
  const [ativo, setAtivo] = useState(edit?.active ?? true);
  const [isRemoval, setIsRemoval] = useState(edit?.is_removal ?? false);
  const [isSeparate, setIsSeparate] = useState(edit?.is_separate ?? false);
  const [erro, setErro] = useState("");

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseBRLToCents(preco);
    if (nome.trim().length < 2 || !Number.isInteger(cents) || cents < 0 || salvando) {
      setErro("Nome ≥2 letras e preço no formato 49,90.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      if (edit) {
        const r = await updateAddon(edit.id, { name: nome.trim(), price_cents: cents, active: ativo, is_removal: isRemoval, is_separate: isSeparate });
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
      } else {
        const r = await addAddon(nome.trim(), cents, isRemoval, isSeparate);
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
      }
      await onSaved();
      onClose();
    } catch {
      setErro("erro interno");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="menu-field">
        <label className="menu-label">Nome *</label>
        <input className="menu-input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus maxLength={40} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Preço *</label>
        <input className="menu-input" inputMode="decimal" placeholder="4,90" value={preco} onChange={(e) => setPreco(e.target.value)} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Status</label>
        <select className="menu-select" value={ativo ? "1" : "0"} onChange={(e) => setAtivo(e.target.value === "1")}>
          <option value="1">Ativo</option>
          <option value="0">Inativo</option>
        </select>
      </div>
      <div className="menu-field">
        <label className="menu-label">Tipo</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={isRemoval} onChange={(e) => setIsRemoval(e.target.checked)} />
            Remoção (cliente remove ingrediente)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={isSeparate} onChange={(e) => setIsSeparate(e.target.checked)} />
            Separado (cobra à parte)
          </label>
        </div>
      </div>
      {erro && <p className="text-[13px] text-[var(--red)] m-0">Erro: {erro}</p>}
      <div className="menu-sidebar-footer">
        <button type="button" className="btn btn--ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn--primary flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function ComboSidebar({
  mode,
  categories,
  comboItems,
  storeId,
  salvando,
  setSalvando,
  onClose,
  onSaved,
}: {
  mode: Extract<SidebarMode, { type: "criar-combo" } | { type: "editar-combo" }>;
  categories: PanelCategory[];
  comboItems: PanelComboItem[];
  storeId: string;
  salvando: boolean;
  setSalvando: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const edit = mode.type === "editar-combo" ? mode.combo : null;
  const [nome, setNome] = useState(edit?.name ?? "");
  const [descricao, setDescricao] = useState(edit?.description ?? "");
  const [preco, setPreco] = useState(edit ? (edit.price_cents / 100).toFixed(2).replace(".", ",") : "");
  const [ativo, setAtivo] = useState(edit?.active ?? true);
  const [imagem, setImagem] = useState<string | null>(edit?.image_url ?? null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [erro, setErro] = useState("");
  const [novoProduto, setNovoProduto] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");
  const [novoOpcional, setNovoOpcional] = useState(false);

  const produtos = useMemo(() => categories.flatMap((c) => c.products), [categories]);
  const itens = useMemo(
    () => (edit ? comboItems.filter((ci) => ci.combo_id === edit.id) : []),
    [comboItems, edit],
  );
  const produtosDisponiveis = produtos.filter((p) => !itens.some((i) => i.product_id === p.id));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseBRLToCents(preco);
    if (nome.trim().length < 1 || !Number.isInteger(cents) || cents < 0 || salvando) {
      setErro("Nome ≥1 letra e preço no formato 49,90.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      if (blob) {
        // shortcut: foto sobe depois do insert/update (id novo ainda não existe);
        // se o upload falhar, o combo fica sem foto — mesmo fluxo do ProdutoSidebar.
        const r = edit
          ? await updateCombo(edit.id, { name: nome.trim(), description: descricao.trim(), price_cents: cents, image_url: "", active: ativo })
          : await addCombo({ name: nome.trim(), description: descricao.trim(), price_cents: cents, image_url: "" });
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
        const id = edit?.id ?? (r as { id?: string }).id!;
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const path = `combos/${storeId}/${id}.webp`;
        const { error: upErr } = await supabase.storage.from("store-assets").upload(path, blob, { upsert: true, contentType: "image/webp" });
        if (upErr) { setErro("Falha no upload da imagem."); return; }
        const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(path);
        const r2 = await updateCombo(id, { name: nome.trim(), description: descricao.trim(), price_cents: cents, image_url: pub.publicUrl ?? "", active: ativo });
        if (!r2.ok) { setErro(r2.error ?? "erro"); return; }
        setBlob(null);
      } else if (edit) {
        const r = await updateCombo(edit.id, { name: nome.trim(), description: descricao.trim(), price_cents: cents, image_url: imagem ?? "", active: ativo });
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
      } else {
        const r = await addCombo({ name: nome.trim(), description: descricao.trim(), price_cents: cents, image_url: imagem ?? "" });
        if (!r.ok) { setErro(r.error ?? "erro"); return; }
      }
      await onSaved();
      onClose();
    } catch {
      setErro("erro interno");
    } finally {
      setSalvando(false);
    }
  };

  const salvarItem = async () => {
    if (!edit || !novoProduto || salvando) return;
    const r = await addComboItem(edit.id, novoProduto, parseInt(novaQtd) || 1, novoOpcional);
    if (!r.ok) { setErro(r.error ?? "erro ao adicionar item"); return; }
    setNovoProduto(""); setNovaQtd("1"); setNovoOpcional(false);
    await onSaved();
  };

  const removerItem = async (id: string) => {
    if (salvando) return;
    const r = await removeComboItem(id);
    if (!r.ok) { setErro(r.error ?? "erro ao remover item"); return; }
    await onSaved();
  };

  return (
    <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="menu-field">
        <label className="menu-label">Foto</label>
        <div className="menu-image-upload" style={{ padding: 12 }}>
          <ImageUploader
            currentUrl={imagem}
            onBlob={(b, previewUrl) => { setBlob(b); setImagem(previewUrl); }}
            onError={(msg) => setErro(msg)}
          />
        </div>
      </div>
      <div className="menu-field">
        <label className="menu-label">Nome *</label>
        <input className="menu-input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus maxLength={40} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Descrição</label>
        <textarea className="menu-textarea" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Preço *</label>
        <input className="menu-input" inputMode="decimal" placeholder="79,90" value={preco} onChange={(e) => setPreco(e.target.value)} />
      </div>
      <div className="menu-field">
        <label className="menu-label">Status</label>
        <select className="menu-select" value={ativo ? "1" : "0"} onChange={(e) => setAtivo(e.target.value === "1")}>
          <option value="1">Ativo</option>
          <option value="0">Inativo</option>
        </select>
      </div>
      {edit && (
        <div className="menu-field">
          <label className="menu-label">Itens do combo</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {itens.length === 0 && <p className="text-[13px] text-[var(--muted)] m-0">Nenhum item ainda.</p>}
            {itens.map((i) => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <span>
                  {i.productName} <span style={{ color: "var(--muted)" }}>×{i.qty}</span>
                  {i.optional && <span className="badge" style={{ marginLeft: 4 }}>opcional</span>}
                </span>
                <button type="button" className="icon-btn icon-btn--danger" aria-label={`Remover ${i.productName}`} onClick={() => removerItem(i.id)}>
                  <Trash2 size={14} strokeWidth={1.7} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 6, flexWrap: "wrap" }}>
            <select className="menu-select" style={{ flex: 1, minWidth: 120 }} value={novoProduto} onChange={(e) => setNovoProduto(e.target.value)}>
              <option value="">Produto…</option>
              {produtosDisponiveis.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input className="menu-input" style={{ width: 60 }} type="number" min={1} value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} aria-label="Quantidade" />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
              <input type="checkbox" checked={novoOpcional} onChange={(e) => setNovoOpcional(e.target.checked)} />
              Opcional
            </label>
            <button type="button" className="btn btn--ghost" onClick={salvarItem} disabled={!novoProduto}>Adicionar</button>
          </div>
        </div>
      )}
      {erro && <p className="text-[13px] text-[var(--red)] m-0">Erro: {erro}</p>}
      <div className="menu-sidebar-footer">
        <button type="button" className="btn btn--ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn--primary flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

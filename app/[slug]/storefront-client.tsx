"use client";

import { useEffect, useState } from "react";

import type { SfMenuData, SfProduct } from "@/lib/storefront";
import { calcularTotal, editarItem, formatarMoeda, montarItem, type SfCarrinhoItem, type SfEscolha } from "@/lib/storefront-cart";
import Checkout from "./checkout";
import CookieBanner from "./cookie-banner";
import Pedido from "./pedido";

// Vitrine pública — transcrição fiel de cardapio-digital App.tsx.
// Roteamento por estado (sem rotas): cardápio → checkout → pedido.
export default function StorefrontClient({ menu, isOpen, neighborhoods, storeId }: { menu: SfMenuData; isOpen: boolean; neighborhoods: Array<{ id: string; name: string; fee_cents: number }>; storeId: string }) {
  const [erro] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>(menu.business.categories[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [produtoAberto, setProdutoAberto] = useState<SfProduct | null>(null);
  const [escolhas, setEscolhas] = useState<SfEscolha>({});
  const [qtd, setQtd] = useState(1);
  const [carrinho, setCarrinho] = useState<SfCarrinhoItem[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [edicaoIndex, setEdicaoIndex] = useState<number | null>(null);
  const [emCheckout, setEmCheckout] = useState(false);
  const [emPedido, setEmPedido] = useState<string | null>(null);

  // Deep-link ?pedido=<token> abre o acompanhamento direto.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pedidoParam = params.get("pedido");
    if (pedidoParam) {
      setEmPedido(pedidoParam);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (erro) return <main style={{ padding: "2rem", textAlign: "center" }}>Erro ao carregar cardápio: {erro}</main>;

  if (emCheckout) {
    return (
      <div className="sf">
        <main>
          <Checkout
            slug={menu.business.slug}
            storeId={storeId}
            carrinho={carrinho}
            menu={menu}
            neighborhoods={neighborhoods}
            aoConcluir={(token) => {
              setEmCheckout(false);
              setEmPedido(token);
            }}
            aoVoltar={() => setEmCheckout(false)}
          />
        </main>
        <CookieBanner />
      </div>
    );
  }

  const qtdCarrinho = carrinho.reduce((s, i) => s + i.qtd, 0);
  const totalCarrinho = carrinho.reduce((s, i) => s + i.total, 0);

  function abrirProduto(p: SfProduct): void;
  function abrirProduto(itemParaEditar: { produto: SfProduct; escolhas: SfEscolha; qtd: number; index: number }): void;
  function abrirProduto(arg: SfProduct | { produto: SfProduct; escolhas: SfEscolha; qtd: number; index: number }) {
    if ("produto" in arg) {
      setProdutoAberto(arg.produto);
      setEscolhas(arg.escolhas);
      setQtd(arg.qtd);
      setEdicaoIndex(arg.index);
    } else {
      setProdutoAberto(arg);
      setEscolhas({});
      setQtd(1);
      setEdicaoIndex(null);
    }
  }

  function abrirEdicao(index: number) {
    const item = carrinho[index];
    const produto = menu.business.categories.flatMap((c) => c.products).find((p) => p.id === item.productId);
    if (!produto) return;
    const rec: SfEscolha = {};
    for (const o of item.opcoes) {
      rec[o.groupId] = [...(rec[o.groupId] ?? []), o.optionId];
    }
    abrirProduto({ produto, escolhas: rec, qtd: item.qtd, index });
  }

  function alternarEscolha(groupId: string, optionId: string) {
    setEscolhas((prev) => {
      const atual = prev[groupId] ?? [];
      const grupo = produtoAberto?.optionGroups.find((g) => g.id === groupId);
      const max = grupo?.maxEscolhas ?? 1;
      const novo = atual.includes(optionId)
        ? atual.filter((id) => id !== optionId)
        : atual.length >= max && max > 0
          ? [optionId]
          : [...atual, optionId];
      return { ...prev, [groupId]: novo };
    });
  }

  function validarEscolhas(): boolean {
    if (!produtoAberto) return true;
    for (const g of produtoAberto.optionGroups ?? []) {
      if (g.obrigatorio && (escolhas[g.id] ?? []).length === 0) return false;
    }
    return true;
  }

  function descricaoEscolha(g: { obrigatorio: boolean; maxEscolhas: number | null; options: { id: string }[] }): string {
    const n = g.maxEscolhas && g.maxEscolhas > 0 ? g.maxEscolhas : g.options.length;
    const plural = n === 1 ? "1 opção" : `${n} opções`;
    return g.obrigatorio ? `Escolha ${plural}.` : `Escolha até ${plural}.`;
  }

  function adicionarAoCarrinho() {
    if (!produtoAberto) return;
    if (!validarEscolhas()) return;
    const item = montarItem(produtoAberto, escolhas, qtd);
    setCarrinho((prev) => (edicaoIndex !== null ? editarItem(prev, edicaoIndex, item) : [...prev, item]));
    setEdicaoIndex(null);
    setProdutoAberto(null);
  }

  function alterarQtd(index: number, delta: number) {
    setCarrinho((prev) =>
      prev
        .map((item, i) => (i === index ? { ...item, qtd: item.qtd + delta, total: item.precoUnit * (item.qtd + delta) } : item))
        .filter((item) => item.qtd > 0),
    );
  }

  function irParaCategoria(id: string) {
    setCategoriaAtiva(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const termoBusca = busca.trim().toLowerCase();
  const categoriasVisiveis = menu.business.categories
    .map((c) => ({
      ...c,
      products: termoBusca
        ? c.products.filter((p) => p.nome.toLowerCase().includes(termoBusca) || (p.descricao ?? "").toLowerCase().includes(termoBusca))
        : c.products,
    }))
    .filter((c) => c.products.length > 0);

  const inicialNome = menu.business.nome.trim().charAt(0).toUpperCase() || "L";

  return (
    <div className="sf">
      <main className="ifood-shell">
        <div className="ifood-cover" aria-hidden="true" />

        <header className="ifood-store">
          <div className="ifood-store-row">
            {menu.business.logo_url ? (
              <img src={menu.business.logo_url} alt={menu.business.nome} className="ifood-logo" />
            ) : (
              <span className="ifood-logo ifood-logo-fallback" aria-hidden="true">
                {inicialNome}
              </span>
            )}
            <h1 className="ifood-store-name">{menu.business.nome}</h1>
            {isOpen ? <span className="ifood-status open">● Aberto</span> : <span className="ifood-status closed">● Fechado</span>}
          </div>
          {!isOpen && <p className="ifood-meta">Fechado no momento — o checkout está indisponível</p>}

          <div className="ifood-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input type="search" placeholder="Buscar no cardápio" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar no cardápio" />
          </div>
        </header>

        <nav className="catbar" aria-label="Categorias">
          {menu.business.categories.map((c) => (
            <button key={c.id} onClick={() => irParaCategoria(c.id)} className={c.id === categoriaAtiva ? "active" : ""} aria-current={c.id === categoriaAtiva ? "true" : undefined}>
              {c.nome}
            </button>
          ))}
        </nav>

        {categoriasVisiveis.length === 0 && <p className="ifood-empty">Nenhum produto encontrado para “{busca.trim()}”.</p>}

        {categoriasVisiveis.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="ifood-section" aria-label={c.nome}>
            <h2 className="ifood-section-title">{c.nome}</h2>
            {c.products.map((p) => (
              <article key={p.id} onClick={() => abrirProduto(p)} className="pcard">
                <div className="pcard-body">
                  <h3 className="pcard-name">
                    {p.nome}
                    {p.destaque && <span className="pcard-badge">MAIS PEDIDO</span>}
                  </h3>
                  {p.descricao && <p className="pcard-desc">{p.descricao}</p>}
                  <p className="pcard-price">{formatarMoeda(Number(p.preco))}</p>
                </div>
                <div className="pcard-photo">
                  {p.foto_url ? <img src={p.foto_url} alt={p.nome} loading="lazy" /> : <span className="pcard-photo-fallback" aria-hidden="true" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirProduto(p);
                    }}
                    className="pcard-add"
                    aria-label={`Adicionar ${p.nome}`}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </section>
        ))}

        {produtoAberto && (
          <div className="sheet-overlay" onClick={() => setProdutoAberto(null)}>
            <div className="sheet-content pdetail-dialog" role="dialog" aria-modal="true" aria-label={produtoAberto.nome} onClick={(e) => e.stopPropagation()}>
              <div className="pdetail-photo">
                {produtoAberto.foto_url ? <img src={produtoAberto.foto_url} alt={produtoAberto.nome} /> : <span className="pdetail-photo-fallback" aria-hidden="true" />}
              </div>
              <div className="pdetail-main">
                <div className="pdetail-scroll">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                    <h2 className="pdetail-title">{produtoAberto.nome}</h2>
                    <button className="sheet-close" onClick={() => setProdutoAberto(null)} aria-label="Fechar">
                      ✕
                    </button>
                  </div>
                  {produtoAberto.descricao && <p className="pdetail-desc">{produtoAberto.descricao}</p>}
                  <p className="pdetail-price">{formatarMoeda(calcularTotal(produtoAberto, escolhas))}</p>
                  <div className="pdetail-store">
                    <p className="pdetail-store-name">{menu.business.nome}</p>
                    {isOpen ? <p className="pdetail-store-status open">● Aberto</p> : <p className="pdetail-store-status closed">● Fechado</p>}
                  </div>
                  {(produtoAberto.optionGroups ?? []).map((g) => (
                    <div key={g.id} className="pdetail-group">
                      <div className="pdetail-group-head">
                        <h3 className="pdetail-group-name">
                          {g.nome} {g.obrigatorio && <span className="pdetail-required">OBRIGATÓRIO</span>}
                        </h3>
                        <p className="pdetail-group-sub">{descricaoEscolha(g)}</p>
                      </div>
                      {g.options.map((o) => (
                        <label key={o.id} className="pdetail-option">
                          <span className="pdetail-option-name">{o.nome}</span>
                          {Number(o.precoExtra) > 0 && <span className="pdetail-option-extra">+{formatarMoeda(Number(o.precoExtra))}</span>}
                          <input
                            type={g.maxEscolhas === 1 ? "radio" : "checkbox"}
                            name={g.id}
                            checked={(escolhas[g.id] ?? []).includes(o.id)}
                            onChange={() => alternarEscolha(g.id, o.id)}
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="pdetail-footer">
                  <div className="stepper">
                    <button onClick={() => setQtd((x) => Math.max(1, x - 1))} aria-label="Diminuir quantidade">
                      −
                    </button>
                    <strong>{qtd}</strong>
                    <button onClick={() => setQtd((x) => x + 1)} aria-label="Aumentar quantidade">
                      +
                    </button>
                  </div>
                  <button className="pdetail-cta" disabled={!validarEscolhas()} onClick={adicionarAoCarrinho}>
                    <span>{edicaoIndex !== null ? "Salvar" : "Adicionar"}</span>
                    <span>{formatarMoeda(calcularTotal(produtoAberto, escolhas) * qtd)}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {qtdCarrinho > 0 && !carrinhoAberto && (
          <div className="cartbar-wrap">
            <button className="cartbar" onClick={() => setCarrinhoAberto(true)}>
              <span className="cartbar-label">Ver sacola</span>
              <span>
                {qtdCarrinho} {qtdCarrinho === 1 ? "item" : "itens"} · {formatarMoeda(totalCarrinho)}
              </span>
            </button>
          </div>
        )}

        {carrinhoAberto && (
          <div className="sheet-overlay" onClick={() => setCarrinhoAberto(false)}>
            <div className="sheet-content" role="dialog" aria-modal="true" aria-label="Sacola" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-body">
                <h2 className="sheet-title">Sacola</h2>
                {carrinho.map((item, i) => (
                  <div key={i} className="cartitem">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <strong>
                        {item.qtd}× {item.nome}
                      </strong>
                      <span>{formatarMoeda(item.total)}</span>
                    </div>
                    {item.opcoes.length > 0 && <p className="cartitem-opcoes">{item.opcoes.map((o) => o.optionNome).join(" · ")}</p>}
                    <div className="cartitem-actions">
                      <button onClick={() => alterarQtd(i, -1)} aria-label="Diminuir quantidade">
                        −
                      </button>
                      <span>{item.qtd}</span>
                      <button onClick={() => alterarQtd(i, 1)} aria-label="Aumentar quantidade">
                        +
                      </button>
                      <button className="cartitem-edit" onClick={() => abrirEdicao(i)}>
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
                <p className="cart-total">Total: {formatarMoeda(totalCarrinho)}</p>
                <button
                  className="btn-finalizar-carrinho"
                  disabled={!isOpen}
                  onClick={() => {
                    setCarrinhoAberto(false);
                    setEmCheckout(true);
                  }}
                >
                  {isOpen ? "Finalizar pedido" : "Loja fechada"}
                </button>
              </div>
            </div>
          </div>
        )}

        {emPedido !== null && <Pedido token={emPedido} aoVoltar={() => setEmPedido(null)} />}
      </main>
      <CookieBanner />
    </div>
  );
}

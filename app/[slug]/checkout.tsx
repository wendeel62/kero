"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SfMenuData } from "@/lib/storefront";
import { parseBRLToCents } from "@/lib/pricing";
import { formatarMoeda, type SfCarrinhoItem } from "@/lib/storefront-cart";
import { type GeocodeInput, type AddressSuggestion, sugestaoParaGeocodeInput } from "@/lib/geocode";

const CheckoutMap = dynamic(() => import("@/components/checkout-map"), { ssr: false, loading: () => <div style={{ height: 260, borderRadius: 12, background: "#f0f0f0" }} /> });

type TipoPedido = "delivery" | "retirada";
type Metodo = "pix" | "cash" | "card_machine";

type Quote = {
  tipo: string;
  subtotal: number;
  taxaEntrega: number;
  desconto: number;
  total: number;
  itens: Array<{ productId: string; nome: string; qtd: number; precoUnit: number; total: number }>;
};

const TIPO_LABELS: Record<TipoPedido, { label: string; desc: string }> = {
  delivery: { label: "Entrega", desc: "Receba no endereço" },
  retirada: { label: "Retirada", desc: "Busque no local" },
};

export default function Checkout({
  slug,
  storeId,
  carrinho,
  menu,
  neighborhoods,
  notes,
  aoConcluir,
  aoVoltar,
}: {
  slug: string;
  storeId: string;
  carrinho: SfCarrinhoItem[];
  menu: SfMenuData;
  neighborhoods: Array<{ id: string; name: string; fee_cents: number }>;
  notes: string;
  aoConcluir: (token: string) => void;
  aoVoltar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPedido>("delivery");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cep, setCep] = useState("");
  const [bairro, setBairro] = useState("");
  const [gpsErro, setGpsErro] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoAviso, setGeoAviso] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [troco, setTroco] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceAutocompleteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sugestaoBoxRef = useRef<HTMLUListElement | null>(null);
  const honeypotRef = useRef<HTMLInputElement | null>(null);
  const [sugestoes, setSugestoes] = useState<AddressSuggestion[]>([]);
  const [sugestaoAberta, setSugestaoAberta] = useState(false);
  // O autocomplete (LocationIQ) devolve, ora, itens com o display_address
  // idêntico — a chave do dropdown `key={s.label}` só é segura sem duplicadas,
  // por isso mantive a lista filtrada nesse estado.
  const sugestoesUnicas = useMemo(() => {
    const seen = new Set<string>();
    return sugestoes.filter((s) => {
      if (seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });
  }, [sugestoes]);
  const lojaFechada = !menu.business.aberto_fechado;

  function erroBody(body: unknown, status: number): string {
    if (body && typeof body === "object") {
      const b = body as { error?: unknown; code?: unknown; message?: unknown };
      if (b.error && typeof b.error === "object") {
        const e = b.error as { code?: unknown; message?: unknown };
        // Prioriza a mensagem em PT-BR (error.message) antes do código
        if (typeof e.message === "string" && e.message) return e.message;
        if (typeof e.code === "string" && e.code) return e.code;
      }
      if (typeof b.error === "string" && b.error) return b.error;
      if (typeof b.code === "string" && b.code) return b.code;
    }
    return `HTTP ${status}`;
  }

  const itensParaQuote = useMemo(
    () =>
      carrinho.map((item) => ({
        productId: item.productId,
        qtd: item.qtd,
        addonIds: item.opcoes.map((o) => o.optionId),
      })),
    [carrinho],
  );

  const atualizarQuote = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCarregando(true);
      setErro("");
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, tipo, items: itensParaQuote, neighborhood_id: bairro || undefined }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          // MIN_ORDER: o servidor devolve {error:"MIN_ORDER", minOrderCents, subtotal}
          if (body?.error === "MIN_ORDER" && typeof body.minOrderCents === "number" && typeof body.subtotal === "number") {
            const faltam = body.minOrderCents - body.subtotal;
            throw new Error(`MIN_ORDER:Faltam ${(faltam / 100).toFixed(2).replace(".", ",")} para o pedido mínimo.`);
          }
          throw new Error(erroBody(body, res.status));
        }
        setQuote(body.quote as Quote);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "erro_interno");
        setQuote(null);
      } finally {
        setCarregando(false);
      }
    }, 400);
  }, [slug, tipo, itensParaQuote, bairro]);

  useEffect(() => {
    atualizarQuote();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [atualizarQuote]);

  function usarLocalizacao() {
    setGpsErro("");
    setGeoAviso("");
    if (!navigator.geolocation) {
      setGpsErro("Geolocalização não suportada");
      return;
    }
    setGpsErro("Obtendo localização…");
    let resolvido = false;
    let melhor: { lat: number; lng: number; acc: number } | null = null;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        // a 1ª leitura vem de Wi-Fi/torre e é a mais grosseira: guarda a melhor
        // e só aceita quando boa o bastante (ou quando o watch expirar).
        if (!melhor || acc < melhor.acc) {
          melhor = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc };
        }
        if (acc <= 40) {
          resolvido = true;
          navigator.geolocation.clearWatch(watchId);
          aplicarPino(melhor.lat, melhor.lng);
        }
      },
      (err) => {
        if (resolvido) return;
        resolvido = true;
        navigator.geolocation.clearWatch(watchId);
        // timeout mas com leituras ruins: melhor usar o que temos do que nada
        if (melhor) aplicarPino(melhor.lat, melhor.lng);
        else setGpsErro(err.code === 1 ? "Permissão de GPS negada" : "Não foi possível obter localização");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

    function aplicarPino(lat: number, lng: number) {
      setCoords({ lat, lng });
      setGpsErro("");
      fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`)
        .then((r) => r.json())
        .then((b) => { if (b.endereco) setEndereco(b.endereco); })
        .catch(() => {});
    }
  }

  async function resolverEndereco(input: GeocodeInput) {
    setGeoAviso("Buscando endereço…");
    const timeoutId = setTimeout(() => {
      setGeoAviso("A busca está demorando — verifique o CEP ou use o GPS.");
    }, 10000);
    try {
      const res = await fetch("/api/geo/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const b = await res.json().catch(() => ({}));
      clearTimeout(timeoutId);
      if (!res.ok || typeof b.lat !== "number") {
        setGeoAviso("Não encontramos esse endereço — use o GPS ou ajuste o pino no mapa.");
        return;
      }
      setCoords({ lat: b.lat, lng: b.lng });
      setGeoAviso(
        b.origem === "cep"
          ? "Achamos só a região do CEP. Arraste o pino até a sua porta."
          : "",
      );
    } catch {
      clearTimeout(timeoutId);
      setGeoAviso("Falha ao buscar o endereço — use o GPS ou ajuste o pino.");
    }
  }

  function buscarEndereco() {
    if (!cep.trim()) return;
    const hood = neighborhoods.find((n) => n.id === bairro)?.name;
    resolverEndereco({
      cep: cep.replace(/\D/g, ""),
      street: endereco.split(/,\s*/)[0]?.trim() || undefined,
      number: endereco.match(/(?:^|[\s,])\d+[a-zA-Z]?(?:$|[\s,])/)?.[0]?.trim() || undefined,
      neighborhood: hood,
    });
  }

  function onEnderecoChange(v: string) {
    setEndereco(v);
    if (v.trim().length < 3) {
      setSugestoes([]);
      setSugestaoAberta(false);
      return;
    }
    if (debounceAutocompleteRef.current) clearTimeout(debounceAutocompleteRef.current);
    debounceAutocompleteRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geo/autocomplete?q=${encodeURIComponent(v.trim())}`,
        );
        const b = await res.json().catch(() => ({}));
        setSugestoes(b.suggestions || []);
        setSugestaoAberta(true);
      } catch {
        setSugestoes([]);
        setSugestaoAberta(false);
      }
    }, 300);
  }

  function dadosValidos(): boolean {
    if (!nome.trim() || !telefone.trim()) return false;
    if (tipo === "delivery" && (!endereco.trim() || !cep.trim() || !bairro)) return false;
    return true;
  }

  function podeFinalizar(): boolean {
    return dadosValidos() && !!quote && !carregando;
  }

  async function handleCriarPedido() {
    if (!podeFinalizar() || !quote) return;
    const fone = telefone.replace(/\D/g, "");
    if (fone.length < 10 || fone.length > 15) {
      setErro("telefone_invalido");
      return;
    }
    let trocoCents: number | null = null;
    if (metodo === "cash" && troco.trim() !== "") {
      trocoCents = parseBRLToCents(troco);
      if (!Number.isFinite(trocoCents)) {
        setErro("troco_invalido");
        return;
      }
    }
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          customer_name: nome.trim(),
          customer_phone: fone,
          type: tipo === "retirada" ? "pickup" : "delivery",
          payment_method: metodo,
          change_for_cents: trocoCents,
          notes: notes.trim(),
          address: tipo === "delivery"
            ? {
                endereco: endereco.trim(),
                cep: cep.replace(/\D/g, ""),
                neighborhood_id: bairro,
                // o ponto que o cliente arrasta no mapa é a origem da distância
                // e do link de navegação do motoboy — sem ele não há entrega precisa
                ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
              }
            : null,
          items: itensParaQuote.map((i) => ({ id: i.productId, qty: i.qtd, addons: i.addonIds })),
          total_cents: Math.round(quote.total * 100),
          website: honeypotRef.current?.value ?? "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(erroBody(body, res.status));
      if (!body.tracking_token) throw new Error("erro_interno");
      aoConcluir(body.tracking_token as string);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro_interno");
    } finally {
      setCarregando(false);
    }
  }

  function selecionarSugestao(s: AddressSuggestion) {
    setEndereco(s.label || [s.street, s.number].filter(Boolean).join(", "));
    setSugestaoAberta(false);
    setSugestoes([]);
    resolverEndereco(sugestaoParaGeocodeInput(s));
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSugestaoAberta(false);
        setSugestoes([]);
      }
    }
    function handleMouseDown(e: MouseEvent) {
      if (sugestaoBoxRef.current && !sugestaoBoxRef.current.contains(e.target as Node)) {
        setSugestaoAberta(false);
        setSugestoes([]);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  if (lojaFechada) {
    return (
      <main className="checkout-loja-fechada">
        <div className="checkout-fechado-card">
          <h2>Loja fechada</h2>
          <p>O estabelecimento está fechado no momento — o checkout está indisponível.</p>
          <button className="btn-voltar" onClick={aoVoltar}>
            Voltar ao cardápio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-container">
      <header className="checkout-header">
        <button className="btn-voltar-header" onClick={aoVoltar} aria-label="Voltar">
          ←
        </button>
        <h1>{menu.business.nome}</h1>
        <span className="checkout-aberto">● Aberto</span>
      </header>

      <section className="checkout-etapa" aria-labelledby="etapa-tipo">
        <h2 id="etapa-tipo">Como você quer receber?</h2>
        <div className="tipo-cards" role="radiogroup" aria-label="Tipo de pedido">
          {(["delivery", "retirada"] as TipoPedido[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} className={`tipo-card${tipo === t ? " selected" : ""}`} onClick={() => setTipo(t)}>
              <span className="tipo-label">{TIPO_LABELS[t].label}</span>
              <span className="tipo-desc">{TIPO_LABELS[t].desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="checkout-etapa" aria-labelledby="etapa-dados">
        <h2 id="etapa-dados">Seus dados</h2>
        <input type="text" name="website" ref={honeypotRef} autoComplete="off" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} defaultValue="" />
        <div className="form-grid">
          <label className="form-field">
            <span>Nome *</span>
            <input type="text" required autoComplete="name" placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Telefone *</span>
            <input type="tel" required autoComplete="tel" placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          {tipo === "delivery" && (
            <>
              <label className="form-field full-width" style={{ position: "relative" }}>
                <span>Endereço completo *</span>
                <input
                  type="text"
                  required
                  autoComplete="street-address"
                  placeholder="Rua, número..."
                  value={endereco}
                  onChange={(e) => onEnderecoChange(e.target.value)}
                  style={{ padding: "0.75rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-button)", fontSize: "1rem", minHeight: 44, background: "#fff" }}
                />
                {sugestaoAberta && (
                  <ul
                    ref={sugestaoBoxRef}
                    role="listbox"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      maxHeight: 240,
                      overflowY: "auto",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-card)",
                      zIndex: 50,
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                    }}
                  >
                    {sugestoesUnicas.map((s) => (
                      <li
                        key={s.label}
                        role="option"
                        aria-selected={false}
                        onMouseDown={() => selecionarSugestao(s)}
                        style={{
                          padding: "0.75rem",
                          cursor: "pointer",
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        {s.label}
                      </li>
                    ))}
                  </ul>
                )}
              </label>
              <label className="form-field">
                <span>CEP *</span>
                <input type="text" required inputMode="numeric" maxLength={9} autoComplete="postal-code" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, ""))} />
              </label>
              <label className="form-field">
                <span>Bairro *</span>
                <select required value={bairro} onChange={(e) => setBairro(e.target.value)} style={{ padding: "0.75rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-button)", fontSize: "1rem", minHeight: 44, background: "#fff" }}>
                  <option value="">Selecione…</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} · {formatarMoeda(n.fee_cents / 100)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-field full-width">
                <button type="button" className="btn-mapa" onClick={buscarEndereco}>
                  Buscar endereço no mapa
                </button>
                {geoAviso && <span className="form-hint">{geoAviso}</span>}
              </div>
              <div className="form-field full-width">
                <span>Ou use sua localização</span>
                <button type="button" className="btn-mapa" disabled={gpsErro === "Obtendo localização…"} onClick={usarLocalizacao}>
                  Usar localização atual
                </button>
                {gpsErro && <span className="form-hint">{gpsErro}</span>}
              </div>
              {coords && (
                <div className="form-field full-width">
                  <span>Confirme o ponto de entrega no mapa</span>
                  <CheckoutMap
                    lat={coords.lat}
                    lng={coords.lng}
                    onChange={(lat, lng) => {
                      setCoords({ lat, lng });
                      // arrastar = o cliente assumiu o controle: o ponto deixa de ser aproximado
                      setGeoAviso("");
                      setGpsErro("");
                    }}
                  />
                </div>
              )}
            </>
          )}
          {tipo === "retirada" && <p className="form-hint full-width">Apresente seu nome no balcão para retirar.</p>}
        </div>
      </section>

      <section className="checkout-etapa" aria-labelledby="etapa-pagamento">
        <h2 id="etapa-pagamento">Pagamento</h2>
        <div className="pagamento-metodos" role="radiogroup" aria-label="Método de pagamento">
          {([["pix", "Pix", "Aprovação rápida"], ["cash", "Dinheiro", "Na entrega"], ["card_machine", "Maquininha", "Na entrega"]] as Array<[Metodo, string, string]>).map(([m, label, desc]) => (
            <button key={m} type="button" role="radio" aria-checked={metodo === m} className={`pagamento-metodo${metodo === m ? " selected" : ""}`} onClick={() => setMetodo(m)}>
              <span className="metodo-label">{label}</span>
              <span className="metodo-desc">{desc}</span>
            </button>
          ))}
        </div>
        {metodo === "cash" && (
          <div className="form-grid" style={{ marginTop: "0.75rem" }}>
            <label className="form-field full-width">
              <span>Troco para (opcional)</span>
              <input type="text" inputMode="decimal" placeholder="Ex.: 100" value={troco} onChange={(e) => setTroco(e.target.value)} />
            </label>
          </div>
        )}
      </section>

      <section className="checkout-etapa" aria-labelledby="etapa-resumo">
        <h2 id="etapa-resumo">Resumo do pedido</h2>
        {carregando && !quote && <p className="carregando-quote">Calculando total…</p>}
        {erro && (
          <p className="erro-quote" role="alert">
            Erro: {erro}
          </p>
        )}
        {quote && (
          <div className="quote-breakdown">
            <h3>Resumo ({TIPO_LABELS[tipo].label})</h3>
            <ul>
              {quote.itens.map((item, i) => (
                <li key={i}>
                  <span>
                    {item.nome} × {item.qtd}
                  </span>
                  <span>{formatarMoeda(item.total)}</span>
                </li>
              ))}
            </ul>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatarMoeda(quote.subtotal)}</dd>
              </div>
              {tipo === "delivery" && quote.taxaEntrega > 0 && (
                <div>
                  <dt>Taxa de entrega</dt>
                  <dd>{formatarMoeda(quote.taxaEntrega)}</dd>
                </div>
              )}
              {quote.desconto > 0 && (
                <div>
                  <dt>Desconto</dt>
                  <dd>−{formatarMoeda(quote.desconto)}</dd>
                </div>
              )}
              <div className="total">
                <dt>Total</dt>
                <dd>{formatarMoeda(quote.total)}</dd>
              </div>
            </dl>
            <p className="fonte-servidor">Valores calculados pelo servidor.</p>
          </div>
        )}

      </section>

      <div className="checkout-cta-bar">
        <div className="cta-total">
          <small>Total</small>
          <strong>{quote ? formatarMoeda(quote.total) : "—"}</strong>
        </div>
        <button className="btn-primario btn-finalizar" disabled={!podeFinalizar()} onClick={handleCriarPedido}>
          {carregando ? "Processando…" : "Finalizar pedido"}
        </button>
      </div>
    </main>
  );
}

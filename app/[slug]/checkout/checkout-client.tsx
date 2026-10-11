"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brl, type Addon, type Category, type Neighborhood, type Product, type Store } from "../menu-data";
import { loadCart, saveCart, saveLastToken, type CartLine } from "@/lib/cart";
import { lineTotal, meetsMinimum, subtotal as calcSubtotal, total as calcTotal, unitPrice, validateChange } from "@/lib/pricing";
import { waLink } from "@/lib/wa";
import PriceChangeDialog from "@/components/ui/price-change-dialog";

type Resolved = { line: CartLine; product: Product; unit: number };
type Fulfillment = "delivery" | "pickup";
type Payment = "cash" | "pix" | "card_machine";
type PriceDiff = { originalTotal: number; correctedTotal: number };
type OrderResult = {
  tracking_token?: string;
  error?: { code: string; message: string };
  original_total?: number;
  corrected_total?: number;
};

const MAX_NOTES = 300; // spec: obs do pedido ≤300 chars
const onlyDigits = (s: string) => s.replace(/\D/g, "");
const reaisToCents = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export default function CheckoutClient({ store, storeId, categories, neighborhoods, addons, isOpen, opensAt }: {
  store: Store; storeId: string; categories: Category[]; neighborhoods: Neighborhood[]; addons: Addon[];
  isOpen: boolean; opensAt: string;
}) {
  const router = useRouter();
  const activeHoods = neighborhoods.filter((n) => n.active);
  const pickupOnly = activeHoods.length === 0; // spec: 0 bairros ⇒ pickup-only

  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [type, setType] = useState<Fulfillment>("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [cep, setCep] = useState("");
  const [hoodId, setHoodId] = useState(activeHoods[0]?.id ?? "");
  const [payment, setPayment] = useState<Payment>("cash");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: campo oculto "website", deve ficar vazio
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [showWa, setShowWa] = useState(false);
  const [priceDiff, setPriceDiff] = useState<PriceDiff | null>(null);

  useEffect(() => {
    setLines(loadCart(store.slug));
  }, [store.slug]);

  const addonPrice = useMemo(() => new Map(addons.map((a) => [a.id, a.price_cents] as const)), [addons]);
  const pricesOf = (ids: string[]) => ids.map((id) => addonPrice.get(id) ?? 0);

  const items = useMemo<Resolved[]>(() => {
    if (!lines) return [];
    const byId = new Map<string, Product>();
    for (const c of categories) for (const p of c.products) byId.set(p.id, p);
    return lines.flatMap((line) => {
      const product = byId.get(line.productId);
      if (!product) return [];
      const unit = unitPrice({ price_cents: product.price_cents, qty: line.qty, addons: pricesOf(line.addonIds) });
      return [{ line, product, unit }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, categories, addonPrice]);

  const fulfillment: Fulfillment = pickupOnly ? "pickup" : type;
  const hood = activeHoods.find((n) => n.id === hoodId) ?? activeHoods[0];
  const subtotal = calcSubtotal(items.map((i) => ({ price_cents: i.product.price_cents, qty: i.line.qty, addons: pricesOf(i.line.addonIds) })));
  const fee = fulfillment === "delivery" ? (hood?.fee_cents ?? 0) : 0;
  const total = calcTotal(subtotal, fee);
  const reachedMin = meetsMinimum(subtotal, store.min_order_cents);

  const buildPayload = (totalCents: number, confirmed: boolean) => {
    const byId = new Map<string, Product>();
    for (const c of categories) for (const p of c.products) byId.set(p.id, p);
    const knownAddons = new Set(addons.map((a) => a.id));
    return {
      store_id: storeId,
      customer_name: name.trim(),
      customer_phone: onlyDigits(phone),
      type: fulfillment,
      payment_method: payment,
      change_for_cents: payment === "cash" ? reaisToCents(changeFor) : null,
      notes: notes || null,
      address: fulfillment === "delivery"
        ? {
            neighborhood_id: hood?.id ?? null,
            cep: onlyDigits(cep),
            street: street.trim(),
            number: number.trim(),
            complement: complement.trim() || null,
          }
        : null,
      items: (lines ?? []).flatMap((line) =>
        byId.has(line.productId)
          ? [{
              id: line.productId,
              qty: Math.min(Math.max(line.qty, 1), 20),
              addons: line.addonIds.filter((id) => knownAddons.has(id)),
              notes: line.notes || null,
            }]
          : []
      ),
      total_cents: totalCents,
      website,
      confirmedPriceDiff: confirmed,
    };
  };

  const send = async (totalCents: number, confirmed: boolean) => {
    setSending(true);
    setShowWa(false);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload(totalCents, confirmed)),
      });
      const body = (await res.json().catch(() => null)) as OrderResult | null;
      if (res.status === 201 && body?.tracking_token) {
        saveCart(store.slug, []);
        saveLastToken(store.slug, body.tracking_token);
        router.push(`/${store.slug}/pedido/${body.tracking_token}`);
        return;
      }
      const code = body?.error?.code ?? "UNEXPECTED";
      const message = body?.error?.message ?? "Erro inesperado. Tente de novo.";
      if (code === "PRICE_CHANGED") {
        // reabre/atualiza o diálogo com os totais do servidor; nada é gravado nem limpo
        setPriceDiff({
          originalTotal: body?.original_total ?? total,
          correctedTotal: body?.corrected_total ?? total,
        });
        return;
      }
      if (code === "STORE_CLOSED") {
        // copy local com o horário da página (opensAt), não a message genérica do servidor
        setErrors([`A loja está fechada agora. ${opensAt}.`]);
        return;
      }
      if (code === "DUPLICATE") {
        setErrors([message]);
        setShowWa(true);
        return;
      }
      setErrors([message]);
      if (code === "TROCO_INSUFICIENTE") document.getElementById("troco")?.focus();
    } catch {
      setErrors(["Erro de conexão. Tente de novo."]);
    } finally {
      setSending(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const errs: string[] = [];
    if (website !== "") errs.push("HONEYPOT"); // bot: silenciosamente recusado no servidor
    if (name.trim().length < 2 || name.trim().length > 80) errs.push("Conte seu nome (2 a 80 letras).");
    const digits = onlyDigits(phone);
    if (digits.length < 10 || digits.length > 15) errs.push("WhatsApp inválido — só números com DDD.");
    if (items.length === 0) errs.push("Sua sacola está vazia.");
    if (!reachedMin) errs.push(`Pedido mínimo de ${brl(store.min_order_cents)} no subtotal.`);
    if (fulfillment === "delivery") {
      if (!hood) errs.push("BAIRROS_NAO_CONFIGURADOS — entrega indisponível, escolha retirada.");
      if (street.trim() === "" || number.trim() === "") errs.push("Rua e número são obrigatórios p/ entrega.");
      if (onlyDigits(cep).length !== 8) errs.push("CEP obrigatório com 8 dígitos.");
    }
    if (payment === "cash") {
      const cf = reaisToCents(changeFor);
      if (!Number.isFinite(cf)) errs.push("Troco: digite o valor em R$.");
      else if (!validateChange(payment, cf, total).ok) errs.push("TROCO_INSUFICIENTE — o troco precisa cobrir o total.");
    }
    if (!isOpen) errs.push(`STORE_CLOSED — abrimos às ${opensAt}.`);
    setErrors(errs);
    if (errs.length > 0) return;
    void send(total, false);
  };

  const confirmPrice = () => {
    if (!priceDiff) return;
    const corrected = priceDiff.correctedTotal;
    setPriceDiff(null);
    void send(corrected, true);
  };

  const input = "w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all disabled:opacity-50";
  const label = "text-[13px] font-bold text-stone-700";

  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
      <header className="sticky top-0 z-40 bg-white border-b shadow-[0_1px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href={`/${store.slug}/carrinho`} className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-lg transition-colors" aria-label="Voltar à sacola">←</Link>
          <span className="font-display font-extrabold tracking-tight">Checkout</span>
          <span className="ml-auto text-xs text-stone-400 font-medium truncate">{store.name}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-40 lg:pb-16">
        <ol className="flex items-center gap-1.5 mt-5 anim-rise" aria-label="Etapas do pedido">
          {["Sacola", "Checkout", "Receber"].map((s, i) => (
            <li key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
              <span className={`flex items-center gap-2 text-[12px] font-extrabold whitespace-nowrap ${i <= 1 ? "text-stone-900" : "text-stone-400"}`}>
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${i <= 1 ? "bg-stone-900 text-white shadow" : "bg-white border text-stone-400"}`}>
                  {i < 1 ? "✓" : i + 1}
                </span>
                {s}
              </span>
              {i < 2 && <span className="flex-1 h-px bg-stone-300 mx-1" />}
            </li>
          ))}
        </ol>

        {!isOpen && (
          <div className="mt-3 bg-amber-50 border border-dashed border-amber-300 rounded-2xl p-3.5 text-sm anim-rise">
            Loja fechada no momento — confira tudo com calma, mas o envio está desabilitado. Abrimos às {opensAt}.
          </div>
        )}

        <form id="checkout-form" onSubmit={submit} className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="min-w-0 space-y-4">
            {/* quem recebe */}
            <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
              <h2 className="font-display font-extrabold">Quem recebe?</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label htmlFor="nome" className={label}>Nome</label>
                  <input id="nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name"
                    className={`${input} mt-1`} maxLength={80} />
                </div>
                <div>
                  <label htmlFor="zap" className={label}>WhatsApp</label>
                  <input id="zap" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11987654321" inputMode="tel" autoComplete="tel"
                    className={`${input} mt-1`} maxLength={15} />
                </div>
              </div>
            </section>

            {/* entrega ou retirada */}
            <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "60ms" }}>
              <h2 className="font-display font-extrabold">Entrega ou retirada?</h2>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {([["delivery", "Entrega"], ["pickup", "Retirada"]] as const).map(([v, t]) => (
                  <label key={v} className={`border-2 rounded-2xl p-3 text-sm font-bold cursor-pointer transition-all ${fulfillment === v ? "border-red-600 bg-red-50/50" : "border-stone-100 hover:border-stone-300"}`}>
                    <input type="radio" name="tipo" checked={fulfillment === v} disabled={v === "delivery" && pickupOnly}
                      onChange={() => setType(v)} className="accent-red-600 mr-1.5" />
                    {t}
                  </label>
                ))}
              </div>
              {pickupOnly && <p className="text-xs text-stone-500 mt-2">🚲 Por enquanto só retirada — a loja ainda não cadastrou bairros.</p>}

              {fulfillment === "delivery" && (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div className="sm:col-span-2 grid grid-cols-[1fr_110px] gap-3">
                    <div>
                      <label htmlFor="rua" className={label}>Rua / Avenida</label>
                      <input id="rua" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua das Flores" className={`${input} mt-1`} />
                    </div>
                    <div>
                      <label htmlFor="num" className={label}>Número</label>
                      <input id="num" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" className={`${input} mt-1`} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="bairro" className={label}>Bairro · taxa</label>
                    <select id="bairro" value={hoodId} onChange={(e) => setHoodId(e.target.value)} className={`${input} mt-1`}>
                      {activeHoods.map((n) => (
                        <option key={n.id} value={n.id}>{n.name} — {brl(n.fee_cents)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cep" className={label}>CEP*</label>
                    <input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="01234567" inputMode="numeric" className={`${input} mt-1`} maxLength={9} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="comp" className={label}>Complemento <span className="font-normal text-stone-400">(opcional)</span></label>
                    <input id="comp" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, bloco, referência…" className={`${input} mt-1`} />
                  </div>
                </div>
              )}
              {fulfillment === "pickup" && (
                <p className="text-xs text-stone-500 mt-3 bg-stone-50 border rounded-xl px-3 py-2">📍 Retirada no balcão — o endereço da loja chega na confirmação.</p>
              )}
            </section>

            {/* pagamento */}
            <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "120ms" }}>
              <h2 className="font-display font-extrabold">Pagamento <span className="text-xs font-normal text-stone-400">só na entrega · sem maquininha online</span></h2>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {([["cash", "Dinheiro"], ["pix", "Pix"], ["card_machine", "Maquininha"]] as const).map(([v, t]) => (
                  <label key={v} className={`border-2 rounded-2xl p-3 text-center text-sm font-bold cursor-pointer transition-all ${payment === v ? "border-red-600 bg-red-50/50" : "border-stone-100 hover:border-stone-300"}`}>
                    <input type="radio" name="pag" checked={payment === v} onChange={() => setPayment(v)} className="sr-only" />
                    {t}
                  </label>
                ))}
              </div>
              {payment === "cash" && (
                <div className="mt-3 anim-pop">
                  <label htmlFor="troco" className={label}>Troco para quanto? (R$)</label>
                  <input id="troco" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Ex: 100,00" inputMode="decimal"
                    className={`${input} mt-1 max-w-[200px]`} />
                  <p className="text-[11px] text-stone-400 mt-1">Precisa cobrir o total de {brl(total)}.</p>
                </div>
              )}
            </section>

            {/* obs */}
            <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "180ms" }}>
              <div className="flex items-baseline gap-2">
                <label htmlFor="obs" className="font-display font-extrabold">Observações</label>
                <span className="ml-auto text-[11px] text-stone-400 tabular-nums">{notes.length}/{MAX_NOTES}</span>
              </div>
              <textarea id="obs" rows={2} maxLength={MAX_NOTES} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: campainha quebrada, pode chamar no portão…" className={`${input} mt-2`} />
              <p className="text-[11px] text-stone-400 mt-2">🔒 LGPD: seus dados servem só p/ entregar este pedido.</p>
              {/* honeypot anti-bot */}
              <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
                autoComplete="off" tabIndex={-1} aria-hidden className="hidden" />
            </section>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm anim-pop" role="alert">
                <p className="font-extrabold text-red-700">Falta ajustar {errors.length === 1 ? "isto" : "estas coisas"}:</p>
                <ul className="list-disc pl-5 mt-1 text-red-700 space-y-0.5">
                  {errors.filter((e) => e !== "HONEYPOT").map((e) => <li key={e}>{e}</li>)}
                </ul>
                {showWa && (
                  <a href={waLink(store.whatsapp)} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 bg-green-600 text-white font-bold rounded-xl px-4 py-2.5 text-sm hover:bg-green-700 transition-colors">
                    Falar com a loja no WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>

          {/* recibo */}
          <div className="bg-stone-900 text-white rounded-3xl shadow-[0_20px_50px_-16px_rgba(28,25,23,0.55)] p-6 lg:sticky lg:top-20 h-fit texture-dots anim-rise" style={{ animationDelay: "100ms" }}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300">seu pedido</p>
            <ul className="mt-3 space-y-2 text-sm max-h-56 overflow-y-auto no-scrollbar">
              {items.map(({ line, product, unit }) => (
                <li key={`${line.productId}-${line.addonIds.join("+")}-${line.notes}`} className="flex justify-between gap-2 text-stone-300">
                  <span className="truncate">{line.qty}× {product.name}</span>
                  <span className="font-bold tabular-nums text-white shrink-0">{brl(unit * line.qty)}</span>
                </li>
              ))}
              {items.length === 0 && <li className="text-stone-400 text-sm">Sacola vazia — <Link href={`/${store.slug}`} className="underline text-amber-300">voltar ao cardápio</Link></li>}
            </ul>
            <div className="receipt-div mt-4 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-stone-300">
                <span>Subtotal</span><span className="font-bold tabular-nums text-white">{brl(subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-300">
                <span>{fulfillment === "delivery" ? `Entrega · ${hood?.name ?? "—"}` : "Retirada"}</span>
                <span className="font-bold tabular-nums text-white">{fulfillment === "delivery" ? brl(fee) : "grátis"}</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-stone-300">Total</span>
                <span className="font-display font-extrabold text-3xl tabular-nums">{brl(total)}</span>
              </div>
            </div>
            {!reachedMin && items.length > 0 && (
              <p className="mt-3 text-xs text-amber-200 bg-amber-300/10 border border-amber-300/25 rounded-xl px-3 py-2">
                Faltam {brl(store.min_order_cents - subtotal)} p/ o mínimo de {brl(store.min_order_cents)}.
              </p>
            )}
            <button type="submit" form="checkout-form" disabled={sending}
              className="btn-shine mt-4 w-full bg-gradient-to-r from-red-600 to-orange-500 font-bold rounded-xl py-3.5 shadow-lg transition-transform active:scale-[0.99] disabled:opacity-60">
              {sending ? "Enviando…" : `Fazer pedido • ${brl(total)}`}
            </button>
            <p className="mt-3 text-center text-[11px] text-stone-500">Servidor recalcula tudo — preço da tela é exibição.</p>
          </div>
        </form>
      </main>

      {/* CTA fixo mobile */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto bg-white border rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.3)] p-2 anim-bar">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-xs text-stone-500 font-medium">{fulfillment === "delivery" ? `Entrega · ${hood?.name ?? "—"}` : "Retirada"}</span>
            <span className="font-display font-extrabold tabular-nums">{brl(total)}</span>
          </div>
          <button type="submit" form="checkout-form" disabled={sending}
            className="btn-shine w-full bg-gradient-to-r from-red-700 via-red-600 to-red-500 text-white font-bold rounded-xl py-3.5 disabled:opacity-60">
            {sending ? "Enviando…" : "Fazer pedido →"}
          </button>
        </div>
      </div>

      <PriceChangeDialog
        open={priceDiff !== null}
        lines={items.map((i) => ({
          name: i.product.name,
          qty: i.line.qty,
          line_total: lineTotal({ price_cents: i.product.price_cents, qty: i.line.qty, addons: pricesOf(i.line.addonIds) }),
        }))}
        originalTotal={priceDiff?.originalTotal ?? total}
        correctedTotal={priceDiff?.correctedTotal ?? total}
        onConfirm={confirmPrice}
        onClose={() => setPriceDiff(null)}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { getPdv } from "@/lib/painel";
import { pdvCriarPedido } from "@/lib/painel-actions";
import { pdvTotal, type PdvLine } from "@/lib/pdv";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Tipo = "dine_in" | "pickup";

export default function PdvPage() {
  const [data, setData] = useState<{
    products: { id: string; name: string; price_cents: number }[];
    addons: { id: string; name: string; price_cents: number }[];
    tables: { id: string; number: number; label: string | null; active: boolean }[];
    activeByTable: (string | null)[];
  } | null>(null);
  const [tipo, setTipo] = useState<Tipo>("dine_in");
  const [tableId, setTableId] = useState<string>("");
  const [cart, setCart] = useState<PdvLine[]>([]);
  const [payment, setPayment] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getPdv().then((data) =>
      setData({
        products: data.products,
        addons: data.addons,
        tables: data.tables.map((t) => ({ ...t, number: Number(t.number) })),
        activeByTable: data.activeByTable,
      })
    ).catch(() => setError("Não foi possível carregar o PDV."));
  }, []);

  const total = useMemo(
    () => pdvTotal(cart, data?.products ?? [], data?.addons ?? []),
    [cart, data]
  );

  const addToCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.id === productId);
      if (existing) {
        return prev.map((l) => l.id === productId ? { ...l, qty: Math.min(l.qty + 1, 20) } : l);
      }
      return [...prev, { id: productId, qty: 1, addons: [] }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.id !== productId));
  };

  const toggleAddon = (lineIdx: number, addonId: string) => {
    setCart((prev) => prev.map((l, i) => {
      if (i !== lineIdx) return l;
      const has = l.addons.includes(addonId);
      return { ...l, addons: has ? l.addons.filter((a) => a !== addonId) : [...l.addons, addonId] };
    }));
  };

  const submit = async () => {
    setError("");
    setSuccess("");
    if (tipo === "dine_in" && !tableId) {
      setError("Escolha a mesa.");
      return;
    }
    if (cart.length === 0) {
      setError("Adicione itens ao carrinho.");
      return;
    }
    if (customerName.trim().length < 2) {
      setError("Nome do cliente com pelo menos 2 letras.");
      return;
    }
    const digits = customerPhone.replace(/\D/g, "");
    if (!/^[0-9]{10,15}$/.test(digits)) {
      setError("Telefone: só dígitos, 10 a 15.");
      return;
    }
    const r = await pdvCriarPedido({
      type: tipo,
      table_id: tipo === "dine_in" ? tableId : undefined,
      payment_method: payment,
      customer_name: customerName.trim(),
      customer_phone: digits,
      items: cart,
    });
    if (!r.ok) {
      setError(r.error ?? "Erro ao criar pedido.");
      return;
    }
    setSuccess("Pedido criado!");
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    // recarrega mesas (a mesa escolhida fica ocupada)
    getPdv().then((data) =>
      setData({
        products: data.products,
        addons: data.addons,
        tables: data.tables.map((t) => ({ ...t, number: Number(t.number) })),
        activeByTable: data.activeByTable,
      })
    ).catch(() => {});
  };

  if (!data) {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando PDV…</p>
      </main>
    );
  }

  return (
    <main className="admin-content">
      <h1 className="text-xl font-extrabold">PDV</h1>

      {/* Tipo */}
      <div className="flex gap-2 mt-4">
        {(["dine_in", "pickup"] as const).map((t) => (
          <button key={t} onClick={() => setTipo(t)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              tipo === t
                ? "bg-[var(--text)] text-[var(--surface)]"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}>
            {t === "dine_in" ? "Mesa" : "Retirada"}
          </button>
        ))}
      </div>

      {/* Mesa */}
      {tipo === "dine_in" && (
        <div className="mt-4">
          <p className="text-xs font-bold text-[var(--muted)] mb-2">Mesa</p>
          <div className="flex flex-wrap gap-2">
            {data.tables.map((t, i) => {
              const ocupada = data.activeByTable[i] !== null;
              const selected = tableId === t.id;
              return (
                <button key={t.id} onClick={() => !ocupada && setTableId(t.id)}
                  disabled={ocupada}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
                    selected
                      ? "bg-[var(--text)] text-[var(--surface)] border-[var(--text)]"
                      : ocupada
                        ? "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] opacity-50 cursor-not-allowed"
                        : "bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--text)]"
                  }`}>
                  {t.number} {t.label ? `· ${t.label}` : ""} {ocupada ? "🔴" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Produtos */}
      <div className="mt-6">
        <p className="text-xs font-bold text-[var(--muted)] mb-2">Produtos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {data.products.map((p) => (
            <button key={p.id} onClick={() => addToCart(p.id)}
              className="card p-3 text-left hover:border-[var(--text)] transition-colors">
              <p className="text-sm font-bold truncate">{p.name}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">{brl(p.price_cents)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Carrinho */}
      {cart.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold text-[var(--muted)] mb-2">Carrinho</p>
          <div className="space-y-2">
            {cart.map((line, idx) => {
              const prod = data.products.find((p) => p.id === line.id);
              if (!prod) return null;
              return (
                <div key={line.id} className="card p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold flex-1">{prod.name}</span>
                    <span className="text-sm font-bold tabular-nums">{brl(
                      (prod.price_cents + line.addons.reduce((s, a) => s + (data.addons.find((x) => x.id === a)?.price_cents ?? 0), 0)) * line.qty
                    )}</span>
                    <button onClick={() => removeFromCart(line.id)}
                      className="text-[var(--muted)] hover:text-[var(--red)] font-bold">✕</button>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button onClick={() => setCart((prev) => prev.map((l, i) => i === idx ? { ...l, qty: Math.max(1, l.qty - 1) } : l))}
                      className="w-7 h-7 rounded-lg border border-[var(--border)] text-sm font-bold">−</button>
                    <span className="text-sm font-bold tabular-nums w-6 text-center">{line.qty}</span>
                    <button onClick={() => setCart((prev) => prev.map((l, i) => i === idx ? { ...l, qty: Math.min(20, l.qty + 1) } : l))}
                      className="w-7 h-7 rounded-lg border border-[var(--border)] text-sm font-bold">+</button>
                  </div>
                  {data.addons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {data.addons.map((a) => {
                        const checked = line.addons.includes(a.id);
                        return (
                          <button key={a.id} onClick={() => toggleAddon(idx, a.id)}
                            className={`px-2 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                              checked
                                ? "bg-[var(--text)] text-[var(--surface)] border-[var(--text)]"
                                : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"
                            }`}>
                            {a.name} +{brl(a.price_cents)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Total + pagamento + cliente */}
      <div className="mt-6 card p-4">
        <p className="text-lg font-extrabold">Total: {brl(total)}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {(["cash", "pix", "card_machine"] as const).map((m) => (
            <button key={m} onClick={() => setPayment(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                payment === m
                  ? "bg-[var(--text)] text-[var(--surface)] border-[var(--text)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"
              }`}>
              {m === "cash" ? "Dinheiro" : m === "pix" ? "Pix" : "Maquininha"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nome do cliente" maxLength={80}
            className="text-sm border border-[var(--border)] rounded-[var(--radius-button)] px-3.5 py-2.5 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--text)] outline-none" />
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Telefone (só dígitos)" maxLength={15}
            className="text-sm border border-[var(--border)] rounded-[var(--radius-button)] px-3.5 py-2.5 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--text)] outline-none" />
        </div>
        {error && <p className="text-xs font-bold text-[var(--red)] mt-2" role="alert">{error}</p>}
        {success && <p className="text-xs font-bold text-[var(--green)] mt-2" role="status">{success}</p>}
        <button onClick={submit}
          className="btn btn--primary w-full mt-3 py-3 text-sm font-extrabold">
          Criar pedido
        </button>
      </div>
    </main>
  );
}

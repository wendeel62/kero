import Link from "next/link";
import { getClientes, getPedidosDoCliente } from "@/lib/painel";
import type { Customer } from "@/lib/customers";
import { toPanelOrder } from "@/lib/painel-utils";
import ClienteDetalhe from "./detalhe";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PROFILE_LABEL: Record<Customer["profile"], string> = { vip: "VIP", recorrente: "Recorrente", novo: "Novo" };
const PROFILE_TINT: Record<Customer["profile"], string> = {
  vip: "bg-[var(--amber-soft)] text-[var(--amber)]",
  recorrente: "bg-[var(--info-soft)] text-[var(--info)]",
  novo: "bg-[var(--pill-bg)] text-[var(--muted)]",
};

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export default async function Clientes({ searchParams }: { searchParams: Promise<{ telefone?: string }> }) {
  const { telefone } = await searchParams;
  const { customers } = await getClientes();
  const selected = telefone ? customers.find((c) => c.phone === telefone) : undefined;
  const pedidos = selected ? (await getPedidosDoCliente(selected.phone)).orders.map((o) => toPanelOrder(o)) : [];

  // contagem por perfil numa passada (antes: 3 filter() sobre a mesma lista)
  const porPerfil = { vip: 0, recorrente: 0, novo: 0 };
  for (const c of customers) porPerfil[c.profile] += 1;
  const cards = [
    { label: "Todos", value: customers.length, sub: "clientes com pedido" },
    { label: "VIP", value: porPerfil.vip, sub: ">5 pedidos ou ≥ R$ 500" },
    { label: "Recorrentes", value: porPerfil.recorrente, sub: "2+ pedidos" },
    { label: "Novos", value: porPerfil.novo, sub: "1 pedido válido" },
  ];

  return (
    <main className="admin-content">
      <div className="anim-rise">
        <h1 className="font-extrabold text-[21px] tracking-[-0.02em] leading-tight">Clientes</h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">perfil derivado dos pedidos · sem tabela própria</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {cards.map((c, i) => (
          <div key={c.label} className="card anim-rise p-4" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">{c.label}</p>
            <p className="font-extrabold text-2xl tabular-nums mt-1">{c.value}</p>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <section className="card mt-4 anim-rise" style={{ animationDelay: "240ms" }}>
        <div className="card-head">
          <div>
            <h2 className="card-title">Clientes</h2>
            <p className="text-[11px] text-[var(--muted)]">ordenado por gasto · toque p/ ver o histórico</p>
          </div>
        </div>
        <ul className="mt-1 pb-2">
          {customers.map((c) => (
            <li key={c.phone}>
              <Link href={`/painel/clientes?telefone=${encodeURIComponent(c.phone)}`}
                className={`dish-card flex items-center gap-3 px-3 sm:px-3 py-3 rounded-2xl ${selected?.phone === c.phone ? "bg-[var(--surface-2)]" : ""}`}>
                <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-[var(--pill-active-bg)] text-[var(--pill-active-ink)] text-sm font-extrabold">
                  {c.name[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm">
                    <b className="truncate">{c.name}</b>
                    <span className={`text-[10px] font-extrabold rounded-full px-2 py-0.5 ${PROFILE_TINT[c.profile]}`}>{PROFILE_LABEL[c.profile]}</span>
                  </span>
                  <span className="block text-xs text-[var(--muted)] mt-0.5">
                    {c.phone} · {c.orders} pedido{c.orders === 1 ? "" : "s"} · último há {daysAgo(c.lastOrderAt)} d
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block font-extrabold tabular-nums text-sm">{brl(c.spentCents)}</span>
                  <span className="block text-[var(--muted)] text-xs">total gasto</span>
                </span>
              </Link>
            </li>
          ))}
          {customers.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-[var(--muted)]">nenhum cliente ainda</li>
          )}
        </ul>
      </section>

      {selected && <ClienteDetalhe customer={selected} pedidos={pedidos} />}
    </main>
  );
}

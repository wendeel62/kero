import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

export type { OrderStatus };

// API-06 (DS §4.11): badge dos 7 estados da máquina de pedidos (SPEC §6). Classes exatas da spec.
const CLASSES: Record<OrderStatus, string> = {
  new: "bg-red-50 text-red-700 border-red-200",
  confirmed: "bg-amber-50 text-amber-700 border-amber-200",
  preparing: "bg-blue-50 text-blue-700 border-blue-200",
  ready: "bg-green-50 text-green-700 border-green-200",
  out: "bg-green-50 text-green-700 border-green-200",
  delivered: "bg-stone-100 text-stone-700 border-stone-200",
  cancelled: "bg-stone-900 text-white border-stone-900",
};

export function StatusBadge({ status, size = "md", showDot = false }: {
  status: OrderStatus;
  size?: "sm" | "md";
  showDot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs"
      } ${CLASSES[status]}`}
    >
      {showDot && status === "new" && <span className="live-dot" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

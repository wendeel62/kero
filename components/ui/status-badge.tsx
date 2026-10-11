import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

export type { OrderStatus };

// Cores do DS: badge--{tone} usa --{cor}-soft (fundo) + --{cor} (ink). Sem Tailwind.
const CLASSES: Record<OrderStatus, string> = {
  new: "badge badge--error",
  confirmed: "badge badge--warning",
  preparing: "badge badge--info",
  ready: "badge badge--success",
  out: "badge badge--success",
  delivered: "badge badge--success",
  cancelled: "badge badge--primary",
};

export function StatusBadge({ status, size = "md", showDot = false }: {
  status: OrderStatus;
  size?: "sm" | "md";
  showDot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${size === "sm" ? "text-[11px] px-2 py-0.5" : "text-[11.5px] px-2.5 py-0.5"} ${CLASSES[status]}`}
    >
      {showDot && status === "new" && <span className="badge-dot live-dot" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

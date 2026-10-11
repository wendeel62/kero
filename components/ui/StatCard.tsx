import { ReactNode } from "react";
import { Card } from "./Card";

export function StatCard({ label, value, sub, deltaTone, icon }: { label: string; value: ReactNode; sub?: string; deltaTone?: "up" | "down" | "warn" | "flat"; icon?: ReactNode }) {
  const tom = deltaTone ?? "flat";
  return (
    <Card className="stat-card kpi-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <span className="stat-value">{value}</span>
      {sub && <span className={`stat-delta stat-delta--${tom}`}>{sub}</span>}
    </Card>
  );
}

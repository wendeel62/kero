import { ReactNode } from "react";

export function Pill({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

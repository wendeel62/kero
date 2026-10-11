import { ReactNode } from "react";

export function Card({ children, className = "", ...props }: { children: ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

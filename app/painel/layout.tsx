import { requireStore } from "@/lib/auth";
import PainelShell from "./shell";

// AUTH-02: um único ponto de guarda da área lojista (sem middleware).
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireStore();
  return <PainelShell>{children}</PainelShell>;
}

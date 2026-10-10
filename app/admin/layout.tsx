import { requireAdmin } from "@/lib/auth";
import AdminShell from "./shell";

// AUTH-02: um único ponto de guarda da área operador (sem middleware).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}

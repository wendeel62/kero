"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const input = "w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all disabled:opacity-50";
const label = "text-[13px] font-bold text-stone-700";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setEnviando(true);
    setErro("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error || !data.user) {
      setEnviando(false);
      setErro(error?.status === 400 ? "E-mail ou senha inválidos." : "Falha ao entrar. Tente de novo.");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role, store_id").eq("id", data.user.id).single();
    if (profile?.role === "admin") router.replace("/admin");
    else if (profile?.store_id) router.replace("/painel");
    else {
      await supabase.auth.signOut(); // lojista órfão (SPEC v3.1 #15)
      setEnviando(false);
      setErro("Usuário sem loja vinculada. Contate o operador.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1ec] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 text-white font-display font-extrabold shadow-lg">K</span>
          <div>
            <p className="font-display font-extrabold text-lg leading-none">Kero<span className="text-red-500">.</span></p>
            <p className="text-[11px] text-stone-500 mt-0.5">acesso do lojista</p>
          </div>
        </div>
        <form onSubmit={entrar} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className={label}>E-mail</label>
            <input id="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="voce@loja.com"
              className={`${input} mt-1`} disabled={enviando} />
          </div>
          <div>
            <label htmlFor="senha" className={label}>Senha</label>
            <input id="senha" type="password" autoComplete="current-password" value={senha}
              onChange={(e) => setSenha(e.target.value)} placeholder="••••••••"
              className={`${input} mt-1`} disabled={enviando} />
          </div>
          <p role="alert" aria-live="polite" className="text-[13px] font-bold text-red-600 min-h-5">{erro || "\u00a0"}</p>
          <button type="submit" disabled={enviando}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl px-4 py-3 transition-colors disabled:opacity-60">
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const senhas = ["KeroAdmin2026!", "LojistaTest2026!", "pizzaria123", "Teste123456!", "Kero2026!", "Senha123!", "12345678"];
for (const email of ["pizzaria123@gmail.com", "admin@kero.app", "pizzariadasol62@gmail.com", "lojista.qa@teste.local"]) {
  for (const p of senhas) {
    const { data, error } = await anon.auth.signInWithPassword({ email, password: p });
    if (!error) { console.log(`OK   ${email} / ${p}`); break; }
    if (p === senhas[senhas.length - 1]) console.log(`FAIL ${email} (all tried)`);
  }
}

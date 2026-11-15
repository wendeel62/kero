import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")), l.slice(l.indexOf("=")+1)]));
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth:{persistSession:false} });
for (const p of ["KeroAdmin2026!","KeroAdmin2026","pizzaria123","LojistaTest2026!","Kero2026!","Pizzaria123!","admin2026","Kero@2026","KeroAdmin2026@","keroadmin2026!"]) {
  const { data, error } = await anon.auth.signInWithPassword({ email: "pizzaria123@gmail.com", password: p });
  console.log(`${p.padEnd(20)} -> ${error ? "FAIL " + error.message : "OK id=" + data.user.id}`);
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: u } = await admin.auth.admin.listUsers({ perPage: 100 });
for (const x of u.users) if (x.email.includes("pizzaria123")) console.log("USER:", JSON.stringify({ id: x.id, email: x.email, confirmed: x.confirmed_at, banned: x.banned_until, last: x.last_sign_in_at, providers: x.app_metadata, umd: x.user_metadata }));

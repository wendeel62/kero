import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")), l.slice(l.indexOf("=")+1)])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: users } = await sb.auth.admin.listUsers({ perPage: 100 });
for (const u of users?.users ?? []) console.log("USER |", u.id, "|", u.email);
const { data: profiles } = await sb.from("profiles").select("*");
console.log("--- PROFILES ---");
for (const p of profiles ?? []) console.log("PROF |", p.id, "| role:", p.role, "| store_id:", p.store_id, "|", JSON.stringify(p.full_name ?? p.name ?? ""));
const { data: stores } = await sb.from("stores").select("id, slug, name, active, phone, address");
console.log("--- STORES ---");
for (const s of stores ?? []) console.log("STORE |", s.id, "|", s.slug, "|", s.name, "| active:", s.active);
const { data: counts } = await sb.from("orders").select("store_id");
console.log("--- ORDERS per store ---");
const byStore = {};
for (const o of counts ?? []) byStore[o.store_id] = (byStore[o.store_id]||0)+1;
console.log(byStore);

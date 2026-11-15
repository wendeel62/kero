import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")), l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data, error } = await sb.from("stores").select("*");
if (error) console.log("ERR", error.message);
for (const s of data ?? []) console.log("STORE |", s.id, "| slug:", s.slug, "| name:", s.name, "| active:", s.active);

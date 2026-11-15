import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
for (const t of ["routes","route_stops","courier_positions"]) {
  const { data } = await sb.from(t).select("*");
  console.log(`--- ${t} (${data?.length ?? 0}) ---`);
  for (const r of data ?? []) console.log("   ", JSON.stringify(r));
}

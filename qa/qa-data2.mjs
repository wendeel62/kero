import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")), l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
for (const SID of ["5751a74b-5feb-41be-be14-6c3967ca1383","cda9a418-1995-4c6f-86db-cc112fdd3def"]) {
  const { data: ord, error } = await sb.from("orders").select("*").eq("store_id", SID);
  console.log("STORE", SID, "ERR", error?.message ?? "-");
  for (const o of ord ?? []) console.log("  ORDER |", o.id, "| status:", o.status, "| total:", o.total_cents, "| name:", o.customer_name, "| token:", o.tracking_token, "| method:", o.delivery_method, "| created:", o.created_at, "| items:", JSON.stringify(o.items ?? o.order_items ?? null));
  const { data: c } = await sb.from("couriers").select("*").eq("store_id", SID);
  console.log("  COURIERS:", JSON.stringify(c));
}

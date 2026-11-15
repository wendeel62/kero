import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")), l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: o, error } = await sb.from("orders").select("*").eq("store_id","5751a74b-5feb-41be-be14-6c3967ca1383").order("created_at",{ascending:false}).limit(5);
console.log("ERR", error?.message);
for (const x of o ?? []) console.log("ORDER |", x.id, "| status:", x.status, "| name:", x.customer_name, "| phone:", x.customer_phone, "| type:", x.type, "| pay:", x.payment_method, "| total:", x.total_cents, "| token:", x.tracking_token, "| created:", x.created_at);

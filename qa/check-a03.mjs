import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const SID = "5751a74b-5feb-41be-be14-6c3967ca1383";
const { data: routes } = await sb.from("routes").select("*").eq("store_id", SID).eq("status", "open");
console.log("ROTAS ABERTAS:", JSON.stringify(routes));
for (const r of routes ?? []) {
  const { data: stops } = await sb.from("route_stops").select("*").eq("route_id", r.id);
  console.log("  STOPS:", JSON.stringify(stops));
  for (const s of stops ?? []) {
    const { data: o } = await sb.from("orders").select("id,code,status,courier_id,type").eq("id", s.order_id).single();
    console.log("   ORDER:", o?.code, o?.status, "courier:", o?.courier_id, "type:", o?.type);
  }
}
const { data: cour } = await sb.from("couriers").select("id,name,active,user_id").eq("store_id", SID);
console.log("COURIERS:", JSON.stringify(cour));

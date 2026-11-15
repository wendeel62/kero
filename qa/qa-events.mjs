import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from("order_events").select("*").eq("store_id","5751a74b-5feb-41be-be14-6c3967ca1383").order("created_at",{ascending:false}).limit(8);
for (const e of data ?? []) console.log("EVENT |", e.order_id?.slice(0,8), "|", e.from_status, "->", e.to_status, "|", e.created_at, "| actor:", e.actor);

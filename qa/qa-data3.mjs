import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")), l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const SID = "5751a74b-5feb-41be-be14-6c3967ca1383";
const { data: g } = await sb.from("product_addon_groups").select("*").eq("store_id", SID);
console.log("GROUPS:", JSON.stringify(g, null, 1));
const { data: a } = await sb.from("product_addons").select("*").eq("store_id", SID);
console.log("ADDONS:", JSON.stringify(a, null, 1));

import { NextResponse } from "next/server";

import { parseAutocomplete } from "@/lib/geocode";

// Autocomplete de rua no checkout (LocationIQ /v1/autocomplete). Sem rate-limit
// próprio: o cliente já faz debounce de 300ms e exige 3+ caracteres.
// O bairro da loja NAO e' o bairro do cliente — concatenar o bairro na busca
// trazia ruas de outra cidade (ex: "Rua das Flores" → Novo Hamburgo/RS).
// O countrycodes=br ja restringe ao Brasil; o CEP digitado e' o viés real.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  const key = process.env.LOCATIONIQ_KEY;
  if (!key) return NextResponse.json({ suggestions: [] });

  const search = async (term: string) => {
    try {
      const res = await fetch(
        `https://us1.locationiq.com/v1/autocomplete?key=${key}&q=${encodeURIComponent(term)}` +
          `&format=json&limit=6&countrycodes=br&addressdetails=1`,
      );
      return res.ok ? parseAutocomplete(await res.json()) : [];
    } catch {
      return [];
    }
  };

  const suggestions = await search(q);
  return NextResponse.json({ suggestions });
}

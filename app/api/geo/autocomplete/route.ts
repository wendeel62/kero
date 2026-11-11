import { NextResponse } from "next/server";

import { parseAutocomplete, posicaoValida } from "@/lib/geocode";

// Autocomplete de rua no checkout (LocationIQ /v1/autocomplete). Sem rate-limit
// próprio: o cliente já faz debounce de 300ms e exige 3+ caracteres.
// O bairro da loja NAO e' o bairro do cliente — concatenar o bairro na busca
// trazia ruas de outra cidade (ex: "Rua das Flores" → Novo Hamburgo/RS).
// O viés real é espacial: o checkout manda lat/lng da LOJA e o viewbox+bounded
// mantém as sugestões na cidade da loja. Sem coords → ranking nacional.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  const key = process.env.LOCATIONIQ_KEY;
  if (!key) return NextResponse.json({ suggestions: [] });

  // shortcut: ±0.35° (~39km) cobre a área de entrega urbana; loja que atende
  // além disso (intermunicipal) perde sugestões fora do box — ampliar então.
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  const bias = posicaoValida(lat, lng)
    ? `&viewbox=${lng - 0.35},${lat - 0.35},${lng + 0.35},${lat + 0.35}&bounded=1`
    : "";

  const search = async (term: string) => {
    try {
      const res = await fetch(
        `https://us1.locationiq.com/v1/autocomplete?key=${key}&q=${encodeURIComponent(term)}` +
          `&format=json&limit=6&countrycodes=br&addressdetails=1${bias}`,
      );
      return res.ok ? parseAutocomplete(await res.json()) : [];
    } catch {
      return [];
    }
  };

  const suggestions = await search(q);
  return NextResponse.json({ suggestions });
}

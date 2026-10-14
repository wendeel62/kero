import { NextResponse } from "next/server";

import { parseAutocomplete } from "@/lib/geocode";

// Autocomplete de rua no checkout (LocationIQ /v1/autocomplete). Sem rate-limit
// próprio: o cliente já faz debounce de 300ms e exige 3+ caracteres.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const hood = url.searchParams.get("hood")?.trim() ?? "";
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

  // O bairro da loja enviesa a busca p/ a região — sem ele vêm ruas de todo o
  // Brasil. Se o termo+bairro não achar nada, refaz sem o bairro.
  let suggestions = hood ? await search(`${q} ${hood}`) : [];
  if (suggestions.length === 0) suggestions = await search(q);

  return NextResponse.json({ suggestions });
}

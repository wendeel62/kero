import { NextResponse } from "next/server";

import { parseViaCep, ufDeEstado } from "@/lib/geocode";

// CEP real da rua (ViaCEP por logradouro) — o CEP do LocationIQ é o de área
// (69000-000, nem existe nos Correios). Chamada ao selecionar uma sugestão;
// falha é best-effort: o caller mantém o CEP da sugestão como fallback.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const street = url.searchParams.get("street")?.trim() ?? "";
  const city = url.searchParams.get("city")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const bairro = url.searchParams.get("bairro")?.trim() ?? "";
  if (street.length < 3 || city.length < 2) return NextResponse.json({ cep: null, bairro: "" });

  const uf = ufDeEstado(state);
  if (!uf) return NextResponse.json({ cep: null, bairro: "" });

  try {
    const res = await fetch(
      `https://viacep.com.br/ws/${uf}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`,
    );
    if (!res.ok) return NextResponse.json({ cep: null, bairro: "" });
    const r = parseViaCep(await res.json(), bairro);
    return NextResponse.json({ cep: r?.cep ?? null, bairro: r?.bairro ?? "" });
  } catch {
    return NextResponse.json({ cep: null, bairro: "" });
  }
}

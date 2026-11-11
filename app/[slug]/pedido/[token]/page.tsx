"use client";

import { useParams, useRouter } from "next/navigation";

import Pedido from "../../pedido";

// Pós-venda com URL própria: /[slug]/pedido/[token] — F5 não perde o
// acompanhamento e o link pode ser compartilhado (o token é o acesso).
export default function PedidoPage() {
  const params = useParams<{ slug: string; token: string }>();
  const router = useRouter();
  return <Pedido token={params.token} aoVoltar={() => router.push(`/${params.slug}`)} />;
}

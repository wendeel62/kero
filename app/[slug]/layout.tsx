import CookieBanner from "./cookie-banner";

// Casca da vitrine: banner de cookies vale em todas as rotas de [slug]
// (cardápio, checkout embutido e a página própria do pedido).
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CookieBanner />
    </>
  );
}

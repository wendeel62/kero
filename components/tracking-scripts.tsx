import { createClient } from "@/lib/supabase/server";
import { sanitizeTrackingId, trackingEnabled } from "@/lib/tracking";
import Script from "next/script";

// Injeção única de scripts de rastreamento na vitrine (Review Focus #5).
// Lê store_tracking via RLS anon (só loja ativa) e só injeta se id válido.
export default async function TrackingScripts({ storeId }: { storeId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_tracking")
    .select("fb_pixel_id,ga4_id")
    .eq("store_id", storeId)
    .single();

  const pixel = sanitizeTrackingId("pixel", data?.fb_pixel_id);
  const ga4 = sanitizeTrackingId("ga4", data?.ga4_id);
  if (!trackingEnabled(pixel, ga4)) return null;

  return (
    <>
      {pixel && (
        <Script
          id="fb-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
              document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixel}');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}
      {ga4 && (
        <Script
          id="ga4-script"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
        />
      )}
      {ga4 && (
        <Script
          id="ga4-config"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4}');
            `,
          }}
        />
      )}
    </>
  );
}

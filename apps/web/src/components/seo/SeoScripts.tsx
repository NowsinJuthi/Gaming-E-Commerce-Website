import Script from "next/script";

type Props = {
  gtmId?: string;
  facebookPixelId?: string;
  nonce?: string;
};

/**
 * IDs are embedded in inline scripts, so only allow strict known formats.
 * Anything else (typos, pasted snippets, injection attempts) renders nothing.
 */
const GA_ID_RE = /^(G-[A-Z0-9]{4,}|UA-\d+-\d+)$/i;
const GTM_ID_RE = /^GTM-[A-Z0-9]{4,}$/i;
const FB_PIXEL_RE = /^\d{5,20}$/;

/** Client-side guard: analytics must never report admin panel pages. */
const ADMIN_PATH_GUARD = `!/^\\/admin(\\/|$)/.test(location.pathname)`;

/**
 * Google Analytics (gtag.js) snippet rendered as plain script tags so it lands
 * in the server-rendered `<head>` — REQUIRED for Google Search Console
 * ownership verification via the Analytics method. Must be rendered inside
 * the root layout's <head>. The `async` src keeps it non-blocking.
 *
 * Admin pages are excluded via the official `ga-disable-<ID>` opt-out flag,
 * kept in sync across SPA navigations (pushState/replaceState/popstate) so
 * admin URLs and order IDs are never sent to Google.
 */
export function GaHeadScript({
  googleAnalyticsId,
  nonce,
}: {
  googleAnalyticsId?: string;
  nonce?: string;
}) {
  const id = googleAnalyticsId?.trim() ?? "";
  if (!GA_ID_RE.test(id)) return null;
  const init =
    `(function(){var id='${id}';` +
    `function sync(){window['ga-disable-'+id]=!(${ADMIN_PATH_GUARD});}` +
    `sync();` +
    `var ps=history.pushState;history.pushState=function(){var r=ps.apply(this,arguments);sync();return r;};` +
    `var rs=history.replaceState;history.replaceState=function(){var r=rs.apply(this,arguments);sync();return r;};` +
    `addEventListener('popstate',sync);` +
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;` +
    `gtag('js',new Date());gtag('config','${id}');})();`;
  return (
    <>
      <script
        async
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
      />
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: init }} />
    </>
  );
}

/**
 * Injects third-party SEO/analytics tags configured in the admin SEO panel.
 * Each tag renders only when its ID is set. Loaded with `afterInteractive` so
 * they never block first paint / Core Web Vitals.
 * (Google Analytics lives in {@link GaHeadScript} instead — Search Console
 * verification requires it inside <head>.)
 */
export function SeoScripts({ gtmId, facebookPixelId, nonce }: Props) {
  const gtm = gtmId?.trim() ?? "";
  const pixel = facebookPixelId?.trim() ?? "";
  return (
    <>
      {GTM_ID_RE.test(gtm) ? (
        <Script id="gtm-init" strategy="afterInteractive" nonce={nonce}>
          {`if(${ADMIN_PATH_GUARD}){(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');}`}
        </Script>
      ) : null}

      {FB_PIXEL_RE.test(pixel) ? (
        <Script id="fb-pixel-init" strategy="afterInteractive" nonce={nonce}>
          {`if(${ADMIN_PATH_GUARD}){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');}`}
        </Script>
      ) : null}
    </>
  );
}

/** GTM `<noscript>` fallback — must live at the top of <body>. */
export function GtmNoScript({ gtmId }: { gtmId?: string }) {
  const id = gtmId?.trim() ?? "";
  if (!GTM_ID_RE.test(id)) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="gtm"
      />
    </noscript>
  );
}

import { publicFaviconLinkMime } from "@/lib/public-favicon";
import { SITE_FAVICON_PATH } from "@/lib/site-favicon";

type SiteFaviconHeadLinksProps = {
  faviconRaw: string;
};

/** SSR favicon links in <head> — required for embedded browsers and first paint. */
export function SiteFaviconHeadLinks({ faviconRaw }: SiteFaviconHeadLinksProps) {
  const type = faviconRaw.trim()
    ? publicFaviconLinkMime(faviconRaw)
    : "image/png";

  return (
    <>
      <link rel="icon" href={SITE_FAVICON_PATH} type={type} sizes="32x32" />
      <link rel="icon" href={SITE_FAVICON_PATH} type={type} sizes="16x16" />
      <link rel="shortcut icon" href={SITE_FAVICON_PATH} type={type} />
      <link
        rel="apple-touch-icon"
        href={SITE_FAVICON_PATH}
        sizes="180x180"
        type={type}
      />
    </>
  );
}

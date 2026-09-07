import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getCustomerPanelConfig } from "@/lib/api";
import {
  guessFaviconMime,
  resolveFaviconFetchUrl,
} from "@/lib/favicon-utils";
import { pickFaviconSource } from "@/lib/public-favicon";
import { normalizeSiteAppearance } from "@/lib/site-appearance";

type ServePublicFaviconOptions = {
  cacheMaxAge?: number;
};

function faviconResponse(
  body: ArrayBuffer,
  contentType: string,
  cacheMaxAge = 3600,
): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${cacheMaxAge}, stale-while-revalidate=86400`,
    },
  });
}

async function fetchGeneratedIcon(origin: string): Promise<NextResponse | null> {
  const upstream = await fetch(`${origin}/icon`, { cache: "no-store" });
  if (!upstream.ok) return null;
  const body = await upstream.arrayBuffer();
  const contentType =
    upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
    "image/png";
  return faviconResponse(body, contentType);
}

async function rasterizeFaviconPng(imageUrl: string): Promise<Response | null> {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            width={512}
            height={512}
            alt=""
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { width: 512, height: 512 },
    );
  } catch {
    return null;
  }
}

export async function servePublicFavicon(
  request: Request,
  options?: ServePublicFaviconOptions,
): Promise<Response> {
  const origin = new URL(request.url).origin;
  const cacheMaxAge = options?.cacheMaxAge ?? 3600;

  try {
    const config = await getCustomerPanelConfig();
    const appearance = normalizeSiteAppearance(
      config.appearance as Parameters<typeof normalizeSiteAppearance>[0],
    );
    const raw = pickFaviconSource(appearance);

    if (raw) {
      const fetchUrl = resolveFaviconFetchUrl(raw, origin);
      const upstream = await fetch(fetchUrl, { cache: "no-store" });
      if (upstream.ok) {
        const contentType =
          upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
          guessFaviconMime(raw);

        if (
          contentType === "image/svg+xml" ||
          raw.split("?")[0]?.toLowerCase().endsWith(".svg")
        ) {
          const raster = await rasterizeFaviconPng(fetchUrl);
          if (raster) return raster;
        }

        const body = await upstream.arrayBuffer();
        return faviconResponse(body, contentType, cacheMaxAge);
      }
    }

    const fallback = await fetchGeneratedIcon(origin);
    return fallback ?? new NextResponse(null, { status: 404 });
  } catch {
    const fallback = await fetchGeneratedIcon(origin);
    return fallback ?? new NextResponse(null, { status: 404 });
  }
}

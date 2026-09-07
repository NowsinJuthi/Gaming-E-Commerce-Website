import { servePublicFavicon } from "@/lib/serve-public-favicon";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Shorter cache so a newly uploaded admin favicon appears quickly in tabs.
  return servePublicFavicon(request, { cacheMaxAge: 30 });
}

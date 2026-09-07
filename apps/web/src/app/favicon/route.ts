import { servePublicFavicon } from "@/lib/serve-public-favicon";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return servePublicFavicon(request);
}

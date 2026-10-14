import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { SlidingWindowLimiter } from "@/lib/sliding-window-limiter";
import { authorizeStorefrontRevalidate } from "@/lib/revalidate-auth";

/** Paths that use ISR / server data cache beyond the shared root layout. */
const STOREFRONT_PATHS = [
  "/",
  "/products",
  "/about",
  "/support",
  "/website",
  "/search",
  "/cart",
  "/login",
  "/register",
  "/media",
];

type RevalidateScope = "website" | "full";

const limiter = new SlidingWindowLimiter(10, 60_000);

function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(request: Request) {
  if (!limiter.allow(clientIp(request))) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const auth = await authorizeStorefrontRevalidate(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  let scope: RevalidateScope = "full";

  try {
    const body = (await request.json()) as { scope?: string } | null;
    if (body?.scope === "website") {
      scope = "website";
    }
  } catch {
    /* no JSON body — full storefront revalidation */
  }

  if (scope === "website") {
    revalidateTag("website-page-settings");
    revalidatePath("/website");
    return NextResponse.json({ ok: true, scope: "website" });
  }

  revalidateTag("customer-panel-config");
  revalidateTag("website-page-settings");
  revalidatePath("/", "layout");

  for (const path of STOREFRONT_PATHS) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, scope: "full" });
}

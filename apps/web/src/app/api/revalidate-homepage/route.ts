import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

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
];

type RevalidateScope = "website" | "full";

export async function POST(request: Request) {
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

  // Header, footer, menus, appearance — shared root chrome.
  revalidatePath("/", "layout");

  for (const path of STOREFRONT_PATHS) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, scope: "full" });
}

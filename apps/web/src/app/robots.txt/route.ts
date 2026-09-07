import { getRobotsContent } from "@/lib/api";
import { fetchSeoConfig, SITE_URL } from "@/lib/seo";

export const revalidate = 300;

const DISALLOW = [
  "/admin",
  "/api",
  "/cart",
  "/checkout",
  "/dashboard",
  "/orders",
  "/wallet",
  "/wishlist",
  "/profile",
  "/settings",
  "/affiliate",
  "/referral",
  "/rewards",
  "/support",
  "/chat",
  "/notifications",
  "/reseller",
  "/tickets",
  "/downloads",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/order/thank-you",
  "/*?*",
];

function defaultRobots(base: string): string {
  const site = base.replace(/\/$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    ...DISALLOW.map((d) => `Disallow: ${d}`),
    "",
    `Sitemap: ${site}/sitemap.xml`,
    `Host: ${site}`,
    "",
  ].join("\n");
}

export async function GET(): Promise<Response> {
  const seo = await fetchSeoConfig();
  const base = seo.canonicalDomain.replace(/\/$/, "") || SITE_URL.replace(/\/$/, "");
  const content = await getRobotsContent(defaultRobots(base));
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate",
    },
  });
}

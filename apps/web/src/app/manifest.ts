import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Digital Goods Marketplace`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#01131a",
    theme_color: "#2dd4bf",
    icons: [
      { src: "/favicon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/favicon", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };
}

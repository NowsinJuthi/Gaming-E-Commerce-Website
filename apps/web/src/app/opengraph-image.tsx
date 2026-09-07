import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

export const alt = `${SITE_NAME} — Digital Goods Marketplace`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #01131a 0%, #031a22 55%, #0b2a26 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#2dd4bf",
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 40, marginTop: 12, color: "#cbd5e1" }}>
          Digital Goods Marketplace
        </div>
        <div style={{ fontSize: 26, marginTop: 28, color: "#94a3b8" }}>
          Instant delivery · Secure checkout
        </div>
      </div>
    ),
    { ...size },
  );
}

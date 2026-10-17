import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security-headers";

// HSTS is set at nginx (HTTPS vhost only) to avoid duplicate/conflicting headers.
const securityHeaders = getSecurityHeaders({
  includeHsts: false,
  includeCsp: false,
});

const modernPolyfillModule = join(
  process.cwd(),
  "src/lib/next-polyfill-module.js",
);

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

function readEnvFileValues(key: string): string[] {
  const values: string[] = [];
  for (const filename of [".env.local", ".env"]) {
    const path = join(process.cwd(), filename);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (!trimmed.startsWith(`${key}=`)) continue;
      const raw = trimmed.slice(key.length + 1).trim();
      const unquoted = raw.replace(/^['"]|['"]$/g, "");
      if (unquoted) values.push(unquoted);
    }
  }
  return values;
}

function addPattern(
  patterns: RemotePattern[],
  seen: Set<string>,
  entry: RemotePattern,
) {
  const key = `${entry.protocol}://${entry.hostname}:${entry.port ?? "*"}`;
  if (seen.has(key)) return;
  seen.add(key);
  patterns.push(entry);
}

function imageRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [];
  const seen = new Set<string>();

  if (process.env.NODE_ENV !== "production") {
    for (const host of ["localhost", "127.0.0.1"]) {
      addPattern(patterns, seen, { protocol: "http", hostname: host });
    }
  }

  const envUrls = [
    ...readEnvFileValues("NEXT_PUBLIC_API_URL"),
    ...readEnvFileValues("NEXT_PUBLIC_SITE_URL"),
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter(Boolean) as string[];

  for (const raw of envUrls) {
    try {
      const parsed = new URL(raw.trim());
      const protocol = parsed.protocol.replace(":", "");
      if (protocol !== "http" && protocol !== "https") continue;
      if (process.env.NODE_ENV === "production" && protocol !== "https") {
        continue;
      }
      addPattern(patterns, seen, {
        protocol,
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
      });
    } catch {
      /* ignore invalid URLs */
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  typedRoutes: true,
  transpilePackages: ["@uniqbd/types"],
  eslint: { ignoreDuringBuilds: true },

  experimental: {
    optimizePackageImports: [
      "@tanstack/react-query",
      "@tanstack/react-query-devtools",
      "socket.io-client",
      "sanitize-html",
    ],
    cssChunking: "strict",
  },

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]build[\\/]polyfills[\\/]polyfill-module(\.js)?$/,
          modernPolyfillModule,
        ),
      );
    }
    return config;
  },

  images: {
    remotePatterns: imageRemotePatterns(),
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },

  headers: async () => {
    const devNoStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ];

    const htmlNoStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ];

    const globalSecurity = {
      source: "/:path*",
      headers: securityHeaders,
    };

    if (process.env.NODE_ENV !== "production") {
      return [
        globalSecurity,
        { source: "/_next/static/:path*", headers: devNoStore },
        { source: "/_next/:path*", headers: devNoStore },
      ];
    }

    return [
      globalSecurity,
      { source: "/admin/:path*", headers: htmlNoStore },
      { source: "/dashboard/:path*", headers: htmlNoStore },
      { source: "/orders/:path*", headers: htmlNoStore },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  redirects: async () => [
    {
      source: "/products/:slug",
      destination: "/:slug",
      permanent: true,
    },
    {
      source: "/category/:slug",
      destination: "/:slug",
      permanent: true,
    },
  ],

  rewrites: async () => {
    const faviconRewrite = {
      source: "/favicon.ico",
      destination: "/favicon",
    };
    // Rewrites must target loopback Nest — never NEXT_PUBLIC_API_URL (often https://uniqbd.com/api → rewrite loop).
    let apiOrigin = "http://127.0.0.1:4000";
    const internal = process.env.INTERNAL_API_URL?.trim();
    if (internal) {
      try {
        apiOrigin = new URL(internal.replace(/\/$/, "")).origin;
      } catch {
        /* keep loopback default */
      }
    }
    return [
      faviconRewrite,
      {
        source: "/api/uploads/:path*",
        destination: `${apiOrigin}/api/uploads/:path*`,
      },
      {
        source: "/api/app/:path*",
        destination: `${apiOrigin}/api/app/:path*`,
      },
      {
        source: "/api/media/playback/:path*",
        destination: `${apiOrigin}/api/media/playback/:path*`,
      },
      {
        source: "/api/admin/media/:path*",
        destination: `${apiOrigin}/api/admin/media/:path*`,
      },
      {
        source: "/api/media/:path*",
        destination: `${apiOrigin}/api/media/:path*`,
      },
      {
        source: "/api/admin/media-shares/:id/upload",
        destination: `${apiOrigin}/api/admin/media-shares/:id/upload`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${apiOrigin}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;

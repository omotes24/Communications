import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const managementResponseHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      { source: "/admin/:path*", headers: managementResponseHeaders },
      { source: "/api/admin/:path*", headers: managementResponseHeaders },
      {
        source: "/api/interview-experiences/:path*",
        headers: managementResponseHeaders,
      },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();

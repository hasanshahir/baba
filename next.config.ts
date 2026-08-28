import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The hosted widget page is meant to be embedded (iframed) on any
        // business's website, so explicitly allow cross-origin framing for it.
        // The rest of the app keeps the browser's default framing protections.
        source: "/widget/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
    ];
  },
};

export default nextConfig;

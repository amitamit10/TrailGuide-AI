import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  // Isolate this browsing context from cross-origin openers (Spectre mitigation).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Prevent cross-origin no-cors reads of our responses.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // HSTS — 1 year, include subdomains. Vercel also enforces this at the CDN
  // edge, but belt-and-suspenders is correct for any direct-origin connections.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://upload.wikimedia.org https://images.unsplash.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://*.supabase.co https://api.groq.com https://api.telegram.org https://api.tavily.com https://api.unsplash.com https://en.wikipedia.org https://api.open-meteo.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // The photo proxy intentionally serves bytes to cross-origin CORS requests
        // (html2canvas on the frontend). Override CORP to cross-origin so no-cors
        // embeds are also allowed; CORS headers on the route itself still gate access.
        source: "/api/places/photo",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default withSerwist(nextConfig);

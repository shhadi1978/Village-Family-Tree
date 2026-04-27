/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolate development artifacts from production builds.
  // This prevents recurring MODULE_NOT_FOUND/404 chunk errors when running build + dev on Windows.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  webpack: (config, { dev }) => {
    // Stabilize dev mode on Windows: avoid corrupted filesystem cache chunks.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts – Next HMR, Clerk JS, Cloudflare Turnstile
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
              // Frames – Clerk hosted pages + Turnstile iframe
              "frame-src https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
              // API calls from Clerk SDK and Turnstile
              "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com https://challenges.cloudflare.com",
              // Images – Clerk avatars, UploadThing CDN
              "img-src 'self' data: blob: https://*.clerk.accounts.dev https://img.clerk.com https://utfs.io https://uploadthing.com",
              // Styles – Clerk injected styles
              "style-src 'self' 'unsafe-inline'",
              // Fonts
              "font-src 'self' data:",
              // Workers & manifests
              "worker-src 'self' blob:",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "private-state-token-issuance=*, private-state-token-redemption=*",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "uploadthing.com",
      },
    ],
  },
};

export default nextConfig;

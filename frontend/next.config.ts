import type { NextConfig } from "next";
const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async rewrites() {
    const origin = (
      process.env.DJANGO_API_URL || "http://127.0.0.1:8000/api"
    ).replace(/\/api\/?$/, "");
    return [{ source: "/media/:path*", destination: `${origin}/media/:path*` }];
  },
};
export default config;

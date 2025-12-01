import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Vercelでのビルドエラーを回避
  buildExcludes: [/middleware-manifest\.json$/],
});

export default pwaConfig(nextConfig);

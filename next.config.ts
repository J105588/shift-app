import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  // webpackを明示的に使用（next-pwaがwebpackベースのため）
  webpack: (config, { isServer }) => {
    return config;
  },
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

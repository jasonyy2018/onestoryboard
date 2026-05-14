import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 关闭 Next.js 匿名遥测
  env: {},
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    remotePatterns: [
      // 阿里云 OSS / DashScope
      { protocol: "https", hostname: "**.aliyuncs.com" },
      // 火山引擎 / Volcengine
      { protocol: "https", hostname: "**.volces.com" },
      // 腾讯云 VOD / COS
      { protocol: "https", hostname: "**.myqcloud.com" },
      { protocol: "http",  hostname: "**.myqcloud.com" },
      { protocol: "https", hostname: "**.vod-qcloud.com" },
      { protocol: "http",  hostname: "**.vod-qcloud.com" },
      // Vercel Blob（可选）
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      // R2 / MinIO（可选）
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;

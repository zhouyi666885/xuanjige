import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site', '8.139.254.205', '*'],
  // 禁用浏览器 source map（减少静态产物体积）
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  // 让 AWS SDK 等大型 Node 包不被打进 RSC bundle（减小 cold-start 体积）
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/lib-storage', 'pdf-parse'],
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
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
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/lib-storage'],
};

export default nextConfig;

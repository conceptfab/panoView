import type { NextConfig } from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: (pkg as { version?: string }).version ?? '0.0.0',
  },
  // /uploads/* obsługuje route src/app/uploads/[...path] (redirect do Vercel Blob);
  // rewrite zostaje jako fallback dla zgodności starych URL-i z /api/static.
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/static/:path*',
      },
    ];
  },

  // Obrazy serwowane są z Vercel Blob przez redirect – bez optymalizacji Next.
  images: {
    remotePatterns: [],
    unoptimized: true,
  },

  // Upload plików idzie client-uploadem do Vercel Blob (limit body 4.5MB na Vercel
  // nie dotyczy panoram); server actions zostają na bezpiecznym limicie.
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;

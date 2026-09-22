import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async redirects() {
    return [
      {
        source: '/reportes/nuevo',
        destination: '/reportar/perdida',
        permanent: true,
      },
      {
        source: '/reportes/:id/fotos',
        destination: '/reportar/perdida/fotos?id=:id',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

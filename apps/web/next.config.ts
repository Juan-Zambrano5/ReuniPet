import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@reunipet/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' }],
  },
  outputFileTracingIncludes: {
    // include both keys to be safe with and without src
    'src/app/api/summarize/route': ['./src/ai/prompts/siggy_system.txt'],
    'app/api/summarize/route': ['./src/ai/prompts/siggy_system.txt'],
  },
};

export default nextConfig;

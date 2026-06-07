import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required: Playwright and node modules should not be bundled for the client
  serverExternalPackages: ['playwright', 'archiver', 'bullmq', 'ioredis'],
};

export default nextConfig;

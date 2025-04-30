
/** @type {import('@ducanh2912/next-pwa').PWAConfig} */
const withPWAInit = require("@ducanh2912/next-pwa").default;

const isDev = process.env.NODE_ENV === "development";

const pwaConfig = {
  dest: "public",
  disable: isDev,
  register: true,
  skipWaiting: true,
  swSrc: "src/worker/index.ts", // Specify custom service worker source
  // runtimeCaching: require("./cache"), // Example: If you need custom caching strategies
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Recommended for development
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Required for web-push library if used in API routes/server actions
  // experimental: {
  //   serverComponentsExternalPackages: ['web-push'],
  // },
};

const withPWA = withPWAInit(pwaConfig);

module.exports = withPWA(nextConfig);

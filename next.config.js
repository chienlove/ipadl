/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: true, // Bật Server Actions (Next.js 13+)
  },
  // Cho phép sử dụng Node.js modules
  webpack: (config) => {
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      net: false,
      tls: false,
      dns: false
    };
    return config;
  }
};
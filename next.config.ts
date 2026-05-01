import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['tropical-finished-amusable.ngrok-free.dev'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
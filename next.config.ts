import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the phone (same wifi) to load Next.js dev resources / HMR over LAN.
  allowedDevOrigins: ["192.168.1.103"],
};

export default nextConfig;

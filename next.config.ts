import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "ffmpeg-static", "@sparticuz/chromium-min"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["fluent-ffmpeg", "openai", "ffmpeg-static"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The screenshot import flow (AddForm's "Screenshots" tab) posts recipe
      // photos to a Server Action as base64, and the default cap is 1MB.
      // ScreenshotPicker already downscales every image to ~1600px JPEG
      // client-side, so a realistic 6-shot import lands around 2-3MB; this
      // leaves headroom for base64's 33% inflation and multipart overhead
      // without opening the door to genuinely large uploads.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;

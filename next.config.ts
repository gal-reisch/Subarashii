import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// The commit the running build came from, resolved once here rather than at
// request time — see the note in src/lib/version.ts for what it's for.
//
// Vercel exports `VERCEL_GIT_COMMIT_SHA` for every build, which is the case
// that matters: it's the deployed commit, straight from the platform, with
// nothing for anyone to forget to update. The `git` call is only ever the
// local fallback so the marker isn't a permanent "dev" while working on it,
// and it's wrapped because a build can legitimately happen somewhere with no
// git history (a Docker context, a tarball) — that's a missing nicety, not a
// broken build.
function commitSha(): string {
  const fromPlatform = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromPlatform) return fromPlatform.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

function packageVersion(): string {
  try {
    return (
      JSON.parse(readFileSync("./package.json", "utf8")).version ?? "0.0.0"
    );
  } catch {
    return "0.0.0";
  }
}

const nextConfig: NextConfig = {
  // Inlined at build time. These are `NEXT_PUBLIC_`-named because that's what
  // they are — values baked into the bundle and readable by anyone with the
  // page open. A commit hash of a private repo is fine to publish; don't put
  // anything here that isn't.
  env: {
    NEXT_PUBLIC_APP_COMMIT: commitSha(),
    NEXT_PUBLIC_APP_VERSION: packageVersion(),
  },
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
